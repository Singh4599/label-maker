import pandas as pd
import json

df = pd.read_excel('YELLOW LEBEL 365 SPICERY.xlsx', header=1)
# Col 0: PRODUCT NAME, Col 1: BATCH CODE, Col 2: CATEGORY, Col 3: Unnamed, Col 4: weight, Col 5: INGREDIENT

res = {'p': {}, 'v': {}}
for _, row in df.iterrows():
    name = str(row.iloc[0]).strip()
    if name == 'nan' or name == 'PRODUCT NAME' or name == '': continue
    
    bn = str(row.iloc[1]).strip()
    if bn == 'nan': bn = ''
    
    cat = str(row.iloc[2]).strip()
    if cat == 'nan': cat = ''
    
    note = str(row.iloc[3]).strip()
    if note == 'nan': note = ''
    
    w = str(row.iloc[4]).strip()
    if w == 'nan': w = '50 KG'
    
    ing = str(row.iloc[5]).strip()
    if ing == 'nan': ing = ''

    # Clean up line breaks in ingredient
    ing = " ".join(ing.split())
    
    # MRP is fixed to 10000.00 as per user image for 50 KG, but we'll leave it 0 or calculate if needed.
    # Actually user image has ₹ 10000.00 for 50 KG.
    
    if name not in res['p']:
        res['p'][name] = {
            'n': name,
            'b': bn,
            'c': cat,
            'note': note,
            'i': ing
        }
        res['v'][name] = [
            {'d': w.upper(), 'g': 50000, 'oz': '1763.7oz', 'm': 10000, 'bn': bn}
        ]

print(f"Total products: {len(res['p'])}")
with open('js/parties-data.js', 'w') as f:
    f.write('const PARTIES_DB = ' + json.dumps(res, indent=2) + ';')
