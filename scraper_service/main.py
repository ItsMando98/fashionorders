"""Fashion Orders scraping sidecar (Scrapling).

Small FastAPI service that the Next.js backend calls for Yupoo/Weidian
scraping. It mirrors the allowlist + SSRF rules from src/lib/server/hosts.ts
(defense in depth: Next.js validates before calling us, we validate again).

Run:
    SCRAPER_TOKEN=secret .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8100
"""

import ipaddress
import os
import re
import socket
from urllib.parse import parse_qs, unquote, urlparse

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

SHOP_ROOTS = ("yupoo.com", "weidian.com")
TOKEN = os.environ.get("SCRAPER_TOKEN", "")
FETCH_TIMEOUT = 20  # seconds

app = FastAPI(title="fashion-orders-scraper")


# ---------------------------------------------------------------------------
# SSRF protection (mirrors src/lib/server/hosts.ts)
# ---------------------------------------------------------------------------

def host_matches(host: str, roots: tuple[str, ...]) -> bool:
    host = host.lower().rstrip(".")
    return any(host == root or host.endswith(f".{root}") for root in roots)


def is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def validate_url(raw_url: str) -> str:
    """Return the cleaned URL or raise 400/403."""
    url = raw_url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(400, "Only https URLs are allowed.")
    host = (parsed.hostname or "").lower()
    if not host or not host_matches(host, SHOP_ROOTS):
        raise HTTPException(400, "Only Yupoo and Weidian links are allowed.")
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        ips = {info[4][0] for info in infos}
    except socket.gaierror:
        raise HTTPException(400, "Host does not resolve.")
    if any(is_private_ip(ip) for ip in ips):
        raise HTTPException(403, "Host is not public.")
    return url


# ---------------------------------------------------------------------------
# Extraction helpers (ported from src/lib/server/scraper.ts)
# ---------------------------------------------------------------------------

PRICE_PATTERNS = [
    re.compile(r"(?:[¥￥💰]\s*)(\d{2,5}(?:\.\d{1,2})?)(?:\b|\s|,|$)", re.I),
    re.compile(r"(?:Price|price|售价|价格)\s*[:：]?\s*[¥￥]?\s*(\d{2,5}(?:\.\d{1,2})?)", re.I),
    re.compile(r"\b(\d{2,4})\s*(?:CNY|RMB|yuan|元)\b", re.I),
]


def extract_price(text: str) -> float | None:
    if not text:
        return None
    for pattern in PRICE_PATTERNS:
        match = pattern.search(text)
        if match:
            value = float(match.group(1))
            if 0 < value < 50000:
                return value
    return None


def first(page, selector: str):
    """Scrapling 0.5 has no css_first on Response; emulate it."""
    matches = page.css(selector)
    return matches[0] if matches else None


def looks_blocked(page) -> bool:
    """Detect Cloudflare / anti-bot interstitials."""
    status = getattr(page, "status", 200) or 200
    if status in (401, 403, 503):
        return True
    marker = page.css("title::text")
    title = marker.get() if marker else ""
    body_start = (page.body or "")[:2000] if isinstance(page.body, str) else ""
    haystack = (title + body_start).lower()
    return any(
        token in haystack
        for token in ("just a moment", "attention required", "cf-chl", "cloudflare")
    )


# ---------------------------------------------------------------------------
# Scrapers
# ---------------------------------------------------------------------------

def _parse_weidian_payload(data: dict, item_id: str, url: str) -> dict | None:
    """Normalize a Weidian API JSON payload (thor getItemSkuInfo or legacy
    get-item-detail shape) into our result shape."""
    result = data.get("result") or data.get("data") or {}
    if not isinstance(result, dict):
        return None
    title = result.get("itemTitle") or result.get("title") or ""

    # Legacy shape reports price in yuan; the thor shape reports prices in
    # cents (fen) — e.g. itemDiscountLowPrice: 48000 means 480 CNY.
    price = result.get("price") or result.get("sellPrice") or result.get("minPrice")
    if price is None:
        cents = result.get("itemDiscountLowPrice") or result.get("itemOriginalLowPrice")
        if cents is not None:
            try:
                price = round(float(cents) / 100, 2)
            except (TypeError, ValueError):
                price = None
    else:
        try:
            price = float(price)
        except (TypeError, ValueError):
            price = None

    img_url = result.get("itemMainPic") or ""
    if not img_url:
        head_imgs = result.get("headImgs") or result.get("imgs") or []
        img_url = head_imgs[0] if head_imgs else ""

    sizes: list[str] = []
    attr_list = result.get("attrList") or []
    for attr in attr_list:
        if not isinstance(attr, dict):
            continue
        label = attr.get("attrTitle") or "Option"
        values = [v.get("attrValue") for v in (attr.get("attrValues") or []) if isinstance(v, dict)]
        values = [v for v in values if v]
        if values:
            sizes.append(f"{label}: {', '.join(values[:8])}")
    if not sizes:
        sku_infos = result.get("skuInfos") or result.get("skus") or []
        sizes = [s.get("title") or s.get("skuTitle") for s in sku_infos if isinstance(s, dict)]
        sizes = [s for s in sizes if s]

    if not title and price is None:
        return None
    return {
        "source_platform": "Weidian",
        "title": title or f"Weidian Item ({item_id})",
        "price_cny": price,
        "available_sizes": " | ".join(sizes[:10]) or "See Weidian SKU",
        "img_url": img_url,
        "weidian_url": url,
    }


def scrape_weidian(url: str) -> dict:
    """Weidian killed their public JSON endpoints, so load the item page in a
    stealth browser and capture the background XHR that carries the item data
    (Scrapling record_requests)."""
    from scrapling.fetchers import StealthySession

    match = re.search(r"itemID=(\d+)", url, re.I) or re.search(r"item\.html\?id=(\d+)", url, re.I)
    item_id = match.group(1) if match else ""
    if not item_id:
        raise HTTPException(400, "Could not read the Weidian item id.")

    with StealthySession(headless=True, record_requests=True, max_pages=1) as session:
        session.fetch(url, network_idle=True, timeout=60000)
        hits = session.network.search(r"item|detail|sku", limit=None)
        for hit in hits:
            body = hit.body.decode("utf-8", "ignore") if isinstance(hit.body, bytes) else str(hit.body)
            if "itemTitle" not in body and '"price"' not in body:
                continue
            # Weidian endpoints sometimes answer JSONP: strip the callback.
            json_match = re.search(r"\{.*\}", body, re.S)
            if not json_match:
                continue
            try:
                import json

                data = json.loads(json_match.group(0))
            except ValueError:
                continue
            if isinstance(data, dict):
                parsed = _parse_weidian_payload(data, item_id, url)
                if parsed:
                    return parsed

    raise HTTPException(502, "Weidian item data not found (page changed or blocked).")


def fetch_yupoo_page(url: str):
    """Plain fetch first, stealth browser fallback when blocked."""
    from scrapling.fetchers import Fetcher

    page = Fetcher.get(
        url,
        impersonate="chrome",
        stealthy_headers=True,
        timeout=FETCH_TIMEOUT,
        follow_redirects=True,
    )
    if not looks_blocked(page):
        return page, False

    try:
        from scrapling.fetchers import StealthyFetcher

        stealth = StealthyFetcher.fetch(
            url,
            headless=True,
            solve_cloudflare=True,
            network_idle=True,
            timeout=45000,
        )
        return stealth, True
    except Exception:
        # Browser not installed or bypass failed: return the plain page,
        # the caller still extracts whatever is available.
        return page, False


def scrape_yupoo(url: str) -> dict:
    page, used_stealth = fetch_yupoo_page(url)

    title_el = first(page, ".showalbumheader__gallerytitle")
    sub_el = first(page, ".showalbumheader__gallerysubtitle")
    og_img_el = first(page, 'meta[property="og:image"]')

    raw_title = (title_el.text if title_el else "") or ""
    raw_title = raw_title.strip()
    raw_sub = (sub_el.text if sub_el else "") or ""
    raw_sub = raw_sub.strip()
    img_url = (og_img_el.attrib.get("content", "") if og_img_el else "") or ""

    # Embedded Weidian / Taobao links in the album subtitle
    weidian_url = ""
    if sub_el:
        for anchor in sub_el.css("a[href]"):
            href = anchor.attrib.get("href", "")
            if "external?url=" in href:
                query = parse_qs(urlparse(href).query)
                ext = query.get("url", [""])[0]
                if ext:
                    href = unquote(ext)
            if "weidian.com" in href or "taobao.com" in href:
                weidian_url = href
                break

    price = extract_price(raw_title) or extract_price(raw_sub)
    sizes = "S, M, L, XL, XXL"

    if weidian_url and "weidian.com" in weidian_url:
        try:
            wd = scrape_weidian(weidian_url)
            if price is None and wd.get("price_cny") is not None:
                price = wd["price_cny"]
            if wd.get("available_sizes"):
                sizes = wd["available_sizes"]
        except Exception:
            pass

    clean_title = re.sub(r"^(?:[¥￥💰]\s*\d+[\s,]*|🏷️\s*)+", "", raw_title, flags=re.I).strip()
    album_match = re.search(r"albums/(\d+)", url, re.I)
    album_id = album_match.group(1) if album_match else "link"
    if not clean_title:
        clean_title = raw_title or f"Yupoo Album #{album_id}"

    return {
        "source_platform": "Yupoo",
        "title": clean_title,
        "price_cny": price,
        "available_sizes": sizes,
        "img_url": img_url,
        "weidian_url": weidian_url or None,
        "used_stealth": used_stealth,
    }


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/scrape")
def scrape(req: ScrapeRequest, x_scraper_token: str = Header(default="")):
    if TOKEN and x_scraper_token != TOKEN:
        raise HTTPException(401, "Bad token.")

    url = validate_url(req.url)
    host = (urlparse(url).hostname or "").lower()

    try:
        if "weidian.com" in host:
            return scrape_weidian(url)
        return scrape_yupoo(url)
    except HTTPException:
        raise
    except Exception as err:  # noqa: BLE001 - report any scrape failure as 502
        raise HTTPException(502, f"Scrape failed: {type(err).__name__}")
