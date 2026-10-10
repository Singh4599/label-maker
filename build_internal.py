import pandas as pd
import json
import os

OUT_FILE = 'js/internal-data.js'

df = pd.read_excel('ALL PRODUCT NAME.xlsx')
# Drop completely empty rows
df = df.dropna(how='all')

prods = {}
variants = {}

for _, row in df.iterrows():
    name = str(row.get('PRODUCT NAME', '')).strip()
    if not name or name.lower() == 'nan':
        continue
        
    batch = str(row.get('BATCHCODE', '')).strip()
    if batch.lower() == 'nan':
        batch = ''
        
    # We create a simple product structure similar to others
    prods[name] = {
        'n': name,
        'c': 'INTERNAL',
        'icon': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        'b': batch
    }
    
    # We'll just provide a default 10kg variant, user can override weight in UI
    variants[name] = [
        { 'd': '10 Kg', 'g': 10000, 'm': 0, 'bn': batch }
    ]

p_js = json.dumps(prods, ensure_ascii=False, indent=2)
v_js = json.dumps(variants, ensure_ascii=False, indent=2)

js = f"""'use strict';
// Auto-generated from ALL PRODUCT NAME.xlsx
const INTERNAL_DB = {{
  p: {p_js},
  v: {v_js}
}};
"""

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(js)

print(f"Generated {OUT_FILE} with {len(prods)} products.")
