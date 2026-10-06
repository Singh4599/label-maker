# Jain Product Feature — "(No Onion No Garlic)"

## Status: SAVED FOR LATER (reverted from code)

## Requirement
- For ALL products with "JAIN" in the product name
- Add subtitle line: `(No Onion No Garlic)` 
- Should appear as a NEW LINE below the product name
- Both FRONT label and BACK label

## Implementation (ready to re-add)

### TSPL (qz-print.js)

**Front label (`buildFrontTSPL`):**
- After line `const yStart = ...`:
```js
const isJain = n.includes('JAIN');
const jainTag = '(No Onion No Garlic)';
const jainH = isJain ? 28 : 0;
```
- Include `jainH` in `totalH` calculation
- After the main `lines.forEach(...)` loop:
```js
if (isJain) {
  const jy = yStart + lines.length * lineStep;
  const jtW = jainTag.length * 12;
  const jx = Math.max(4, Math.round((W*8 - jtW) / 2));
  cmds += `TEXT ${jx},${jy},"2",0,1,1,"${jainTag}"\r\n`;
}
```

**Back label (`buildBackTSPL`):**
- Before title `forEach`:
```js
const isJain = name.includes('JAIN');
```
- After title `forEach` loop, before `y += 6 + gp`:
```js
if (isJain) {
  const jTag = '(No Onion No Garlic)';
  const jtW = jTag.length * 14;
  const jx = Math.max(lm, Math.round((dw - jtW) / 2));
  cmds += `TEXT ${jx},${y},"2",0,1,1,"${jTag}"\r\n`;
  y += 24;
}
```

### Preview (app.js)

**Front (`renderFront`):**
```js
const isJain = ST.prod.n.toUpperCase().includes('JAIN');
const jainSub = isJain ? '<div style="font-size:9px;font-weight:600;color:#333;margin-top:2px;text-align:center">(No Onion No Garlic)</div>' : '';
fp.innerHTML = `<div class="fl-wrap"><div class="fl-name" id="fl-name-el">${ST.prod.n.toUpperCase()}</div>${jainSub}</div>`;
```

**Back (`buildBackHTML`):**
```js
const isJain = p.n.toUpperCase().includes('JAIN');
const jainLine = isJain ? '<div style="font-size:8px;font-weight:600;text-align:center;margin:-2px 0 4px">(No Onion No Garlic)</div>' : '';
// Insert jainLine after the bltit div
```

## Detection
- Simple: `name.toUpperCase().includes('JAIN')`
