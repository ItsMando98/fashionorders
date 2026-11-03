import os
import re
import json
import urllib.parse
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup
from PIL import Image as PILImage
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as XLImage
from openpyxl.worksheet.datavalidation import DataValidation

ORDERS = {
    "Tom Luis": [
        "https://happywhale.x.yupoo.com/albums/223870545?uid=1&isSubCate=false&referrercate=4942271",
        "https://happywhale.x.yupoo.com/albums/223652975?uid=1&isSubCate=false&referrercate=4917572",
        "https://happywhale.x.yupoo.com/albums/223642434?uid=1&isSubCate=false&referrercate=4917572",
        "https://happywhale.x.yupoo.com/albums/191225234?uid=1&isSubCate=true&referrercate=552489",
        "https://happywhale.x.yupoo.com/albums/232955497?uid=1&isSubCate=true&referrercate=629020",
        "https://happywhale.x.yupoo.com/albums/204489799?uid=1&isSubCate=true&referrercate=629018",
        "https://happywhale.x.yupoo.com/albums/254069794?uid=1&isSubCate=true&referrercate=593009",
        "https://happywhale.x.yupoo.com/albums/257369460?uid=1&isSubCate=false&referrercate=4919619",
        "https://happywhale.x.yupoo.com/albums/256518493?uid=1&isSubCate=false&referrercate=4890255",
        "https://happywhale.x.yupoo.com/albums/251307080?uid=1&isSubCate=false&referrercate=4890255",
        "https://happywhale.x.yupoo.com/albums/248882747?uid=1&isSubCate=false&referrercate=4890255",
        "https://happywhale.x.yupoo.com/albums/228149028?uid=1",
        "https://3125tiger.x.yupoo.com/albums/255432070?uid=1",
    ],
    "Fynn": [
        "https://happywhale.x.yupoo.com/albums/252584743?uid=1&isSubCate=false&referrercate=",
        "https://happywhale.x.yupoo.com/albums/252896961?uid=1&isSubCate=false&referrercate=",
        "https://happywhale.x.yupoo.com/albums/252572586?uid=1",
        "https://happywhale.x.yupoo.com/albums/253757957?uid=1",
        "https://happywhale.x.yupoo.com/albums/254063046?uid=1",
        "https://happywhale.x.yupoo.com/albums/257945777?uid=1",
        "https://happywhale.x.yupoo.com/albums/258683359?uid=1",
        "https://happywhale.x.yupoo.com/albums/256249794?uid=1",
        "https://happywhale.x.yupoo.com/albums/245540253?uid=1",
        "https://happywhale.x.yupoo.com/albums/245302940?uid=1",
        "https://happywhale.x.yupoo.com/albums/189234199?uid=1",
        "https://happywhale.x.yupoo.com/albums/258215579?uid=1",
        "https://baymaxsocks.x.yupoo.com/albums/128103452?uid=1&isSubCate=false&referrercate=",
        "https://baymaxsocks.x.yupoo.com/albums/218365422?uid=1&isSubCate=false&referrercate=",
        "https://baymaxsocks.x.yupoo.com/albums/206534777?uid=1&isSubCate=false&referrercate=",
        "https://baymaxsocks.x.yupoo.com/albums/257752699?uid=1&isSubCate=false&referrercate=",
        "https://baymaxsocks.x.yupoo.com/albums/253174988?uid=1&isSubCate=false&referrercate=",
        "https://baymaxsocks.x.yupoo.com/albums/243233844?uid=1&isSubCate=false&referrercate=",
        "https://happywhale.x.yupoo.com/albums/241206889?uid=1",
        "https://happywhale.x.yupoo.com/albums/252963192?uid=1&isSubCate=false&referrercate=5058483",
        "https://happywhale.x.yupoo.com/albums/246457052?uid=1",
        "https://happywhale.x.yupoo.com/albums/229847901?uid=1",
        "https://happywhale.x.yupoo.com/albums/239163723?uid=1",
        "https://happywhale.x.yupoo.com/albums/204489797?uid=1",
        "https://swagsupply.x.yupoo.com/albums/260870751?uid=1&isSubCate=false&referrercate=",
        "https://swagsupply.x.yupoo.com/albums/260871086?uid=1&isSubCate=false&referrercate=",
        "https://swagsupply.x.yupoo.com/albums/260871122?uid=1&isSubCate=false&referrercate=",
    ],
    "Mathis": [
        "https://happywhale.x.yupoo.com/albums/259426197?uid=1&isSubCate=false&referrercate="
    ]
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

IMG_DIR = "/Users/mathis/Desktop/FashionOrders/.cache_images"
os.makedirs(IMG_DIR, exist_ok=True)


def fetch_weidian_info(weidian_url):
    m = re.search(r"itemID=(\d+)", weidian_url, re.I)
    if not m:
        return None, None
    item_id = m.group(1)
    try:
        api_url = f"https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=%7B%22itemId%22%3A%22{item_id}%22%7D"
        r = requests.get(api_url, headers=HEADERS, timeout=10).json()
        res = r.get("result", {})
        price_fen = res.get("itemDiscountHighPrice") or res.get("itemHighPrice")
        if not price_fen and res.get("skuInfos"):
            price_fen = res["skuInfos"][0].get("skuInfo", {}).get("originalPrice")
        price = round(float(price_fen) / 100.0, 2) if price_fen else None

        sizes = []
        for attr in res.get("attrList", []):
            vals = [v.get("attrValue", "").strip() for v in attr.get("attrValues", []) if v.get("attrValue")]
            if vals:
                sizes.append(", ".join(vals))
        return price, " | ".join(sizes) if sizes else None
    except Exception:
        return None, None


def extract_price_from_title(title):
    # Matches patterns like ￥560, ¥250, 💰 200, 💰180
    m = re.search(r"(?:[¥￥💰]\s*)(\d{2,5})(?:\b|\s|,)", title)
    if m:
        return float(m.group(1))
    return None


def extract_sizes(title, subtitle, weidian_sizes=None):
    combined = f"{title}\n{subtitle}"
    if "M50-66kg" in combined:
        return "M (50-66kg), L (65-75kg), XL (75-85kg), XXL (85-100kg)"
    if "S：" in combined and "XXL:" in combined:
        return "S, M, L, XL, XXL"
    # Check explicit size lines first
    patterns = [
        r"(?:Size/𝙎𝙞𝙯𝙚|Size|size|SIZE|𝐒𝐈𝐙𝐄|Specification|Code|尺码)\s*[:：]\s*([^\n]+)",
        r"Size\s*\n\s*([0-9/.\s-]+)",
        r"Primary color\s*:\s*([0-9.]+)",
        r"\b(35-45|35-44|39-46|M-3XL(?:\s*\(48-56\))?|S-XL|S-XXL|S-XXl|xxs\s*~\s*〰️*\s*XL)\b",
        r"(\d+\s*[×xX*]\s*\d+\s*[×xX*]?\s*\d*\s*cm)",
    ]
    for pat in patterns:
        m = re.search(pat, combined)
        if m:
            val = m.group(1).strip()
            val = re.sub(r"\s*(?:Comes with|【).*$", "", val, flags=re.I).strip()
            if len(val) <= 65 and not val.lower().startswith("suggest") and "perfect" not in val.lower():
                return val
    if weidian_sizes:
        return weidian_sizes[:80]
    return ""


def detect_brand_and_category(title, subtitle, url):
    t_low = f" {title.lower()} "
    full_low = f" {title.lower()} {subtitle.lower()} "
    brand = "—"
    brand_map = [
        ([r"\bysl\b", r"saint laurent", r"\bniki\b"], "Saint Laurent (YSL)"),
        ([r"louis v", r"\blv\b"], "Louis Vuitton (LV)"),
        ([r"burberr", r"\bbbr\b", r"\bbur\b"], "Burberry"),
        ([r"\bblcg\b", r"balenciag"], "Balenciaga"),
        ([r"\bprada\b"], "Prada"),
        ([r"nkxnotca", r"\bnocta\b", r"\bdrake\b"], "Nike x NOCTA"),
        ([r"\bnk\b"], "Nike"),
        ([r"\bberluti\b"], "Berluti"),
        ([r"\blp\b", r"babouche", r"summer charms"], "Loro Piana (LP)"),
        ([r"\bmiu\b", r"miu-"], "Miu Miu"),
        ([r"\bugg\b"], "UGG"),
        ([r"\bdg\b"], "Dolce & Gabbana (D&G)"),
        ([r"\bgoyard\b"], "Goyard"),
        ([r"acne studios"], "Acne Studios"),
        ([r"\bze\b"], "Zegna"),
        ([r"\bloewe\b"], "Loewe"),
        ([r"\bow\b", r"off-white"], "Off-White"),
        ([r"\bbv\b", r"\bjodie\b"], "Bottega Veneta (BV)"),
        ([r"su\*", r"manicure"], "Supreme"),
        ([r"\bcrtz\b"], "Corteiz (CRTZ)"),
        ([r"\bpatagonia\b"], "Patagonia"),
        ([r"chr hearts", r"chrome hearts"], "Chrome Hearts"),
        ([r"hermès", r"hermes"], "Hermès"),
        ([r"\bbc\b", r"brunello"], "Brunello Cucinelli (BC)"),
        ([r"pet-only"], "SwagSupply (Pet Add-on)"),
    ]
    for patterns, b_name in brand_map:
        if any(re.search(p, t_low) for p in patterns) or any(re.search(p, full_low) for p in patterns):
            brand = b_name
            break

    cat = "Apparel / Item"
    cat_map = [
        (["coat", "jacket", "down jacket"], "Jacket / Coat"),
        (["hoodie", "sweater"], "Hoodie / Knitwear"),
        (["t-shirt", "short sleeves"], "T-Shirt / Top"),
        (["jeans", "pants", "trousers"], "Pants / Jeans"),
        (["underwear", "boxer"], "Underwear"),
        (["cap", "hat", "balaclava"], "Headwear"),
        (["scarf"], "Scarf"),
        (["bag", "jodie", "backpack", "niki", "lemon yellow k0884"], "Bag / Leather Goods"),
        (["card holder"], "Card Holder / Wallet"),
        (["cigar box"], "Accessory / Cigar Case"),
        (["manicure"], "Accessory / Manicure Set"),
        (["shoes", "mocasin", "tazz", "running shoes"], "Footwear"),
        (["pet-only"], "Special / Pet Item"),
    ]
    for keys, c_name in cat_map:
        if any(k in full_low for k in keys):
            cat = c_name
            break
    if "4890255" in url and not title:
        cat = "Leather Jacket (SSB Factory)"
    return brand, cat


def clean_product_title(title, url):
    if not title:
        album_id = re.search(r"albums/(\d+)", url)
        aid = album_id.group(1) if album_id else "Unknown"
        if "4890255" in url:
            return f"[Offline Album #{aid}] SSB Factory Leather Jacket"
        return f"[Offline Album #{aid}] Album Deleted / Unavailable"
    # Remove price prefix (only when preceded by ¥/￥/💰/🏷️)
    cleaned = re.sub(r"^(?:[¥￥💰]\s*\d+[\s,]*|🏷️\s*)+", "", title).strip()
    return cleaned or title


def scrape_item(url):
    seller_match = re.search(r"https?://([^.]+)\.x\.yupoo\.com", url)
    seller = seller_match.group(1) if seller_match else "yupoo"
    album_match = re.search(r"albums/(\d+)", url)
    album_id = album_match.group(1) if album_match else "unknown"

    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        status_code = r.status_code
        soup = BeautifulSoup(r.text, "html.parser")
        title_el = soup.select_one(".showalbumheader__gallerytitle")
        sub_el = soup.select_one(".showalbumheader__gallerysubtitle")
        og_img = soup.select_one('meta[property="og:image"]')

        raw_title = title_el.get_text(strip=True) if title_el else ""
        raw_sub = sub_el.get_text("\n", strip=True) if sub_el else ""
        img_url = og_img["content"] if og_img else ""

        # Check for Weidian or secondary Yupoo link
        weidian_url = ""
        for a in (sub_el.select("a[href]") if sub_el else []):
            href = a["href"]
            if "external?url=" in href:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                if "url" in parsed:
                    href = urllib.parse.unquote(urllib.parse.unquote(parsed["url"][0]))
            if "weidian.com" in href:
                weidian_url = href
            elif "yupoo.com/albums" in href and not weidian_url:
                # Follow secondary yupoo link (e.g. highstreet)
                r2 = requests.get(href, headers=HEADERS, timeout=10)
                s2 = BeautifulSoup(r2.text, "html.parser")
                sub2 = s2.select_one(".showalbumheader__gallerysubtitle")
                if sub2:
                    m_wd = re.search(r"https?://[^\s<>\"]*weidian\.com[^\s<>\"]*", sub2.get_text())
                    if m_wd:
                        weidian_url = m_wd.group(0)

        if not weidian_url:
            m_wd = re.search(r"https?://[^\s<>\"]*weidian\.com[^\s<>\"]*", raw_sub)
            if m_wd:
                weidian_url = m_wd.group(0)

        price = extract_price_from_title(raw_title)
        weidian_price, weidian_sizes = (None, None)
        if weidian_url:
            weidian_price, weidian_sizes = fetch_weidian_info(weidian_url)
            if price is None and weidian_price is not None:
                price = weidian_price

        avail_sizes = extract_sizes(raw_title, raw_sub, weidian_sizes)
        brand, category = detect_brand_and_category(raw_title, raw_sub, url)
        clean_title = clean_product_title(raw_title, url)

        # Download and process thumbnail image
        img_path = None
        if status_code == 200 and img_url and "logo1@558" not in img_url:
            img_path = os.path.join(IMG_DIR, f"{seller}_{album_id}.png")
            if not os.path.exists(img_path):
                img_headers = {**HEADERS, "Referer": f"https://{seller}.x.yupoo.com/"}
                ir = requests.get(img_url, headers=img_headers, timeout=15)
                if ir.status_code == 200:
                    im = PILImage.open(BytesIO(ir.content)).convert("RGB")
                    im.thumbnail((130, 130), PILImage.Resampling.LANCZOS)
                    # Paste onto clean white 130x130 square canvas for uniform Excel cell layout
                    canvas = PILImage.new("RGB", (130, 130), (255, 255, 255))
                    offset = ((130 - im.width) // 2, (130 - im.height) // 2)
                    canvas.paste(im, offset)
                    canvas.save(img_path, format="PNG")
                else:
                    img_path = None

        # Clean summary description
        desc_lines = []
        for line in raw_sub.splitlines():
            line = line.strip()
            if not line or line.startswith("http") or re.match(r"^[-_—]+$", line):
                continue
            desc_lines.append(line)
        short_desc = " | ".join(desc_lines)
        if len(short_desc) > 260:
            short_desc = short_desc[:257] + "..."
        if status_code == 404:
            short_desc = "Album was deleted or hidden on Yupoo (HTTP 404)."

        return {
            "url": url,
            "seller": seller,
            "album_id": album_id,
            "status_code": status_code,
            "title": clean_title,
            "raw_title": raw_title,
            "brand": brand,
            "category": category,
            "available_sizes": avail_sizes or "See album",
            "price_cny": price,
            "weidian_url": weidian_url,
            "description": short_desc,
            "img_path": img_path,
            "order_status": "Pending" if status_code == 200 else "Offline (404)",
        }
    except Exception as e:
        return {
            "url": url,
            "seller": seller,
            "album_id": album_id,
            "status_code": 0,
            "title": f"Error scraping {album_id}",
            "raw_title": "",
            "brand": "—",
            "category": "—",
            "available_sizes": "—",
            "price_cny": None,
            "weidian_url": "",
            "description": str(e),
            "img_path": None,
            "order_status": "Error",
        }


def build_excel():
    all_urls = list(dict.fromkeys(u for urls in ORDERS.values() for u in urls))
    print(f"Scraping {len(all_urls)} URLs...")
    with ThreadPoolExecutor(max_workers=8) as ex:
        scraped_list = list(ex.map(scrape_item, all_urls))
    scraped_map = {item["url"]: item for item in scraped_list}

    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Styles
    header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    offline_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    input_fill = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid")  # subtle highlight for editable fields
    total_fill = PatternFill(start_color="E5E7EB", end_color="E5E7EB", fill_type="solid")

    thin_side = Side(border_style="thin", color="D1D5DB")
    border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    font_regular = Font(name="Calibri", size=10, color="111827")
    font_bold = Font(name="Calibri", size=10, bold=True, color="111827")
    font_muted = Font(name="Calibri", size=9, color="4B5563")
    font_link = Font(name="Calibri", size=10, color="2563EB", underline="single")
    font_price = Font(name="Calibri", size=11, bold=True, color="065F46")

    headers = [
        "#",
        "Product Image",
        "Product Title",
        "Brand",
        "Category",
        "Seller",
        "Available Sizes / Specs",
        "Size",
        "Price (CNY ¥)",
        "Order Status",
        "Scraped Details / Description",
        "Yupoo Link",
        "Buy / Weidian Link",
    ]

    col_widths = [5, 19, 34, 20, 20, 14, 24, 14, 15, 18, 45, 22, 22]

    for person, urls in ORDERS.items():
        ws = wb.create_sheet(title=person)
        ws.views.sheetView[0].showGridLines = True
        ws.freeze_panes = "D2"

        # Header Row
        ws.row_dimensions[1].height = 28
        for col_idx, h_text in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=h_text)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border
            ws.column_dimensions[get_column_letter(col_idx)].width = col_widths[col_idx - 1]

        # Data Validation for Order Status (Col J = 10)
        dv = DataValidation(
            type="list",
            formula1='"Pending,To Order,Ordered,In Warehouse (QC),Shipped,Delivered,Cancelled,Offline (404)"',
            allow_blank=True,
        )
        ws.add_data_validation(dv)

        for idx, url in enumerate(urls, start=1):
            row_num = idx + 1
            item = scraped_map[url]
            ws.row_dimensions[row_num].height = 105  # ~140px height to fit 130x130 image with padding

            row_fill = offline_fill if item["status_code"] == 404 else (zebra_fill if idx % 2 == 0 else white_fill)

            # 1. #
            c1 = ws.cell(row=row_num, column=1, value=idx)
            c1.alignment = Alignment(horizontal="center", vertical="center")
            c1.font = font_bold

            # 2. Product Image
            c2 = ws.cell(row=row_num, column=2, value="" if item["img_path"] else "No Image (404)")
            c2.alignment = Alignment(horizontal="center", vertical="center")
            c2.font = font_muted
            if item["img_path"] and os.path.exists(item["img_path"]):
                img = XLImage(item["img_path"])
                img.width = 125
                img.height = 125
                ws.add_image(img, f"B{row_num}")

            # 3. Product Title
            c3 = ws.cell(row=row_num, column=3, value=item["title"])
            c3.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            c3.font = font_bold

            # 4. Brand
            c4 = ws.cell(row=row_num, column=4, value=item["brand"])
            c4.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c4.font = font_regular

            # 5. Category
            c5 = ws.cell(row=row_num, column=5, value=item["category"])
            c5.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c5.font = font_regular

            # 6. Seller
            c6 = ws.cell(row=row_num, column=6, value=item["seller"])
            c6.alignment = Alignment(horizontal="center", vertical="center")
            c6.font = font_regular

            # 7. Available Sizes / Specs
            c7 = ws.cell(row=row_num, column=7, value=item["available_sizes"])
            c7.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c7.font = font_muted

            # 8. Chosen Size (User editable column)
            c8 = ws.cell(row=row_num, column=8, value="")
            c8.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c8.font = font_bold

            # 9. Price (CNY ¥)
            c9 = ws.cell(row=row_num, column=9, value=item["price_cny"])
            c9.alignment = Alignment(horizontal="right", vertical="center")
            c9.font = font_price
            if item["price_cny"] is not None:
                c9.number_format = '¥#,##0.00'

            # 10. Order Status
            c10 = ws.cell(row=row_num, column=10, value=item["order_status"])
            c10.alignment = Alignment(horizontal="center", vertical="center")
            c10.font = font_bold
            dv.add(c10)

            # 11. Scraped Details / Description
            c11 = ws.cell(row=row_num, column=11, value=item["description"])
            c11.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            c11.font = font_muted

            # 12. Yupoo Link
            c12 = ws.cell(row=row_num, column=12, value="Open Yupoo Album")
            c12.hyperlink = item["url"]
            c12.alignment = Alignment(horizontal="center", vertical="center")
            c12.font = font_link

            # 13. Buy / Weidian Link
            if item["weidian_url"]:
                c13 = ws.cell(row=row_num, column=13, value="Open Weidian Link")
                c13.hyperlink = item["weidian_url"]
                c13.font = font_link
            else:
                c13 = ws.cell(row=row_num, column=13, value="—")
                c13.font = font_muted
            c13.alignment = Alignment(horizontal="center", vertical="center")

            for col_i in range(1, len(headers) + 1):
                cell = ws.cell(row=row_num, column=col_i)
                cell.border = border
                if col_i in (8, 9, 10) and item["status_code"] == 200:
                    cell.fill = input_fill
                else:
                    cell.fill = row_fill

        # Total Row at the bottom of the sheet
        total_row = len(urls) + 2
        ws.row_dimensions[total_row].height = 26
        for col_i in range(1, len(headers) + 1):
            tc = ws.cell(row=total_row, column=col_i)
            tc.fill = total_fill
            tc.border = border
            tc.font = font_bold

        ws.cell(row=total_row, column=3, value=f"Total ({len(urls)} items)").alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=total_row, column=8, value="Total Known Price:").alignment = Alignment(horizontal="right", vertical="center")
        sum_cell = ws.cell(row=total_row, column=9, value=f"=SUM(I2:I{total_row - 1})")
        sum_cell.number_format = '¥#,##0.00'
        sum_cell.alignment = Alignment(horizontal="right", vertical="center")
        sum_cell.font = font_price

        # Enable AutoFilter
        ws.auto_filter.ref = f"A1:M{total_row - 1}"

    out_path = "/Users/mathis/Desktop/FashionOrders/FashionOrders.xlsx"
    wb.save(out_path)
    print(f"Saved Excel workbook to {out_path}")

    # Also save scraped metadata JSON for reference
    with open("/Users/mathis/Desktop/FashionOrders/scraped_data.json", "w", encoding="utf-8") as f:
        json.dump(scraped_list, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    build_excel()
