# 365 Spicery — Label Maker

> Internal tool for generating FSSAI-compliant product labels.  
> Last updated: September 2026

---

## What This Is

A browser-based label generation tool for 365 Spicery's operations team. No server, no login, no dependencies except SheetJS (loaded via CDN). Open `index.html` and print.

---

## File Structure

```
label-maker/
├── index.html          ← Main app (HTML structure)
├── css/
│   └── style.css       ← All styles (premium light theme)
├── js/
│   ├── data.js         ← 365 Spicery product database (10 products)
│   └── app.js          ← All application logic
├── sidebar.png         ← Spice photo for sidebar (white bg)
├── spice-preview.jpg   ← Preview panel decoration (unused currently)
├── CONTEXT.md          ← This file
└── LABLEFRONT.png      ← Reference label design (front)
    LABLEBACK.png       ← Reference label design (back)
```

---

## Label Dimensions

| Label | Size | Used For |
|---|---|---|
| **Front** | 65 × 25 mm | Product name (bold, large) |
| **Back** | 50 × 90 mm | Full FSSAI-compliant info |

---

## Three Modes

### 1. 365 Spicery Data (default)
Pre-loaded database of all 10 current products. Select product → select pack size → dates auto-fill → print.

### 2. Upload Excel
Upload a `.xlsx` file with two sheets:
- **Products** sheet: `Product Name, Category, Ingredients, Icon, Description, Energy_kcal, Protein_g, Carbohydrate_g, Total_Sugars_g, Added_Sugars_g, Total_Fat_g, Saturated_Fat_g, Trans_Fat_g, Cholesterol_mg, Sodium_mg`
- **Variants** sheet: `Product Name, Weight_Display, Weight_g, Weight_oz, MRP, Batch_No`

### 3. Manual Entry
Fill in all fields by hand. Useful for one-off or custom products.

---

## Pre-loaded Products (data.js)

| Product | Category |
|---|---|
| Mexican Seasoning | Seasoning |
| Pav Bhaji Masala | Blended Spices |
| Garam Masala | Blended Spices |
| Turmeric Powder | Single Spices |
| Kashmiri Chilli Powder | Chilli Powders |
| Coriander Powder | Single Spices |
| Cumin Powder | Single Spices |
| Chaat Masala | Blended Spices |
| Kitchen King Masala | Blended Spices |
| Biryani Masala | Blended Spices |

Each product has:
- 4 variants: 100g / 200g / 500g / 1 Kg (with MRP and batch prefix)
- 10 nutritional values (FSSAI required)
- Ingredient list (descending order by weight)

---

## Print Functions

| Button | Action |
|---|---|
| **Print Front** | Opens 65×25mm print window |
| **Print Back** | Opens 50×90mm print window |
| **Print Both** | Opens front window, then back window 1.2s later — print both from their dialogs |

> **Tip:** For multiple copies, use the browser's print dialog Copies field.

---

## Label Content (Back Label — FSSAI Compliant)

- Product Name (bold, large)
- Category
- Ingredients (descending by weight)
- Nutritional Information table (per 100g)
- Net Weight + oz equivalent
- Batch Number
- Date of Packing (DD/MM/YYYY)
- Best Before (auto-calculated: 3/6/12/18/24 months or custom date)
- MRP (incl. all taxes)
- Per-gram price

---

## UI Notes

- **Theme:** Premium light — warm `#F5F4F0` bg, white sidebar, white preview panel
- **Top bar:** Red `#C8001E` — 365 Spicery branding
- **Fonts:** DM Sans (UI), Arial Black (label text — matches thermal printer output)
- **Sidebar image:** `sidebar.png` — pure white bg spice photo, fades into sidebar
- **No internet required** after initial Google Fonts load (can be made fully offline by embedding fonts)

---

## Known Limitations / Future Ideas

- [ ] Batch No. auto-increment between prints
- [ ] MRP manual override (currently auto from DB only)
- [ ] Save/history of recently printed labels
- [ ] Barcode/QR code on back label
- [ ] Fully offline mode (embed DM Sans font locally)
- [ ] Bulk batch — print different products sequentially from a list
