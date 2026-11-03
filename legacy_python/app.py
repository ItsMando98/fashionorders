import os
import re
import json
import secrets
import sqlite3
import hashlib
import urllib.parse
from io import BytesIO
from datetime import datetime
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup
from PIL import Image as PILImage
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as XLImage
from openpyxl.worksheet.datavalidation import DataValidation

from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "fashion_orders.db")
IMG_DIR = os.path.join(BASE_DIR, ".cache_images")
STATIC_DIR = os.path.join(BASE_DIR, "static")
SCRAPED_SEED_JSON = os.path.join(BASE_DIR, "scraped_data.json")

os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

INITIAL_LINKS = {
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
    ],
}

app = FastAPI(title="FashionOrders — Member & Admin Platform")
app.mount("/images", StaticFiles(directory=IMG_DIR), name="images")


def hash_password(pw: str) -> str:
    return hashlib.sha256(f"fashionorders_salt_{pw}".encode("utf-8")).hexdigest()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_column(cur, table: str, col: str, col_def: str):
    cur.execute(f"PRAGMA table_info({table})")
    existing = [r["name"] for r in cur.fetchall()]
    if col not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'friend',
            pin TEXT NOT NULL DEFAULT '1234',
            password_hash TEXT DEFAULT '',
            share_all_friends INTEGER NOT NULL DEFAULT 0,
            avatar_initials TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    ensure_column(cur, "users", "password_hash", "TEXT DEFAULT ''")
    ensure_column(cur, "users", "share_all_friends", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(cur, "users", "custom_item_fixed_eur", "REAL DEFAULT NULL")
    ensure_column(cur, "users", "custom_item_percent", "REAL DEFAULT NULL")
    ensure_column(cur, "users", "custom_haul_percent", "REAL DEFAULT NULL")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS order_shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            shared_with_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(owner_id, shared_with_user_id),
            FOREIGN KEY(owner_id) REFERENCES users(id),
            FOREIGN KEY(shared_with_user_id) REFERENCES users(id)
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            weidian_url TEXT DEFAULT '',
            source_platform TEXT DEFAULT 'Yupoo',
            seller TEXT DEFAULT '',
            title TEXT NOT NULL,
            brand TEXT DEFAULT '—',
            category TEXT DEFAULT 'Apparel / Item',
            available_sizes TEXT DEFAULT '',
            chosen_size TEXT DEFAULT '',
            color_variant TEXT DEFAULT '',
            quantity INTEGER NOT NULL DEFAULT 1,
            price_cny REAL,
            shipping_cny REAL DEFAULT 0,
            stage TEXT NOT NULL DEFAULT 'submitted',
            order_status TEXT NOT NULL DEFAULT 'Pending',
            is_shared INTEGER NOT NULL DEFAULT 1,
            description TEXT DEFAULT '',
            user_notes TEXT DEFAULT '',
            admin_notes TEXT DEFAULT '',
            tracking_number TEXT DEFAULT '',
            image_url TEXT DEFAULT '',
            local_image TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    ensure_column(cur, "items", "is_shared", "INTEGER NOT NULL DEFAULT 1")
    ensure_column(cur, "items", "custom_fee_fixed_eur", "REAL DEFAULT NULL")
    ensure_column(cur, "items", "custom_fee_percent", "REAL DEFAULT NULL")

    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('cny_to_eur', '0.13')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_item_fixed_eur', '0.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_item_percent', '0.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_haul_percent', '0.0')")

    # Seed users if empty
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] == 0:
        now = datetime.utcnow().isoformat()
        seed_users = [
            ("Mathis", "admin", "admin123", hash_password("admin123"), 1, "MA", now),
            ("Tom Luis", "friend", "1234", hash_password("1234"), 1, "TL", now),
            ("Fynn", "friend", "1234", hash_password("1234"), 1, "FY", now),
        ]
        cur.executemany(
            """
            INSERT INTO users (name, role, pin, password_hash, share_all_friends, avatar_initials, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            seed_users,
        )
        conn.commit()
    else:
        # Ensure existing seeded users have password_hash set
        cur.execute("SELECT id, name, role, password_hash FROM users")
        for u in cur.fetchall():
            if not u["password_hash"]:
                default_pw = "admin123" if u["role"] == "admin" else "1234"
                cur.execute(
                    "UPDATE users SET password_hash = ?, pin = ? WHERE id = ?",
                    (hash_password(default_pw), default_pw, u["id"]),
                )
        conn.commit()

    # Seed initial 41 scraped items if items table is empty
    cur.execute("SELECT COUNT(*) FROM items")
    if cur.fetchone()[0] == 0 and os.path.exists(SCRAPED_SEED_JSON):
        with open(SCRAPED_SEED_JSON, "r", encoding="utf-8") as f:
            scraped_list = json.load(f)
        scraped_map = {item["url"]: item for item in scraped_list}

        cur.execute("SELECT id, name FROM users")
        user_map = {row["name"]: row["id"] for row in cur.fetchall()}
        now = datetime.utcnow().isoformat()

        for person_name, urls in INITIAL_LINKS.items():
            uid = user_map.get(person_name)
            if not uid:
                continue
            for url in urls:
                s = scraped_map.get(url)
                if not s:
                    continue
                local_img = ""
                if s.get("img_path") and os.path.exists(s["img_path"]):
                    local_img = f"/images/{os.path.basename(s['img_path'])}"
                status = s.get("order_status", "Pending")
                cur.execute(
                    """
                    INSERT INTO items (
                        user_id, url, weidian_url, source_platform, seller,
                        title, brand, category, available_sizes, chosen_size,
                        color_variant, quantity, price_cny, shipping_cny,
                        stage, order_status, is_shared, description, user_notes, admin_notes,
                        tracking_number, image_url, local_image, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        uid,
                        url,
                        s.get("weidian_url", ""),
                        "Yupoo",
                        s.get("seller", ""),
                        s.get("title", "Untitled Item"),
                        s.get("brand", "—"),
                        s.get("category", "Apparel / Item"),
                        s.get("available_sizes", "See album"),
                        "",
                        "",
                        1,
                        s.get("price_cny"),
                        0.0,
                        "submitted",
                        status,
                        s.get("description", ""),
                        "",
                        "",
                        "",
                        "",
                        local_img,
                        now,
                        now,
                    ),
                )
        conn.commit()
    conn.close()


def get_fee_settings(conn=None) -> dict:
    close_after = False
    if conn is None:
        conn = get_db()
        close_after = True
    cur = conn.cursor()
    cur.execute(
        "SELECT key, value FROM settings WHERE key IN ('cny_to_eur', 'default_item_fixed_eur', 'default_item_percent', 'default_haul_percent')"
    )
    res = {r["key"]: float(r["value"]) for r in cur.fetchall()}
    if close_after:
        conn.close()
    return {
        "cny_to_eur": res.get("cny_to_eur", 0.13),
        "default_item_fixed_eur": res.get("default_item_fixed_eur", 0.0),
        "default_item_percent": res.get("default_item_percent", 0.0),
        "default_haul_percent": res.get("default_haul_percent", 0.0),
    }


def get_cny_to_eur_rate(conn=None) -> float:
    return get_fee_settings(conn)["cny_to_eur"]


def enrich_item_dict(row_dict: dict, rate: float, user_overrides: dict = None, global_settings: dict = None) -> dict:
    d = dict(row_dict)
    cny = d.get("price_cny")
    qty = d.get("quantity") or 1

    g_fixed = global_settings.get("default_item_fixed_eur", 0.0) if global_settings else 0.0
    g_percent = global_settings.get("default_item_percent", 0.0) if global_settings else 0.0

    u_fixed = user_overrides.get("custom_item_fixed_eur") if user_overrides else None
    u_percent = user_overrides.get("custom_item_percent") if user_overrides else None

    item_custom_fixed = d.get("custom_fee_fixed_eur")
    item_custom_percent = d.get("custom_fee_percent")

    effective_fixed_eur = item_custom_fixed if item_custom_fixed is not None else (u_fixed if u_fixed is not None else g_fixed)
    effective_percent = item_custom_percent if item_custom_percent is not None else (u_percent if u_percent is not None else g_percent)

    d["effective_fee_fixed_eur"] = round(effective_fixed_eur, 2)
    d["effective_fee_percent"] = round(effective_percent, 2)
    d["has_item_fee_override"] = (item_custom_fixed is not None) or (item_custom_percent is not None)

    if cny is not None:
        base_eur = round(float(cny) * rate, 2)
        percent_eur = round(base_eur * (effective_percent / 100.0), 2)
        total_fee_unit = round(effective_fixed_eur + percent_eur, 2)
        final_unit_eur = round(base_eur + total_fee_unit, 2)

        d["base_price_cny"] = round(float(cny), 2)
        d["base_price_eur"] = base_eur
        d["fee_unit_eur"] = total_fee_unit
        d["price_eur"] = final_unit_eur

        d["line_base_cny"] = round(float(cny) * qty, 2)
        d["line_base_eur"] = round(base_eur * qty, 2)
        d["line_fee_eur"] = round(total_fee_unit * qty, 2)
        d["line_total_eur"] = round(final_unit_eur * qty, 2)
        d["line_total_cny"] = round(float(cny) * qty, 2)
    else:
        d["base_price_cny"] = None
        d["base_price_eur"] = None
        d["fee_unit_eur"] = round(effective_fixed_eur, 2)
        d["price_eur"] = None
        d["line_base_cny"] = None
        d["line_base_eur"] = None
        d["line_fee_eur"] = round(effective_fixed_eur * qty, 2)
        d["line_total_eur"] = None
        d["line_total_cny"] = None

    return d


def compute_haul_summary(items: list, user_dict: dict, global_settings: dict) -> dict:
    g_haul_percent = global_settings.get("default_haul_percent", 0.0)
    u_haul_percent = user_dict.get("custom_haul_percent")
    effective_haul_percent = u_haul_percent if u_haul_percent is not None else g_haul_percent

    base_eur_sum = sum((i.get("line_base_eur") or 0.0) for i in items if i.get("line_base_eur"))
    base_cny_sum = sum((i.get("line_base_cny") or 0.0) for i in items if i.get("line_base_cny"))
    item_fees_sum = sum((i.get("line_fee_eur") or 0.0) for i in items if i.get("line_fee_eur"))
    subtotal_eur = round(base_eur_sum + item_fees_sum, 2)

    haul_fee_eur = round(subtotal_eur * (effective_haul_percent / 100.0), 2)
    final_total_eur = round(subtotal_eur + haul_fee_eur, 2)
    total_admin_profit_eur = round(item_fees_sum + haul_fee_eur, 2)

    return {
        "user_id": user_dict["id"],
        "user_name": user_dict["name"],
        "items_count": len(items),
        "base_eur_sum": round(base_eur_sum, 2),
        "base_cny_sum": round(base_cny_sum, 2),
        "item_fees_sum": round(item_fees_sum, 2),
        "subtotal_eur": subtotal_eur,
        "haul_fee_percent": round(effective_haul_percent, 2),
        "haul_fee_eur": haul_fee_eur,
        "final_total_eur": final_total_eur,
        "total_admin_profit_eur": total_admin_profit_eur,
        "custom_item_fixed_eur": user_dict.get("custom_item_fixed_eur"),
        "custom_item_percent": user_dict.get("custom_item_percent"),
        "custom_haul_percent": user_dict.get("custom_haul_percent"),
    }


# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> dict:
    raw_token = None
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.id, u.name, u.role, u.share_all_friends, u.custom_item_fixed_eur, u.custom_item_percent, u.custom_haul_percent, u.avatar_initials, u.created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (raw_token,),
    )
    user = cur.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return dict(user)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required (Mathis only)")
    return user


# ============================================================================
# MULTI-PLATFORM SCRAPER ENGINE
# ============================================================================

def fetch_weidian_sku_data(weidian_url: str):
    m = re.search(r"(?:itemID|itemId)=(\d+)", weidian_url, re.I)
    if not m:
        return {}
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
        img_url = ""
        for attr in res.get("attrList", []):
            vals = []
            for v in attr.get("attrValues", []):
                if v.get("attrValue"):
                    vals.append(v["attrValue"].strip())
                if not img_url and v.get("img"):
                    img_url = v["img"]
            if vals:
                sizes.append(", ".join(vals))
        if not img_url and res.get("skuInfos"):
            for sku in res["skuInfos"]:
                pic = sku.get("skuInfo", {}).get("img")
                if pic:
                    img_url = pic
                    break

        return {
            "item_id": item_id,
            "title": res.get("itemTitle") or "",
            "price_cny": price,
            "available_sizes": " | ".join(sizes)[:120] if sizes else "",
            "img_url": img_url,
        }
    except Exception:
        return {}


def extract_price_from_text(text: str):
    if not text:
        return None
    patterns = [
        r"(?:[¥￥💰]\s*)(\d{2,5}(?:\.\d{1,2})?)(?:\b|\s|,|$)",
        r"(?:Price|price|售价|价格)\s*[:：]?\s*[¥￥]?\s*(\d{2,5}(?:\.\d{1,2})?)",
        r"\b(\d{2,4})\s*(?:CNY|RMB|yuan|元)\b",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            return float(m.group(1))
    return None


def extract_sizes_from_text(title: str, subtitle: str, fallback_sizes: str = ""):
    combined = f"{title}\n{subtitle}"
    if "M50-66kg" in combined:
        return "M (50-66kg), L (65-75kg), XL (75-85kg), XXL (85-100kg)"
    if "S：" in combined and "XXL:" in combined:
        return "S, M, L, XL, XXL"
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
            if len(val) <= 70 and not val.lower().startswith("suggest") and "perfect" not in val.lower():
                return val
    if fallback_sizes:
        return fallback_sizes[:90]
    return "See album"


def detect_brand_and_category(title: str, subtitle: str, url: str):
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
        ([r"\bnk\b", r"\bnike\b"], "Nike"),
        ([r"\bberluti\b"], "Berluti"),
        ([r"\blp\b", r"loro piana", r"babouche", r"summer charms"], "Loro Piana (LP)"),
        ([r"\bmiu\b", r"miu-"], "Miu Miu"),
        ([r"\bugg\b"], "UGG"),
        ([r"\bdg\b", r"dolce"], "Dolce & Gabbana (D&G)"),
        ([r"\bgoyard\b"], "Goyard"),
        ([r"acne studios", r"\bacne\b"], "Acne Studios"),
        ([r"\bze\b", r"zegna"], "Zegna"),
        ([r"\bloewe\b"], "Loewe"),
        ([r"\bow\b", r"off-white"], "Off-White"),
        ([r"\bbv\b", r"bottega", r"\bjodie\b"], "Bottega Veneta (BV)"),
        ([r"su\*", r"supreme", r"manicure"], "Supreme"),
        ([r"\bcrtz\b", r"corteiz"], "Corteiz (CRTZ)"),
        ([r"\bpatagonia\b", r"pata\*\*a"], "Patagonia"),
        ([r"chr hearts", r"chrome hearts", r"\bchro\b"], "Chrome Hearts"),
        ([r"hermès", r"hermes"], "Hermès"),
        ([r"\bbc\b", r"brunello"], "Brunello Cucinelli (BC)"),
        ([r"\bchanel\b"], "Chanel"),
        ([r"\bdior\b"], "Dior"),
        ([r"\bgucci\b"], "Gucci"),
        ([r"\bmoncler\b"], "Moncler"),
        ([r"stone island"], "Stone Island"),
        ([r"stussy", r"stüssy"], "Stüssy"),
        ([r"pet-only"], "SwagSupply (Pet Add-on)"),
    ]
    for patterns, b_name in brand_map:
        if any(re.search(p, t_low) for p in patterns) or any(re.search(p, full_low) for p in patterns):
            brand = b_name
            break

    cat = "Apparel / Item"
    cat_map = [
        (["coat", "jacket", "down jacket", "parka", "windbreaker"], "Jacket / Coat"),
        (["hoodie", "sweater", "cardigan", "knit", "sweatshirt"], "Hoodie / Knitwear"),
        (["t-shirt", "short sleeves", "tee", "polo", "shirt"], "T-Shirt / Top"),
        (["jeans", "pants", "trousers", "shorts", "jogging"], "Pants / Jeans"),
        (["underwear", "boxer", "内裤", "brief"], "Underwear"),
        (["cap", "hat", "balaclava", "beanie", "头套"], "Headwear"),
        (["scarf", "shawl"], "Scarf"),
        (["bag", "jodie", "backpack", "niki", "tote", "duffle", "pouch", "lemon yellow k0884"], "Bag / Leather Goods"),
        (["card holder", "wallet", "卡包"], "Card Holder / Wallet"),
        (["cigar box", "cigar"], "Accessory / Cigar Case"),
        (["manicure", "指甲"], "Accessory / Manicure Set"),
        (["shoes", "mocasin", "tazz", "running shoes", "sneaker", "boot", "loafers", "sandal"], "Footwear"),
        (["pet-only"], "Special / Pet Item"),
    ]
    for keys, c_name in cat_map:
        if any(k in full_low for k in keys):
            cat = c_name
            break
    if "4890255" in url and not title:
        cat = "Leather Jacket (SSB Factory)"
    return brand, cat


def download_and_cache_thumbnail(img_url: str, referer: str, cache_key: str) -> str:
    if not img_url or "logo1@558" in img_url:
        return ""
    if img_url.startswith("//"):
        img_url = "https:" + img_url
    filename = f"{cache_key}.png"
    filepath = os.path.join(IMG_DIR, filename)
    if os.path.exists(filepath):
        return f"/images/{filename}"
    try:
        img_headers = {**HEADERS, "Referer": referer}
        ir = requests.get(img_url, headers=img_headers, timeout=12)
        if ir.status_code == 200 and len(ir.content) > 500:
            im = PILImage.open(BytesIO(ir.content)).convert("RGB")
            im.thumbnail((240, 240), PILImage.Resampling.LANCZOS)
            canvas = PILImage.new("RGB", (240, 240), (255, 255, 255))
            offset = ((240 - im.width) // 2, (240 - im.height) // 2)
            canvas.paste(im, offset)
            canvas.save(filepath, format="PNG")
            return f"/images/{filename}"
    except Exception:
        pass
    return ""


def scrape_any_url(url: str, rate: float = 0.13) -> dict:
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    parsed_url = urllib.parse.urlparse(url)
    host = parsed_url.netloc.lower()
    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]

    # 1. Direct Weidian link
    if "weidian.com" in host:
        wd = fetch_weidian_sku_data(url)
        title = wd.get("title") or f"Weidian Item ({wd.get('item_id', 'Link')})"
        brand, category = detect_brand_and_category(title, wd.get("available_sizes", ""), url)
        local_img = download_and_cache_thumbnail(
            wd.get("img_url", ""), "https://weidian.com/", f"weidian_{wd.get('item_id', url_hash)}"
        )
        cny = wd.get("price_cny")
        return {
            "url": url,
            "weidian_url": url,
            "source_platform": "Weidian",
            "seller": "Weidian Seller",
            "status_code": 200 if wd.get("title") else 206,
            "title": title,
            "brand": brand,
            "category": category,
            "available_sizes": wd.get("available_sizes") or "See Weidian SKU",
            "price_cny": cny,
            "price_eur": round(cny * rate, 2) if cny is not None else None,
            "description": f"Scraped directly from Weidian SKU API (Item ID: {wd.get('item_id', 'N/A')})",
            "local_image": local_img,
            "order_status": "Pending",
        }

    # 2. Yupoo Album link
    if "yupoo.com" in host:
        seller_match = re.search(r"https?://([^.]+)\.x\.yupoo\.com", url)
        seller = seller_match.group(1) if seller_match else "yupoo"
        album_match = re.search(r"albums/(\d+)", url)
        album_id = album_match.group(1) if album_match else url_hash

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

            weidian_url = ""
            for a in (sub_el.select("a[href]") if sub_el else []):
                href = a["href"]
                if "external?url=" in href:
                    qs = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                    if "url" in qs:
                        href = urllib.parse.unquote(urllib.parse.unquote(qs["url"][0]))
                if "weidian.com" in href or "taobao.com" in href:
                    weidian_url = href
                elif "yupoo.com/albums" in href and not weidian_url:
                    try:
                        r2 = requests.get(href, headers=HEADERS, timeout=10)
                        s2 = BeautifulSoup(r2.text, "html.parser")
                        sub2 = s2.select_one(".showalbumheader__gallerysubtitle")
                        if sub2:
                            m_wd = re.search(r"https?://[^\s<>\"]*(?:weidian|taobao)\.com[^\s<>\"]*", sub2.get_text())
                            if m_wd:
                                weidian_url = m_wd.group(0)
                    except Exception:
                        pass

            if not weidian_url:
                m_wd = re.search(r"https?://[^\s<>\"]*(?:weidian|taobao)\.com[^\s<>\"]*", raw_sub)
                if m_wd:
                    weidian_url = m_wd.group(0)

            price = extract_price_from_text(raw_title) or extract_price_from_text(raw_sub)
            wd_data = {}
            if weidian_url and "weidian.com" in weidian_url:
                wd_data = fetch_weidian_sku_data(weidian_url)
                if price is None and wd_data.get("price_cny") is not None:
                    price = wd_data["price_cny"]

            avail_sizes = extract_sizes_from_text(raw_title, raw_sub, wd_data.get("available_sizes", ""))
            brand, category = detect_brand_and_category(raw_title, raw_sub, url)

            if not raw_title:
                if "4890255" in url:
                    clean_title = f"[Offline Album #{album_id}] SSB Factory Leather Jacket"
                else:
                    clean_title = f"[Offline Album #{album_id}] Album Unavailable"
            else:
                clean_title = re.sub(r"^(?:[¥￥💰]\s*\d+[\s,]*|🏷️\s*)+", "", raw_title).strip() or raw_title

            local_img = ""
            if status_code == 200 and img_url:
                local_img = download_and_cache_thumbnail(
                    img_url, f"https://{seller}.x.yupoo.com/", f"{seller}_{album_id}"
                )

            desc_lines = [
                ln.strip()
                for ln in raw_sub.splitlines()
                if ln.strip() and not ln.strip().startswith("http") and not re.match(r"^[-_—]+$", ln.strip())
            ]
            short_desc = " | ".join(desc_lines)
            if len(short_desc) > 280:
                short_desc = short_desc[:277] + "..."
            if status_code == 404:
                short_desc = "Album was deleted or hidden on Yupoo (HTTP 404)."

            return {
                "url": url,
                "weidian_url": weidian_url,
                "source_platform": "Yupoo",
                "seller": seller,
                "status_code": status_code,
                "title": clean_title,
                "brand": brand,
                "category": category,
                "available_sizes": avail_sizes,
                "price_cny": price,
                "price_eur": round(price * rate, 2) if price is not None else None,
                "description": short_desc,
                "local_image": local_img,
                "order_status": "Pending" if status_code == 200 else "Offline (404)",
            }
        except Exception as e:
            return {
                "url": url,
                "weidian_url": "",
                "source_platform": "Yupoo",
                "seller": seller,
                "status_code": 500,
                "title": f"Yupoo Album #{album_id}",
                "brand": "—",
                "category": "Apparel / Item",
                "available_sizes": "See album",
                "price_cny": None,
                "price_eur": None,
                "description": f"Could not reach page: {str(e)}",
                "local_image": "",
                "order_status": "Pending",
            }

    # 3. Taobao / Tmall / 1688 / Generic Web URL
    platform = "Taobao" if "taobao.com" in host or "tmall.com" in host else ("1688" if "1688.com" in host else "Web")
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        soup = BeautifulSoup(r.text, "html.parser")
        og_title = soup.select_one('meta[property="og:title"]')
        og_desc = soup.select_one('meta[property="og:description"], meta[name="description"]')
        og_img = soup.select_one('meta[property="og:image"]')
        page_title = soup.title.get_text(strip=True) if soup.title else ""

        title = (og_title["content"].strip() if og_title and og_title.get("content") else page_title) or f"{platform} Product"
        desc = og_desc["content"].strip() if og_desc and og_desc.get("content") else ""
        img_url = og_img["content"].strip() if og_img and og_img.get("content") else ""

        tb_id_match = re.search(r"[?&]id=(\d+)", url)
        if ("登录" in title or "login" in title.lower() or not title) and tb_id_match:
            title = f"{platform} Item #{tb_id_match.group(1)}"

        price = extract_price_from_text(title) or extract_price_from_text(desc)
        brand, category = detect_brand_and_category(title, desc, url)
        sizes = extract_sizes_from_text(title, desc)
        local_img = download_and_cache_thumbnail(img_url, f"https://{host}/", f"{platform.lower()}_{url_hash}")

        return {
            "url": url,
            "weidian_url": url if platform in ("Taobao", "1688") else "",
            "source_platform": platform,
            "seller": host.replace("www.", ""),
            "status_code": r.status_code,
            "title": title,
            "brand": brand,
            "category": category,
            "available_sizes": sizes,
            "price_cny": price,
            "price_eur": round(price * rate, 2) if price is not None else None,
            "description": desc[:280] if desc else f"Imported from {platform}",
            "local_image": local_img,
            "order_status": "Pending",
        }
    except Exception as e:
        return {
            "url": url,
            "weidian_url": "",
            "source_platform": platform,
            "seller": host,
            "status_code": 200,
            "title": f"{platform} Link ({url_hash[:6]})",
            "brand": "—",
            "category": "Apparel / Item",
            "available_sizes": "See link",
            "price_cny": None,
            "price_eur": None,
            "description": f"Link saved ({str(e)[:80]})",
            "local_image": "",
            "order_status": "Pending",
        }


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class LoginRequest(BaseModel):
    name: str
    password: str


class SignupRequest(BaseModel):
    name: str
    password: str


class ScrapeRequest(BaseModel):
    url: str


class BulkScrapeRequest(BaseModel):
    urls: List[str]
    stage: Optional[str] = "cart"


class ItemCreate(BaseModel):
    url: str
    weidian_url: Optional[str] = ""
    source_platform: Optional[str] = "Yupoo"
    seller: Optional[str] = ""
    title: str
    brand: Optional[str] = "—"
    category: Optional[str] = "Apparel / Item"
    available_sizes: Optional[str] = ""
    chosen_size: Optional[str] = ""
    color_variant: Optional[str] = ""
    quantity: Optional[int] = 1
    price_cny: Optional[float] = None
    price_eur_override: Optional[float] = None
    stage: Optional[str] = "cart"
    order_status: Optional[str] = "In Cart"
    is_shared: Optional[int] = 1
    description: Optional[str] = ""
    user_notes: Optional[str] = ""
    local_image: Optional[str] = ""
    custom_fee_fixed_eur: Optional[float] = None
    custom_fee_percent: Optional[float] = None


class ItemUpdate(BaseModel):
    title: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    chosen_size: Optional[str] = None
    color_variant: Optional[str] = None
    quantity: Optional[int] = None
    price_cny: Optional[float] = None
    shipping_cny: Optional[float] = None
    stage: Optional[str] = None
    order_status: Optional[str] = None
    is_shared: Optional[int] = None
    user_notes: Optional[str] = None
    admin_notes: Optional[str] = None
    tracking_number: Optional[str] = None
    weidian_url: Optional[str] = None
    custom_fee_fixed_eur: Optional[float] = None
    custom_fee_percent: Optional[float] = None


class SharePreferencesUpdate(BaseModel):
    share_all_friends: int
    shared_with_user_ids: List[int] = []


class BulkStatusRequest(BaseModel):
    item_ids: List[int]
    order_status: Optional[str] = None
    stage: Optional[str] = None


class SettingsUpdate(BaseModel):
    cny_to_eur: Optional[float] = None
    default_item_fixed_eur: Optional[float] = None
    default_item_percent: Optional[float] = None
    default_haul_percent: Optional[float] = None


class UserFeeUpdate(BaseModel):
    custom_item_fixed_eur: Optional[float] = None
    custom_item_percent: Optional[float] = None
    custom_haul_percent: Optional[float] = None
    reset_item_fixed: Optional[bool] = False
    reset_item_percent: Optional[bool] = False
    reset_haul_percent: Optional[bool] = False


# ============================================================================
# API ROUTES
# ============================================================================

@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/api/auth/login")
def api_login(payload: LoginRequest):
    name = payload.name.strip()
    pw_hash = hash_password(payload.password.strip())
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, role, pin, password_hash, share_all_friends, avatar_initials, created_at FROM users WHERE LOWER(name) = LOWER(?)",
        (name,),
    )
    user = cur.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Account not found. Please sign up or check your username.")

    if user["password_hash"] != pw_hash and user["pin"] != payload.password.strip():
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid password.")

    token = secrets.token_hex(24)
    now = datetime.utcnow().isoformat()
    cur.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", (token, user["id"], now))
    conn.commit()
    conn.close()

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "role": user["role"],
            "share_all_friends": user["share_all_friends"],
            "avatar_initials": user["avatar_initials"],
        },
    }


@app.post("/api/auth/signup")
def api_signup(payload: SignupRequest):
    name = payload.name.strip()
    pw = payload.password.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters.")
    if len(pw) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters.")

    parts = [p for p in name.split() if p]
    initials = (parts[0][0] + (parts[1][0] if len(parts) > 1 else parts[0][1:2])).upper()
    now = datetime.utcnow().isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE LOWER(name) = LOWER(?)", (name,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this name already exists. Please log in.")

    pw_hash = hash_password(pw)
    cur.execute(
        """
        INSERT INTO users (name, role, pin, password_hash, share_all_friends, avatar_initials, created_at)
        VALUES (?, 'friend', ?, ?, 1, ?, ?)
        """,
        (name, pw, pw_hash, initials, now),
    )
    user_id = cur.lastrowid
    token = secrets.token_hex(24)
    cur.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", (token, user_id, now))
    conn.commit()
    conn.close()

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "role": "friend",
            "share_all_friends": 1,
            "avatar_initials": initials,
        },
    }


@app.post("/api/auth/logout")
def api_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        conn = get_db()
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"status": "logged_out"}


@app.get("/api/workspace")
def api_get_workspace(current_user: dict = Depends(get_current_user)):
    """
    Returns strict role-separated data with fee calculations:
    - Member ('friend'):
      * my_items: their own items enriched with fee calculations
      * my_haul_summary: item fees + haul % markup breakdown
      * shared_items: items from other friends shared with this user
      * friends_directory: list of friends
    - Admin ('Mathis'):
      * All above + admin_all_items, admin_users, and admin_haul_summaries per member.
    """
    conn = get_db()
    cur = conn.cursor()
    fee_settings = get_fee_settings(conn)
    rate = fee_settings["cny_to_eur"]

    # All users to have their individual fee overrides
    cur.execute(
        """
        SELECT id, name, role, avatar_initials, share_all_friends,
               custom_item_fixed_eur, custom_item_percent, custom_haul_percent
        FROM users ORDER BY id ASC
        """
    )
    all_users_rows = [dict(r) for r in cur.fetchall()]
    users_map = {u["id"]: u for u in all_users_rows}
    user_override = users_map.get(current_user["id"], current_user)

    # 1. Current user's own items
    cur.execute(
        """
        SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
        FROM items i
        JOIN users u ON u.id = i.user_id
        WHERE i.user_id = ?
        ORDER BY i.id DESC
        """,
        (current_user["id"],),
    )
    my_items = [enrich_item_dict(r, rate, user_override, fee_settings) for r in cur.fetchall()]
    my_haul_summary = compute_haul_summary(my_items, user_override, fee_settings)

    # 2. Friends directory (for sharing UI)
    friends_directory = [
        {"id": u["id"], "name": u["name"], "avatar_initials": u["avatar_initials"], "role": u["role"]}
        for u in all_users_rows
        if u["id"] != current_user["id"]
    ]

    # 3. Who current_user shares with
    cur.execute("SELECT shared_with_user_id FROM order_shares WHERE owner_id = ?", (current_user["id"],))
    my_share_targets = [r["shared_with_user_id"] for r in cur.fetchall()]

    # 4. Shared Orders visible to current_user
    cur.execute(
        """
        SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
        FROM items i
        JOIN users u ON u.id = i.user_id
        WHERE i.user_id != ?
          AND i.is_shared = 1
          AND (
              u.share_all_friends = 1
              OR EXISTS (
                  SELECT 1 FROM order_shares os
                  WHERE os.owner_id = i.user_id AND os.shared_with_user_id = ?
              )
          )
        ORDER BY i.id DESC
        """,
        (current_user["id"], current_user["id"]),
    )
    shared_items = [enrich_item_dict(r, rate, users_map.get(r["user_id"]), fee_settings) for r in cur.fetchall()]

    response_data = {
        "current_user": user_override,
        "settings": {
            "cny_to_eur": rate,
            "eur_to_cny": round(1.0 / rate, 2) if rate > 0 else 7.69,
            "default_item_fixed_eur": fee_settings["default_item_fixed_eur"],
            "default_item_percent": fee_settings["default_item_percent"],
            "default_haul_percent": fee_settings["default_haul_percent"],
        },
        "my_items": my_items,
        "my_haul_summary": my_haul_summary,
        "shared_items": shared_items,
        "friends_directory": friends_directory,
        "my_share_targets": my_share_targets,
    }

    # 5. If Admin (Mathis), include full master backend dataset + per-member haul summaries
    if current_user["role"] == "admin":
        cur.execute(
            """
            SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
            FROM items i
            JOIN users u ON u.id = i.user_id
            ORDER BY i.id DESC
            """
        )
        admin_all_items = [enrich_item_dict(r, rate, users_map.get(r["user_id"]), fee_settings) for r in cur.fetchall()]
        response_data["admin_all_items"] = admin_all_items
        response_data["admin_users"] = all_users_rows
        response_data["admin_haul_summaries"] = [
            compute_haul_summary([i for i in admin_all_items if i["user_id"] == u["id"]], u, fee_settings)
            for u in all_users_rows
        ]

    conn.close()
    return response_data


@app.put("/api/shares/preferences")
def api_update_share_preferences(
    payload: SharePreferencesUpdate, current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET share_all_friends = ? WHERE id = ?",
        (1 if payload.share_all_friends else 0, current_user["id"]),
    )
    cur.execute("DELETE FROM order_shares WHERE owner_id = ?", (current_user["id"],))
    now = datetime.utcnow().isoformat()
    for target_id in payload.shared_with_user_ids:
        if target_id != current_user["id"]:
            cur.execute(
                "INSERT OR IGNORE INTO order_shares (owner_id, shared_with_user_id, created_at) VALUES (?, ?, ?)",
                (current_user["id"], target_id, now),
            )
    conn.commit()
    conn.close()
    return {
        "share_all_friends": 1 if payload.share_all_friends else 0,
        "shared_with_user_ids": payload.shared_with_user_ids,
    }


@app.post("/api/shares/clone/{item_id}")
def api_clone_shared_item(item_id: int, current_user: dict = Depends(get_current_user)):
    """Allows a user to copy an item from a friend's shared order into their own cart."""
    conn = get_db()
    cur = conn.cursor()
    rate = get_cny_to_eur_rate(conn)
    cur.execute("SELECT * FROM items WHERE id = ?", (item_id,))
    src = cur.fetchone()
    if not src:
        conn.close()
        raise HTTPException(status_code=404, detail="Shared item not found")

    now = datetime.utcnow().isoformat()
    cur.execute(
        """
        INSERT INTO items (
            user_id, url, weidian_url, source_platform, seller,
            title, brand, category, available_sizes, chosen_size,
            color_variant, quantity, price_cny, shipping_cny,
            stage, order_status, is_shared, description, user_notes, admin_notes,
            tracking_number, image_url, local_image, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'cart', 'In Cart', 1, ?, '', '', '', ?, ?, ?, ?)
        """,
        (
            current_user["id"],
            src["url"],
            src["weidian_url"],
            src["source_platform"],
            src["seller"],
            src["title"],
            src["brand"],
            src["category"],
            src["available_sizes"],
            src["chosen_size"],
            src["color_variant"],
            src["price_cny"],
            src["description"],
            src["image_url"],
            src["local_image"],
            now,
            now,
        ),
    )
    new_id = cur.lastrowid
    conn.commit()
    cur.execute(
        """
        SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
        FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?
        """,
        (new_id,),
    )
    cloned = enrich_item_dict(cur.fetchone(), rate)
    conn.close()
    return cloned


@app.post("/api/scrape")
def api_scrape_single(payload: ScrapeRequest, current_user: dict = Depends(get_current_user)):
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="Please provide a valid URL")
    rate = get_cny_to_eur_rate()
    return scrape_any_url(payload.url, rate)


@app.post("/api/scrape/bulk")
def api_scrape_bulk(payload: BulkScrapeRequest, current_user: dict = Depends(get_current_user)):
    clean_urls = [u.strip() for u in payload.urls if u and u.strip()]
    if not clean_urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    rate = get_cny_to_eur_rate()
    with ThreadPoolExecutor(max_workers=6) as ex:
        scraped_results = list(ex.map(lambda u: scrape_any_url(u, rate), clean_urls))

    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    created_items = []

    for s in scraped_results:
        stage = payload.stage or "cart"
        status = "In Cart" if stage == "cart" else s.get("order_status", "Pending")
        if s.get("status_code") == 404:
            status = "Offline (404)"
        cur.execute(
            """
            INSERT INTO items (
                user_id, url, weidian_url, source_platform, seller,
                title, brand, category, available_sizes, chosen_size,
                color_variant, quantity, price_cny, shipping_cny,
                stage, order_status, is_shared, description, user_notes, admin_notes,
                tracking_number, image_url, local_image, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"],
                s["url"],
                s.get("weidian_url", ""),
                s.get("source_platform", "Yupoo"),
                s.get("seller", ""),
                s.get("title", "Scraped Item"),
                s.get("brand", "—"),
                s.get("category", "Apparel / Item"),
                s.get("available_sizes", "See album"),
                "",
                "",
                1,
                s.get("price_cny"),
                0.0,
                stage,
                status,
                s.get("description", ""),
                "",
                "",
                "",
                "",
                s.get("local_image", ""),
                now,
                now,
            ),
        )
        new_id = cur.lastrowid
        cur.execute(
            """
            SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
            FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?
            """,
            (new_id,),
        )
        created_items.append(enrich_item_dict(cur.fetchone(), rate))

    conn.commit()
    conn.close()
    return {"added": len(created_items), "items": created_items}


@app.post("/api/items")
def api_create_item(payload: ItemCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    fee_settings = get_fee_settings(conn)
    rate = fee_settings["cny_to_eur"]
    now = datetime.utcnow().isoformat()
    stage = payload.stage or "cart"
    status = payload.order_status or ("In Cart" if stage == "cart" else "Pending")

    price_cny = payload.price_cny
    if price_cny is None and payload.price_eur_override is not None and rate > 0:
        price_cny = round(payload.price_eur_override / rate, 2)

    cur.execute(
        """
        INSERT INTO items (
            user_id, url, weidian_url, source_platform, seller,
            title, brand, category, available_sizes, chosen_size,
            color_variant, quantity, price_cny, shipping_cny,
            stage, order_status, is_shared, description, user_notes, admin_notes,
            tracking_number, image_url, local_image, custom_fee_fixed_eur, custom_fee_percent, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?, ?, ?)
        """,
        (
            current_user["id"],
            payload.url,
            payload.weidian_url or "",
            payload.source_platform or "Yupoo",
            payload.seller or "",
            payload.title,
            payload.brand or "—",
            payload.category or "Apparel / Item",
            payload.available_sizes or "",
            payload.chosen_size or "",
            payload.color_variant or "",
            payload.quantity or 1,
            price_cny,
            stage,
            status,
            1 if payload.is_shared is None else payload.is_shared,
            payload.description or "",
            payload.user_notes or "",
            payload.local_image or "",
            payload.custom_fee_fixed_eur,
            payload.custom_fee_percent,
            now,
            now,
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    cur.execute(
        """
        SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
        FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?
        """,
        (new_id,),
    )
    item = enrich_item_dict(cur.fetchone(), rate, current_user, fee_settings)
    conn.close()
    return item


@app.patch("/api/items/{item_id}")
def api_update_item(item_id: int, payload: ItemUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    fee_settings = get_fee_settings(conn)
    rate = fee_settings["cny_to_eur"]
    cur.execute("SELECT * FROM items WHERE id = ?", (item_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    if current_user["role"] != "admin" and existing["user_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only edit your own items")

    updates = payload.dict(exclude_unset=True)
    if current_user["role"] != "admin":
        updates.pop("admin_notes", None)
        updates.pop("tracking_number", None)
        updates.pop("custom_fee_fixed_eur", None)
        updates.pop("custom_fee_percent", None)

    cur.execute("SELECT * FROM users WHERE id = ?", (existing["user_id"],))
    owner_user = dict(cur.fetchone())

    if not updates:
        res = enrich_item_dict(existing, rate, owner_user, fee_settings)
        conn.close()
        return res

    updates["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = list(updates.values()) + [item_id]
    cur.execute(f"UPDATE items SET {set_clause} WHERE id = ?", values)
    conn.commit()

    cur.execute(
        """
        SELECT i.*, u.name as user_name, u.avatar_initials as user_initials
        FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?
        """,
        (item_id,),
    )
    updated = enrich_item_dict(cur.fetchone(), rate, owner_user, fee_settings)
    conn.close()
    return updated


@app.delete("/api/items/{item_id}")
def api_delete_item(item_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM items WHERE id = ?", (item_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
    if current_user["role"] != "admin" and existing["user_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Not permitted")
    cur.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"deleted": item_id}


@app.post("/api/orders/submit")
def api_submit_cart(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    cur.execute(
        """
        UPDATE items
        SET stage = 'submitted',
            order_status = CASE WHEN order_status = 'In Cart' THEN 'Pending' ELSE order_status END,
            updated_at = ?
        WHERE user_id = ? AND stage = 'cart'
        """,
        (now, current_user["id"]),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.post("/api/admin/bulk-status")
def api_bulk_status(payload: BulkStatusRequest, admin_user: dict = Depends(require_admin)):
    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="No items selected")
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    placeholders = ",".join("?" for _ in payload.item_ids)
    if payload.order_status:
        stage = "cart" if payload.order_status == "In Cart" else "submitted"
        cur.execute(
            f"UPDATE items SET order_status = ?, stage = ?, updated_at = ? WHERE id IN ({placeholders})",
            [payload.order_status, stage, now] + payload.item_ids,
        )
    conn.commit()
    conn.close()
    return {"updated": len(payload.item_ids)}


@app.patch("/api/admin/settings")
def api_update_settings(payload: SettingsUpdate, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cur = conn.cursor()
    if payload.cny_to_eur is not None:
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('cny_to_eur', ?)", (str(payload.cny_to_eur),))
    if payload.default_item_fixed_eur is not None:
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_item_fixed_eur', ?)", (str(payload.default_item_fixed_eur),))
    if payload.default_item_percent is not None:
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_item_percent', ?)", (str(payload.default_item_percent),))
    if payload.default_haul_percent is not None:
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_haul_percent', ?)", (str(payload.default_haul_percent),))
    conn.commit()
    settings = get_fee_settings(conn)
    conn.close()
    return settings


@app.patch("/api/admin/users/{target_user_id}/fees")
def api_update_user_fees(target_user_id: int, payload: UserFeeUpdate, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (target_user_id,))
    user_row = cur.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    updates = []
    params = []

    if payload.reset_item_fixed:
        updates.append("custom_item_fixed_eur = NULL")
    elif payload.custom_item_fixed_eur is not None:
        updates.append("custom_item_fixed_eur = ?")
        params.append(payload.custom_item_fixed_eur)

    if payload.reset_item_percent:
        updates.append("custom_item_percent = NULL")
    elif payload.custom_item_percent is not None:
        updates.append("custom_item_percent = ?")
        params.append(payload.custom_item_percent)

    if payload.reset_haul_percent:
        updates.append("custom_haul_percent = NULL")
    elif payload.custom_haul_percent is not None:
        updates.append("custom_haul_percent = ?")
        params.append(payload.custom_haul_percent)

    if updates:
        params.append(target_user_id)
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (target_user_id,))
    updated_user = dict(cur.fetchone())
    conn.close()
    return updated_user


@app.get("/api/export/excel")
def api_export_excel(current_user: dict = Depends(get_current_user)):
    """
    Exports Excel workbook (.xlsx):
    - If Admin (Mathis): exports all users (each friend on their own sheet)
    - If Member: exports their own sheet
    Includes Base Price (CNY ¥), Base Price (EUR €), Item Fee (€), and Final Price (EUR €),
    plus Haul Handling Fee & Grand Total formulas!
    """
    conn = get_db()
    cur = conn.cursor()
    fee_settings = get_fee_settings(conn)
    rate = fee_settings["cny_to_eur"]

    if current_user["role"] == "admin":
        cur.execute(
            """
            SELECT id, name, role, avatar_initials, share_all_friends,
                   custom_item_fixed_eur, custom_item_percent, custom_haul_percent
            FROM users ORDER BY id ASC
            """
        )
        users = [dict(r) for r in cur.fetchall()]
    else:
        cur.execute(
            """
            SELECT id, name, role, avatar_initials, share_all_friends,
                   custom_item_fixed_eur, custom_item_percent, custom_haul_percent
            FROM users WHERE id = ?
            """,
            (current_user["id"],),
        )
        users = [dict(cur.fetchone())]

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    header_fill = PatternFill(start_color="18181B", end_color="18181B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    zebra_fill = PatternFill(start_color="FAFAFA", end_color="FAFAFA", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    offline_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    input_fill = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid")
    total_fill = PatternFill(start_color="E4E4E7", end_color="E4E4E7", fill_type="solid")
    grand_total_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")

    thin_side = Side(border_style="thin", color="E4E4E7")
    border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    font_regular = Font(name="Calibri", size=10, color="18181B")
    font_bold = Font(name="Calibri", size=10, bold=True, color="18181B")
    font_muted = Font(name="Calibri", size=9, color="71717A")
    font_link = Font(name="Calibri", size=10, color="2563EB", underline="single")
    font_price = Font(name="Calibri", size=11, bold=True, color="15803D")
    font_grand = Font(name="Calibri", size=12, bold=True, color="166534")

    headers = [
        "#",
        "Product Image",
        "Product Title",
        "Brand",
        "Category",
        "Seller",
        "Available Sizes / Specs",
        "Size",
        "Color / Variant",
        "Qty",
        "Base Price (CNY ¥)",
        "Base Price (EUR €)",
        "Admin Fee (€)",
        "Final Price (EUR €)",
        "Order Status",
        "Notes / QC / Tracking",
        "Product Link",
        "Buy / Weidian Link",
    ]
    col_widths = [5, 19, 34, 20, 20, 14, 24, 14, 16, 7, 16, 16, 14, 16, 18, 36, 20, 20]

    for u in users:
        cur.execute("SELECT * FROM items WHERE user_id = ? ORDER BY id ASC", (u["id"],))
        raw_items = [dict(r) for r in cur.fetchall()]
        if not raw_items and u["name"] not in ("Tom Luis", "Fynn", "Mathis") and current_user["role"] == "admin":
            continue

        u_items = [enrich_item_dict(r, rate, u, fee_settings) for r in raw_items]
        haul_summary = compute_haul_summary(u_items, u, fee_settings)

        ws = wb.create_sheet(title=u["name"][:31])
        ws.views.sheetView[0].showGridLines = True
        ws.freeze_panes = "D2"

        ws.row_dimensions[1].height = 28
        for col_idx, h_text in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=h_text)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border
            ws.column_dimensions[get_column_letter(col_idx)].width = col_widths[col_idx - 1]

        dv = DataValidation(
            type="list",
            formula1='"In Cart,Pending,To Order,Ordered,In Warehouse (QC),Shipped,Delivered,Cancelled,Offline (404)"',
            allow_blank=True,
        )
        ws.add_data_validation(dv)

        for idx, item in enumerate(u_items, start=1):
            row_num = idx + 1
            ws.row_dimensions[row_num].height = 105
            is_offline = "404" in (item["order_status"] or "")
            row_fill = offline_fill if is_offline else (zebra_fill if idx % 2 == 0 else white_fill)

            ws.cell(row=row_num, column=1, value=idx).alignment = Alignment(horizontal="center", vertical="center")
            ws.cell(row=row_num, column=1).font = font_bold

            img_file = ""
            if item.get("local_image"):
                img_file = os.path.join(IMG_DIR, os.path.basename(item["local_image"]))
            c2 = ws.cell(row=row_num, column=2, value="" if os.path.exists(img_file) else "No Image")
            c2.alignment = Alignment(horizontal="center", vertical="center")
            c2.font = font_muted
            if img_file and os.path.exists(img_file):
                img = XLImage(img_file)
                img.width = 125
                img.height = 125
                ws.add_image(img, f"B{row_num}")

            c3 = ws.cell(row=row_num, column=3, value=item["title"])
            c3.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            c3.font = font_bold

            c4 = ws.cell(row=row_num, column=4, value=item["brand"])
            c4.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c4.font = font_regular

            c5 = ws.cell(row=row_num, column=5, value=item["category"])
            c5.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c5.font = font_regular

            c6 = ws.cell(row=row_num, column=6, value=item["seller"])
            c6.alignment = Alignment(horizontal="center", vertical="center")
            c6.font = font_regular

            c7 = ws.cell(row=row_num, column=7, value=item["available_sizes"])
            c7.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c7.font = font_muted

            c8 = ws.cell(row=row_num, column=8, value=item["chosen_size"] or "")
            c8.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c8.font = font_bold

            c9 = ws.cell(row=row_num, column=9, value=item["color_variant"] or "")
            c9.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c9.font = font_regular

            qty = item["quantity"] or 1
            c10 = ws.cell(row=row_num, column=10, value=qty)
            c10.alignment = Alignment(horizontal="center", vertical="center")
            c10.font = font_bold

            # 11. Base Price CNY
            c11 = ws.cell(row=row_num, column=11, value=item["line_base_cny"])
            c11.alignment = Alignment(horizontal="right", vertical="center")
            c11.font = font_price
            if item["line_base_cny"] is not None:
                c11.number_format = "¥#,##0.00"

            # 12. Base Price EUR
            c12 = ws.cell(row=row_num, column=12, value=item["line_base_eur"])
            c12.alignment = Alignment(horizontal="right", vertical="center")
            c12.font = font_price
            if item["line_base_eur"] is not None:
                c12.number_format = "€#,##0.00"

            # 13. Admin Fee EUR (Item markup)
            c13 = ws.cell(row=row_num, column=13, value=item["line_fee_eur"])
            c13.alignment = Alignment(horizontal="right", vertical="center")
            c13.font = font_price
            if item["line_fee_eur"] is not None:
                c13.number_format = "€#,##0.00"

            # 14. Final Price EUR
            c14 = ws.cell(row=row_num, column=14, value=item["line_total_eur"])
            c14.alignment = Alignment(horizontal="right", vertical="center")
            c14.font = font_price
            if item["line_total_eur"] is not None:
                c14.number_format = "€#,##0.00"

            c15 = ws.cell(row=row_num, column=15, value=item["order_status"])
            c15.alignment = Alignment(horizontal="center", vertical="center")
            c15.font = font_bold
            dv.add(c15)

            notes_parts = [p for p in [item.get("user_notes"), item.get("admin_notes"), item.get("tracking_number"), item.get("description")] if p]
            c16 = ws.cell(row=row_num, column=16, value=" | ".join(notes_parts)[:260])
            c16.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            c16.font = font_muted

            c17 = ws.cell(row=row_num, column=17, value="Open Product Link")
            c17.hyperlink = item["url"]
            c17.alignment = Alignment(horizontal="center", vertical="center")
            c17.font = font_link

            if item.get("weidian_url"):
                c18 = ws.cell(row=row_num, column=18, value="Open Buy Link")
                c18.hyperlink = item["weidian_url"]
                c18.font = font_link
            else:
                c18 = ws.cell(row=row_num, column=18, value="—")
                c18.font = font_muted
            c18.alignment = Alignment(horizontal="center", vertical="center")

            for col_i in range(1, len(headers) + 1):
                cell = ws.cell(row=row_num, column=col_i)
                cell.border = border
                if col_i in (8, 11, 14, 15) and not is_offline:
                    cell.fill = input_fill
                else:
                    cell.fill = row_fill

        # Row 1: Subtotals (Base, Fees, Subtotal)
        total_row = len(u_items) + 2
        ws.row_dimensions[total_row].height = 26
        for col_i in range(1, len(headers) + 1):
            tc = ws.cell(row=total_row, column=col_i)
            tc.fill = total_fill
            tc.border = border
            tc.font = font_bold

        ws.cell(row=total_row, column=3, value=f"Subtotal ({len(u_items)} items)").alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=total_row, column=10, value="Subtotal:").alignment = Alignment(horizontal="right", vertical="center")

        sum_cny = ws.cell(row=total_row, column=11, value=f"=SUM(K2:K{total_row - 1})" if u_items else 0)
        sum_cny.number_format = "¥#,##0.00"
        sum_cny.alignment = Alignment(horizontal="right", vertical="center")
        sum_cny.font = font_price

        sum_base_eur = ws.cell(row=total_row, column=12, value=f"=SUM(L2:L{total_row - 1})" if u_items else 0)
        sum_base_eur.number_format = "€#,##0.00"
        sum_base_eur.alignment = Alignment(horizontal="right", vertical="center")
        sum_base_eur.font = font_price

        sum_fees_eur = ws.cell(row=total_row, column=13, value=f"=SUM(M2:M{total_row - 1})" if u_items else 0)
        sum_fees_eur.number_format = "€#,##0.00"
        sum_fees_eur.alignment = Alignment(horizontal="right", vertical="center")
        sum_fees_eur.font = font_price

        sum_final_eur = ws.cell(row=total_row, column=14, value=f"=SUM(N2:N{total_row - 1})" if u_items else 0)
        sum_final_eur.number_format = "€#,##0.00"
        sum_final_eur.alignment = Alignment(horizontal="right", vertical="center")
        sum_final_eur.font = font_price

        # Row 2: Member Haul Percentage Fee (if any)
        haul_pct_row = total_row + 1
        ws.row_dimensions[haul_pct_row].height = 24
        for col_i in range(1, len(headers) + 1):
            tc = ws.cell(row=haul_pct_row, column=col_i)
            tc.fill = total_fill
            tc.border = border
            tc.font = font_bold

        pct = haul_summary["haul_fee_percent"]
        ws.cell(row=haul_pct_row, column=3, value=f"Haul Handling Markup (+{pct}%)").alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=haul_pct_row, column=10, value=f"+{pct}%:").alignment = Alignment(horizontal="right", vertical="center")
        c_haul_fee = ws.cell(row=haul_pct_row, column=14, value=haul_summary["haul_fee_eur"])
        c_haul_fee.number_format = "€#,##0.00"
        c_haul_fee.alignment = Alignment(horizontal="right", vertical="center")
        c_haul_fee.font = font_price

        # Row 3: Final Grand Total
        grand_row = haul_pct_row + 1
        ws.row_dimensions[grand_row].height = 28
        for col_i in range(1, len(headers) + 1):
            tc = ws.cell(row=grand_row, column=col_i)
            tc.fill = grand_total_fill
            tc.border = border
            tc.font = font_grand

        ws.cell(row=grand_row, column=3, value="FINAL GRAND TOTAL FOR HAUL").alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=grand_row, column=10, value="Grand Total:").alignment = Alignment(horizontal="right", vertical="center")
        c_grand = ws.cell(row=grand_row, column=14, value=f"=N{total_row} + N{haul_pct_row}")
        c_grand.number_format = "€#,##0.00"
        c_grand.alignment = Alignment(horizontal="right", vertical="center")
        c_grand.font = font_grand

    conn.close()

    if current_user["role"] == "admin":
        disk_path = os.path.join(BASE_DIR, "FashionOrders.xlsx")
        wb.save(disk_path)

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    filename = "FashionOrders_Master.xlsx" if current_user["role"] == "admin" else f"FashionOrders_{current_user['name'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

    if current_user["role"] == "admin":
        disk_path = os.path.join(BASE_DIR, "FashionOrders.xlsx")
        wb.save(disk_path)

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    filename = "FashionOrders_Master.xlsx" if current_user["role"] == "admin" else f"FashionOrders_{current_user['name'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/health")
def health_check():
    return {"status": "ok"}

