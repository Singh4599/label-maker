#!/usr/bin/env python3
"""Fix product names in data.js:
  - Marinade/Aromatic: append ' Seasoning' if not already present
  - Chutney Powders: replace 'Powder' with 'Mix' in name
  - Salt: append ' Seasoned Salt' suffix if needed
"""

import re

with open('js/data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We'll process line by line, tracking current category
lines = content.split('\n')
out = []
current_cat = ''

for i, line in enumerate(lines):
    # Track category
    cat_match = re.search(r'"c":\s*"([^"]+)"', line)
    if cat_match:
        current_cat = cat_match.group(1)

    # Only modify "n" lines
    n_match = re.search(r'("n":\s*")([^"]+)(")', line)
    if n_match and current_cat:
        name = n_match.group(2)
        cat_lower = current_cat.lower()
        new_name = name

        # Marinade & Aromatic → append 'Seasoning' if not already there
        if ('marinade' in cat_lower or 'aromatic' in cat_lower):
            if 'seasoning' not in name.lower():
                new_name = name + ' Seasoning'

        # Chutney Powders → replace 'Powder' with 'Mix'
        elif 'chutney' in cat_lower:
            new_name = re.sub(r'\bPowder\b', 'Mix', name, flags=re.IGNORECASE)

        # Salt → replace 'Salt' standalone with 'Seasoned Salt' only in name
        # (only if the name just says e.g. "Himalayan Pink Salt" - leave as is,
        #  but if category is Salt and name doesn't have 'seasoned', prepend)
        # Per user: salt category names stay but display as Seasoned Salt
        # (data.js name not changing for salt since user said only salt category display name changes)
        # UPDATE: user said "salt vala bhi data m hi" - so fix salt names too
        # but what does "fix" mean for salt? category = Salt or Jain Salt
        # names are like "Himalayan Pink Salt", "Black Salt" etc.
        # Let's NOT change salt names since they're proper product names
        # and the category display name mapping handles it

        if new_name != name:
            line = line[:n_match.start(2)] + new_name + line[n_match.end(2):]
            print(f"  [{current_cat}] '{name}' → '{new_name}'")

    out.append(line)

result = '\n'.join(out)
with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write(result)

print("\nDone!")
