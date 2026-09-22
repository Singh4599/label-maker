"""
Convert enriched_products.csv + 365-Spicery-Pricelist.xlsx → label-maker/js/data.js
Run: python3 build_data.py
"""
import csv, re, json, os, math
import openpyxl

ROOT      = "/Users/dhruvsingh/Desktop/365 Spicery V2"
CSV_FILE  = os.path.join(ROOT, "enriched_products.csv")
PRICE_XLS = os.path.join(ROOT, "label-maker/365-Spicery-Pricelist.xlsx")
OUT_FILE  = os.path.join(ROOT, "label-maker/js/data.js")

# ─── Helpers ────────────────────────────────────────────────
def strip_num(s):
    if not s: return 0
    m = re.search(r'\d+\.?\d*', str(s))
    try:    return float(m.group()) if m else 0
    except: return 0

def norm(s):
    """Normalize product name for fuzzy matching."""
    return re.sub(r'\s+', ' ', str(s).lower().strip())

def round5(n):
    """Round up to nearest 5."""
    return int(math.ceil(n / 5.0)) * 5

ICONS = {
    'Blended Spices'         : '🫙',
    'Seasoning'              : '🌶️',
    'Seasonings'             : '🌶️',
    'Single Spices'          : '🌿',
    'Single Spices Powder'   : '🌿',
    'Whole Spices'           : '🪴',
    'Chilli Powders'         : '🌶️',
    'Chilli Powder'          : '🌶️',
    'Dry Fruits'             : '🥜',
    'Tea'                    : '🍵',
    'Sauce'                  : '🥫',
    'Salt'                   : '🧂',
    'Herbs'                  : '🌿',
    'Paste'                  : '🫙',
    'Spice Mix'              : '🫙',
    'Dip Mix'                : '🥣',
    'Chutney Powders'        : '🟢',
    'Dehydrated'             : '🌾',
    'default'                : '✨'
}

# ─── Step 1: Load price list ────────────────────────────────
print("📖 Reading pricelist...")
price_map = {}   # norm(name) → price_1kg (float)

wb = openpyxl.load_workbook(PRICE_XLS, read_only=True)
for sheet in wb.sheetnames:
    ws = wb[sheet]
    header_skipped = False
    for row in ws.iter_rows(values_only=True):
        if not header_skipped:
            header_skipped = True
            continue
        if not row or not row[1]:
            continue
        name  = str(row[1]).strip()
        price = row[2]
        if isinstance(price, (int, float)) and price > 0:
            price_map[norm(name)] = float(price)

wb.close()
print(f"   Loaded prices for {len(price_map)} products")

# ─── Step 2: Build variants with prices ─────────────────────
def make_variants(name, price_1kg=0):
    prefix = re.sub(r'[^A-Z]', '', name.upper())[:2] or 'XX'
    p1kg = price_1kg or 0

    # Derive smaller pack prices (proportional, rounded to nearest 5)
    # Small packs carry slight premium (~20% for 100g, ~10% for 200g, ~5% for 500g)
    if p1kg > 0:
        p100  = round5(p1kg * 0.122)   # 100g with ~22% premium
        p200  = round5(p1kg * 0.23)    # 200g with ~15% premium
        p500  = round5(p1kg * 0.56)    # 500g with ~12% premium
        p1000 = round5(p1kg)
    else:
        p100 = p200 = p500 = p1000 = 0

    return [
        { 'd': '100g',  'g': 100,  'oz': '3.53oz',  'm': p100,  'bn': f'{prefix}0001' },
        { 'd': '200g',  'g': 200,  'oz': '7.05oz',  'm': p200,  'bn': f'{prefix}0001' },
        { 'd': '500g',  'g': 500,  'oz': '17.64oz', 'm': p500,  'bn': f'{prefix}0001' },
        { 'd': '1 Kg',  'g': 1000, 'oz': '35.27oz', 'm': p1000, 'bn': f'{prefix}0001' },
    ]

# ─── Step 3: Load products + merge prices ───────────────────
print("📖 Reading enriched_products.csv...")
prods    = {}
variants = {}
matched  = 0
no_price = 0

with open(CSV_FILE, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        n = row.get('product_name', '').strip()
        if not n or n in prods:
            continue

        col = row.get('collection', '').strip()

        # Try to find price — exact first, then partial match
        n_norm = norm(n)
        price_1kg = price_map.get(n_norm, 0)
        if not price_1kg:
            # Try partial: find any key that contains our name or vice versa
            for k, v in price_map.items():
                if n_norm in k or k in n_norm:
                    price_1kg = v
                    break

        if price_1kg:
            matched += 1
        else:
            no_price += 1

        prods[n] = {
            'n':    n,
            'c':    col,
            'icon': ICONS.get(col, ICONS['default']),
            'desc': '',
            'i':    row.get('ingredients_english', '').strip() or '—',
            'e':    strip_num(row.get('energy',         0)),
            'p':    strip_num(row.get('protein',        0)),
            'cb':   strip_num(row.get('carbohydrates',  0)),
            'ts':   strip_num(row.get('total_sugar',    0)),
            'as':   strip_num(row.get('added_sugar',    0)),
            'tf':   strip_num(row.get('fat',            0)),
            'sf':   strip_num(row.get('saturated_fat',  0)),
            'tr':   strip_num(row.get('trans_fat',      0)),
            'ch':   strip_num(row.get('cholesterol',    0)),
            'so':   strip_num(row.get('sodium',         0)),
        }
        variants[n] = make_variants(n, price_1kg)

# ─── Step 4: Write data.js ──────────────────────────────────
print(f"\n✅ Products: {len(prods)} total | {matched} with prices | {no_price} without prices")

p_js = json.dumps(prods,    ensure_ascii=False, indent=2)
v_js = json.dumps(variants, ensure_ascii=False, indent=2)

js = f"""'use strict';
// ============================================================
// SPICERY_DB — Auto-generated
// Source:  enriched_products.csv  +  365-Spicery-Pricelist.xlsx
// Total:   {len(prods)} products ({matched} with prices, {no_price} without)
//
// To regenerate after updating source files:
//   cd label-maker && python3 build_data.py
//
// Prices shown are 1-KG WHOLESALE. Derived smaller pack prices
// use proportional scaling. Replace with final retail MRP when
// client provides.
// ============================================================

const SPICERY_DB = {{
  p: {p_js},
  v: {v_js}
}};
"""

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(js)

size_kb = os.path.getsize(OUT_FILE) / 1024
print(f"📁 Written to: {OUT_FILE}")
print(f"   File size:  {size_kb:.1f} KB")
