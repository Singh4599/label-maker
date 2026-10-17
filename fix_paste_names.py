#!/usr/bin/env python3
"""Remove '(No Onion No Garlic)' and variants from Jain Paste product names only."""
import re

with open('js/data.js', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
out = []
current_cat = ''
count = 0

for line in lines:
    cat_match = re.search(r'"c":\s*"([^"]+)"', line)
    if cat_match:
        current_cat = cat_match.group(1)

    if current_cat == 'Jain Paste':
        n_match = re.search(r'("n":\s*")([^"]+)(")', line)
        if n_match:
            old = n_match.group(2)
            # Remove (No Onion No Garlic), (No Onion No Garlic Paste), etc.
            new = re.sub(r'\s*\([Nn]o [Oo]nion [Nn]o [Gg]arlic[^)]*\)', '', old).strip()
            if new != old:
                line = line[:n_match.start(2)] + new + line[n_match.end(2):]
                print(f"  '{old}' → '{new}'")
                count += 1

    out.append(line)

with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"\n✅ Fixed {count} product names.")
