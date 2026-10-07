# 365 Spicery Label Maker — FINAL TO-DO LIST

## SCOPE: Only HTML Preview (app.js) + Chrome Print fallback (pB_Chrome / pF_Chrome)
## TSPL / qz-print.js = DO NOT TOUCH ✋

---

### ✅ Changes To Implement:

1. **Format — Back & Front** (Mexican Seasoning reference image)
   - Back: Title → Category (no box, plain text) → INGREDIENTS :- → ingredients text → NUTRITIONAL INFORMATION → Approximate Composition → box with nutrition → NET WEIGHT/BATCH/DATE/BEST BEFORE/MRP block → barcode
   - Front: Product name bold centered only

2. **Font → Arial Black everywhere** (100% thick bold like reference images)
   - Product name on front: Arial Black, very large
   - Product name on back: Arial Black bold
   - Section headers (INGREDIENTS, NUTRITIONAL INFO): Arial Black
   - Details block (NET WEIGHT, BATCH NO, etc): Bold Arial

3. **Blended category box** — For "Blended Spices" category products, add a box below Category line:
   - "Mixed Masala Powder, Spices content more than 85%, salt content more than 5%"
   - Styled like reference image (centered, bordered box)

4. **Jain Subtitle** — For all products with "JAIN" in name, add AFTER product name:
   - Line 1: product name (unchanged)
   - Line 2: "No Onion No Garlic" (Arial Black bold, centered, slightly smaller)
   - BOTH front and back labels

5. **Best Before = Date of Packing + months - 1 day**
   - If DOP = 07/10/2026 and shelf = 12 months → BB = 06/10/2027 (1 day before same date next year)
   - Fix `calcBestBefore()` to subtract 1 day from calculated date
   - Fix `calcManualBestBefore()` same way

6. **MRP = Pricelist price × pack_size_factor × 2**
   - Pricelist has 1KG price. Current build_data.py already scales to 100g/200g/500g/1kg.
   - User says current MRP needs to be DOUBLED (×2).
   - Fix: In `pB_Chrome` and `buildBackHTML`, MRP = v.m × 2 (or update build_data.py multipliers ×2)
   - Actually: Fix at display/print time → multiply v.m by 2 before showing
   - Also fix per-gram price accordingly

7. **Barcode — Back label bottom** (like Green Chilli Paste reference image)
   - Add EAN-13 barcode at very bottom of back label
   - Use a JS barcode library (JsBarcode from CDN)
   - Barcode value: product's EAN/barcode field from data, or use placeholder "8905606XXXXXX"
   - Show numeric digits below barcode like reference image

---

### Files to edit:
- `js/app.js` — renderFront, renderBack, buildBackHTML, pF_Chrome, pB_Chrome, calcBestBefore, calcManualBestBefore
- `index.html` — Add JsBarcode CDN script tag
- `build_data.py` — NOT needed if we fix MRP at display time

### Files to NOT touch:
- `js/qz-print.js` ❌
- `js/data.js` ❌ (auto-generated, don't edit manually)
