import re
import sys

data = {
    "GOLDEN TURMERIC POWDER": {"e": 312, "p": 9.7, "cb": 67.1, "tf": 3.3, "so": 38, "ts": 3.2, "as": 0},
    "SELAM TURMERIC POWDER": {"e": 312, "p": 9.7, "cb": 67.1, "tf": 3.3, "so": 38, "ts": 3.2, "as": 0},
    "CHILLI POWDER KASHMIRI": {"e": 300, "p": 12.0, "cb": 50.0, "tf": 16.0, "so": 30, "ts": 7.2, "as": 0},
    "MALVANI MIX SPECIAL MASALA": {"e": 350, "p": 12.0, "cb": 50.0, "tf": 14.0, "so": 1200, "ts": 3.0, "as": 0},
    "CORIANDER GREEN SEASONING": {"e": 310, "p": 12.0, "cb": 55.0, "tf": 18.0, "so": 35, "ts": 2.0, "as": 0},
    "DHANAJEERA (MIX MASALA POWDER)": {"e": 350, "p": 12.0, "cb": 50.0, "tf": 14.0, "so": 1200, "ts": 3.0, "as": 0},
    "CORIANDER SARAS SEASONING": {"e": 310, "p": 12.0, "cb": 55.0, "tf": 18.0, "so": 35, "ts": 2.0, "as": 0},
    "RESHAMPATTI KHANDELA CHILLI BLEND SEASONING": {"e": 250, "p": 9.0, "cb": 40.0, "tf": 12.0, "so": 8000, "ts": 5.0, "as": 0},
    "DANDICUT KHANDELA CHILLI BLEND SEASONING": {"e": 250, "p": 9.0, "cb": 40.0, "tf": 12.0, "so": 8000, "ts": 5.0, "as": 0},
    "PALITANA KHANDELA CHILLI BLEND SEASONING": {"e": 250, "p": 9.0, "cb": 40.0, "tf": 12.0, "so": 8000, "ts": 5.0, "as": 0},
    "KASHMIRI KHANDELA CHILLI BLEND SEASONING": {"e": 250, "p": 9.0, "cb": 40.0, "tf": 12.0, "so": 8000, "ts": 5.0, "as": 0},
    "CHILLI POWDER SP  LAL": {"e": 300, "p": 12.0, "cb": 50.0, "tf": 16.0, "so": 30, "ts": 7.2, "as": 0},
    "CHILLI POWDER SP LAL UNCHA": {"e": 300, "p": 12.0, "cb": 50.0, "tf": 16.0, "so": 30, "ts": 7.2, "as": 0},
    "GINGER SEASONING": {"e": 335, "p": 8.0, "cb": 70.0, "tf": 5.0, "so": 27, "ts": 2.0, "as": 0},
    "CUMIN SEASONING": {"e": 385, "p": 17.4, "cb": 43.3, "tf": 23.8, "so": 165, "ts": 2.2, "as": 0},
    "DRY MANGO SEASONING": {"e": 320, "p": 3.5, "cb": 75.0, "tf": 3.0, "so": 25, "ts": 45.0, "as": 0},
    "BLACK PEPPER SEASONING": {"e": 255, "p": 10.4, "cb": 64.0, "tf": 3.3, "so": 20, "ts": 0.6, "as": 0},
    "METHI SEASONING": {"e": 325, "p": 23.0, "cb": 58.0, "tf": 7.0, "so": 67, "ts": 0.0, "as": 0},
    "CORIANDER SEASONING": {"e": 310, "p": 12.0, "cb": 55.0, "tf": 18.0, "so": 35, "ts": 2.0, "as": 0},
    "SAMBHAR CHILLI BLEND SEASONING": {"e": 250, "p": 9.0, "cb": 40.0, "tf": 12.0, "so": 8000, "ts": 5.0, "as": 0},
    "SAMBHAR KASHMIRI CHILLI BLEND SEASONING": {"e": 250, "p": 9.0, "cb": 40.0, "tf": 12.0, "so": 8000, "ts": 5.0, "as": 0},
    "JEERA SUPER": {"e": 385, "p": 17.4, "cb": 43.3, "tf": 23.8, "so": 165, "ts": 2.2, "as": 0},
    "RAI": {"e": 508, "p": 26.0, "cb": 28.0, "tf": 36.0, "so": 13, "ts": 0.0, "as": 0},
    "RAJWADI GARAM MASALA": {"e": 350, "p": 12.0, "cb": 50.0, "tf": 14.0, "so": 1200, "ts": 3.0, "as": 0},
    "STICKER SIZE- 50 X 90 MM": {"e": 0, "p": 0, "cb": 0, "tf": 0, "so": 0, "ts": 0, "as": 0}
}

file_path = 'js/dukan-data.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

for prod, vals in data.items():
    # Regex to find the block for the specific product and replace its nutrition values
    pattern = rf'("{prod}":\s*{{[^}}]+?"sc":\s*"[^"]*",\s*)"e":\s*\d+,\s*"p":\s*\d+(?:\.\d+)?,\s*"cb":\s*\d+(?:\.\d+)?,\s*"tf":\s*\d+(?:\.\d+)?,\s*"so":\s*\d+(?:\.\d+)?,\s*"ts":\s*\d+(?:\.\d+)?,\s*"as":\s*\d+(?:\.\d+)?'
    replacement = rf'\g<1>"e": {vals["e"]}, "p": {vals["p"]}, "cb": {vals["cb"]}, "tf": {vals["tf"]}, "so": {vals["so"]}, "ts": {vals["ts"]}, "as": {vals["as"]}'
    
    # Try the first regex (with "sc")
    new_content, count = re.subn(pattern, replacement, content, flags=re.DOTALL)
    
    if count == 0:
        # Fallback regex if "sc" is not present (like STICKER SIZE)
        pattern2 = rf'("{prod}":\s*{{[^}}]+?"i":\s*"[^"]*",\s*)"e":\s*\d+,\s*"p":\s*\d+(?:\.\d+)?,\s*"cb":\s*\d+(?:\.\d+)?,\s*"tf":\s*\d+(?:\.\d+)?,\s*"so":\s*\d+(?:\.\d+)?,\s*"ts":\s*\d+(?:\.\d+)?,\s*"as":\s*\d+(?:\.\d+)?'
        new_content, count = re.subn(pattern2, replacement, content, flags=re.DOTALL)

    content = new_content

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated dukan-data.js")
