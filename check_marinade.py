#!/usr/bin/env python3
"""Fix marinade product names: replace trailing 'Marinade Seasoning' back to just 'Marinade'
   then replace 'Marinade' (as the last word) with 'Marinade Seasoning' — no, wait:
   
   User wants: naam ka part ho. Currently names like:
   'Jain Achari Marinade Seasoning' - already in data.js
   
   The visual issue is long name wrapping. Check if we can restructure:
   Actually user said "data m hi name me add kr" - keep it in name.
   
   Just print what marinade names look like now.
"""

import re

with open('js/data.js', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
current_cat = ''

print("=== Current Marinade names ===")
for i, line in enumerate(lines):
    cat_match = re.search(r'"c":\s*"([^"]+)"', line)
    if cat_match:
        current_cat = cat_match.group(1)
    n_match = re.search(r'"n":\s*"([^"]+)"', line)
    if n_match and 'marinade' in current_cat.lower():
        print(f"  {n_match.group(1)}")
