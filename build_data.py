"""
Convert enriched_products.csv → label-maker/js/data.js
Run: python3 build_data.py
"""
import csv, re, json, os

ROOT = "/Users/dhruvsingh/Desktop/365 Spicery V2"
CSV_FILE = os.path.join(ROOT, "enriched_products.csv")
OUT_FILE = os.path.join(ROOT, "label-maker/js/data.js")

def strip_num(s):
    if not s: return 0
    m = re.search(r'\d+\.?\d*', str(s))
    try:
        return float(m.group()) if m else 0
    except:
        return 0

ICONS = {
    'Blended Spices': '🫙',
    'Seasoning': '🌶️',
    'Seasonings': '🌶️',
    'Single Spices': '🌿',
    'Single Spices Powder': '🌿',
    'Whole Spices': '🪴',
    'Chilli Powders': '🌶️',
    'Dry Fruits': '🥜',
    'Tea': '🍵',
    'Sauce': '🥫',
    'default': '✨'
}

# Standard variants — price = 0 (PLACEHOLDER, client will provide)
# Batch prefix derived from first 2 letters of product name
def make_variants(name):
    prefix = re.sub(r'[^A-Z]', '', name.upper())[:2] or 'XX'
    return [
        { 'd': '100g',  'g': 100,  'oz': '3.53oz',  'm': 0, 'bn': f'{prefix}0001' },
        { 'd': '200g',  'g': 200,  'oz': '7.05oz',  'm': 0, 'bn': f'{prefix}0001' },
        { 'd': '500g',  'g': 500,  'oz': '17.64oz', 'm': 0, 'bn': f'{prefix}0001' },
        { 'd': '1 Kg',  'g': 1000, 'oz': '35.27oz', 'm': 0, 'bn': f'{prefix}0001' },
    ]

prods = {}
variants = {}

with open(CSV_FILE, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        n = row.get('product_name', '').strip()
        if not n or n in prods:
            continue
        col = row.get('collection', '').strip()
        prods[n] = {
            'n': n,
            'c': col,
            'icon': ICONS.get(col, ICONS['default']),
            'desc': '',
            'i': row.get('ingredients_english', '').strip() or '—',
            'e':  strip_num(row.get('energy', 0)),
            'p':  strip_num(row.get('protein', 0)),
            'cb': strip_num(row.get('carbohydrates', 0)),
            'ts': strip_num(row.get('total_sugar', 0)),
            'as': strip_num(row.get('added_sugar', 0)),
            'tf': strip_num(row.get('fat', 0)),
            'sf': strip_num(row.get('saturated_fat', 0)),
            'tr': strip_num(row.get('trans_fat', 0)),
            'ch': strip_num(row.get('cholesterol', 0)),
            'so': strip_num(row.get('sodium', 0)),
        }
        variants[n] = make_variants(n)

# Build JS
p_js = json.dumps(prods, ensure_ascii=False, indent=2)
v_js = json.dumps(variants, ensure_ascii=False, indent=2)

js = f"""'use strict';
// ============================================================
// SPICERY_DB — Auto-generated from enriched_products.csv
// Total products: {len(prods)}
//
// ⚠️  PRICES ARE PLACEHOLDER (₹0) — Update with client data
//     Replace 'm' values in the variants section below
//     or use the Excel Upload mode to load real prices.
// ============================================================

const SPICERY_DB = {{
  p: {p_js},
  v: {v_js}
}};
"""

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(js)

print(f"✅ Done! {len(prods)} products written to:")
print(f"   {OUT_FILE}")
size_kb = os.path.getsize(OUT_FILE) / 1024
print(f"   File size: {size_kb:.1f} KB")
