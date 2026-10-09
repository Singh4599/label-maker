import json
import pandas as pd
import re

def parse_rates_string(rate_str, base_batch):
    variants = []
    if not isinstance(rate_str, str) or not rate_str.strip():
        return [{'d': 'Standard Pack', 'g': 100, 'oz': '3.5oz', 'm': 0, 'bn': base_batch}]
    
    # Split by comma
    parts = rate_str.split(',')
    for part in parts:
        part = part.strip()
        if not part: continue
        # Expecting something like "100 gm-80" or "1 kg- 800"
        m = re.match(r'(.+?)\s*-\s*(\d+)', part)
        if m:
            weight_str = m.group(1).strip().lower()
            price = int(m.group(2))
            
            # parse weight
            g = 100
            d = weight_str
            if 'kg' in weight_str:
                num = float(re.sub(r'[^\d.]', '', weight_str) or 1)
                g = int(num * 1000)
                d = f"{num:g}kg" if num != 1 else "1kg"
            else:
                num = float(re.sub(r'[^\d.]', '', weight_str) or 100)
                g = int(num)
                d = f"{g}g"
                
            oz = f"{(g * 0.035274):.2f}oz".replace('.00', '')
            
            variants.append({
                'd': d,
                'g': g,
                'oz': oz,
                'm': price,
                'bn': base_batch
            })
    
    if not variants:
        variants.append({'d': 'Standard Pack', 'g': 100, 'oz': '3.5oz', 'm': 0, 'bn': base_batch})
    return variants

def parse_excel(filename, var_name, js_file, has_cat=True):
    df = pd.read_excel(filename)
    records = df.to_dict('records')
    valid_p = {}
    valid_v = {}
    
    header_idx = 0
    for i, r in enumerate(records):
        if 'PRODUCT NAME' in str(list(r.values())):
            header_idx = i
            break
            
    col_map = {}
    for k, v in records[header_idx].items():
        if pd.notna(v) and str(v).strip():
            col_map[str(v).strip()] = k
            
    for i in range(header_idx + 1, len(records)):
        r = records[i]
        name = str(r.get(col_map.get('PRODUCT NAME', ''))).strip()
        if not name or name == 'nan': continue
        
        b = str(r.get(col_map.get('BATCH CODE / LOT NUMBER', ''))).strip()
        b = '' if b == 'nan' else b
        
        rates_key = 'RATES' if 'RATES' in col_map else ('MRP/-' if 'MRP/-' in col_map else '')
        rates_str = str(r.get(col_map.get(rates_key, ''))).strip()
        
        p = {'n': name, 'b': b}
        if has_cat:
            c = str(r.get(col_map.get('CATEGORY', ''))).strip()
            p['c'] = '' if c == 'nan' else c
            i_str = str(r.get(col_map.get('INGREDIENT', ''))).strip()
            p['i'] = '' if i_str == 'nan' else i_str
            
            # Find the 6th column dynamically or by unnamed
            keys = list(r.keys())
            if len(keys) >= 6:
                sc = str(r[keys[5]]).strip()
                if sc != 'nan' and sc:
                    p['sc'] = sc
            
            # Arbitrary nutrients for Dukan Bai (user requested)
            p['e'] = 310
            p['p'] = 12
            p['cb'] = 45
            p['tf'] = 14
            p['so'] = 80
            p['ts'] = 2
            p['as'] = 0
            
        valid_p[name] = p
        valid_v[name] = parse_rates_string(rates_str, b)
        
    with open(js_file, 'w') as f:
        f.write(f'const {var_name} = ' + json.dumps({'p': valid_p, 'v': valid_v}, indent=2) + ';\n')

parse_excel('DUKAN BAI STICKER.xlsx', 'DUKAN_DB', 'js/dukan-data.js', True)
parse_excel('32 X 25 MM STICKER.xlsx', 'NEW32_DB', 'js/new32-data.js', False)
