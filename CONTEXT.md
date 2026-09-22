# 365 Spicery — Label Studio
## Complete Context & Operations Guide

> **Version:** 1.0.0  
> **Last Updated:** September 2026  
> **Built by:** Dhruv Singh / Antigravity AI  
> **Status:** ✅ Production Ready (demo data) | ⏳ Awaiting final client prices

---

## What Is This?

A browser-based internal label generation tool for 365 Spicery's operations team.
- No server. No database. No login. No internet required (after first load).
- Open `index.html` → select product → print labels. Done in 60 seconds.
- Generates **FSSAI-compliant** front + back labels for thermal printers.

---

## Label Dimensions (Thermal Printer)

| Label | Print Size | Physical Purpose |
|---|---|---|
| **Front** | 65 mm × 25 mm | Product name (bold, large) — sticks on front of pouch |
| **Back** | 50 mm × 90 mm | Full FSSAI info — sticks on back of pouch |

---

## File Structure

```
label-maker/
│
├── index.html              ← Main app entry point — just open this
├── css/
│   └── style.css           ← All UI styles (edit here for visual changes)
├── js/
│   ├── app.js              ← All application logic, rendering, print functions
│   └── data.js             ← Product database (auto-generated — see below)
│
├── build_data.py           ← Script to regenerate data.js from CSV
│
├── sidebar.png             ← Spice photo in left sidebar (white bg)
├── spice-preview.jpg       ← Unused (kept for reference)
│
├── TEMPLATE.xlsx           ← Excel upload template (send to client)
├── TEST_DATA.xlsx          ← Sample Excel for testing upload mode
│
├── LABLEFRONT.png          ← Reference design image (front label)
├── LABLEBACK.png           ← Reference design image (back label)
├── image.png               ← UI reference image used during design
│
└── CONTEXT.md              ← This file
```

---

## Three Modes — How It Works

### Mode 1: 365 Spicery Data (Default)
Pre-loaded database of **1,757 products** (auto-generated from `enriched_products.csv`).
- Search by product name → select → fill batch/dates → print.
- Data source: `/365 Spicery V2/enriched_products.csv`
- To regenerate: run `python3 build_data.py` (see Data Management section)

### Mode 2: Upload Excel
Client/team uploads a `.xlsx` file with two sheets:

**Sheet 1 — Products:**
| Column | Description |
|---|---|
| Product Name | Exact product name |
| Category | e.g. Blended Spices, Seasoning |
| Ingredients | Comma-separated, descending by weight |
| Icon | Emoji (optional) |
| Description | Short tagline (optional) |
| Energy_kcal | Number only |
| Protein_g | Number only |
| Carbohydrate_g | Number only |
| Total_Sugars_g | Number only |
| Added_Sugars_g | Number only |
| Total_Fat_g | Number only |
| Saturated_Fat_g | Number only |
| Trans_Fat_g | Number only |
| Cholesterol_mg | Number only |
| Sodium_mg | Number only |

**Sheet 2 — Variants:**
| Column | Description |
|---|---|
| Product Name | Must match Products sheet exactly |
| Weight_Display | e.g. 100g, 200g, 500g, 1 Kg |
| Weight_g | Number (e.g. 100, 200) |
| Weight_oz | e.g. 3.53oz |
| MRP | Number only (e.g. 99) |
| Batch_No | e.g. GM0001 |

### Mode 3: Manual Entry
Type everything by hand — for one-off or custom products.
All 10 nutritional values + ingredients + pack + pricing.

---

## Data Management

### Regenerating data.js from CSV

When `enriched_products.csv` is updated (new products added, data corrected):

```bash
cd "/Users/dhruvsingh/Desktop/365 Spicery V2/label-maker"
python3 build_data.py
```

This overwrites `js/data.js` with fresh data.

### ⚠️ Current Data Status

| Field | Status |
|---|---|
| Product names | ✅ Real (1,757 products from Shopify) |
| Categories | ✅ Real |
| Ingredients | ✅ Real (from enriched_products.csv) |
| Nutritional values | ✅ Real (from enriched_products.csv) |
| **MRP / Prices** | ❌ PLACEHOLDER (₹0) — **client to provide** |
| Batch numbers | ⚠️ Auto-generated prefix (XX0001 format) — **client to confirm** |
| Pack sizes | ⚠️ Fixed (100g/200g/500g/1kg) — **confirm with client** |

### When Client Provides Price Data

**Option A — Update data.js directly:**  
In `data.js`, find the product and update the `m` value in each variant:
```js
{ d: '100g', g: 100, oz: '3.53oz', m: 99,   bn: 'GM0001' },
{ d: '200g', g: 200, oz: '7.05oz', m: 179,  bn: 'GM0001' },
{ d: '500g', g: 500, oz: '17.64oz', m: 399, bn: 'GM0001' },
{ d: '1 Kg', g: 1000, oz: '35.27oz', m: 749, bn: 'GM0001' },
```

**Option B — Use build_data.py with a prices CSV:**  
Update `build_data.py` to read a prices file and merge.
Ask Antigravity AI: *"Add price data from [file] to build_data.py"*

**Option C — Excel Upload mode:**  
Use Mode 2 (Upload Excel) with the TEMPLATE.xlsx — no code changes needed.

---

## Print System

### How Print Windows Work

```
User clicks "Print Front"
→ app.js → pF() function
→ opens new browser window
→ writes CSS with @page { size: 65mm 25mm }
→ renders label HTML
→ auto-triggers window.print() after 700ms
→ browser print dialog opens
→ user selects thermal printer → prints
```

### For Multiple Copies
Use the browser print dialog's **"Copies"** field. No changes needed in the app.

### Print Functions in app.js

| Function | What it does |
|---|---|
| `pF()` | Prints front label (65×25mm) |
| `pB()` | Prints back label (50×90mm) |
| `openPrint(css, body)` | Opens print window — shared utility |
| `buildBackHTML(p, v, bn, pd, bb)` | Builds back label HTML string |

---

## Notifications (Toast System)

All error/success messages use toast notifications (bottom-right corner).
No `alert()` popups.

| Trigger | Toast Type |
|---|---|
| Excel loaded successfully | ✅ Green |
| Wrong Excel format | ❌ Red |
| Print without product selected | ❌ Red |
| Print without pack size | ❌ Red |

To add a toast anywhere in `app.js`:
```js
showToast('Your message here', 'success'); // or 'error' or 'info'
```

---

## Deployment (GitHub + Vercel)

### Current Git Setup
The `label-maker/` folder has its own standalone git repo (not the parent 365 Spicery V2 repo).
```bash
cd "/Users/dhruvsingh/Desktop/365 Spicery V2/label-maker"
git log --oneline   # see history
```

### Push Changes to GitHub
```bash
cd "/Users/dhruvsingh/Desktop/365 Spicery V2/label-maker"
git add .
git commit -m "Describe what changed"
git push origin main
```

### Deploy to Vercel
1. Connect GitHub repo `365-label-studio` to Vercel
2. Framework: `Other` (static site)
3. Build command: empty
4. Output directory: empty
5. Every `git push` auto-deploys — no manual step needed

### After Updating Data
```bash
python3 build_data.py          # regenerate data.js
git add js/data.js
git commit -m "Update product database"
git push                       # auto-deploys to Vercel
```

---

## Common Tasks — Quick Reference

| Task | How |
|---|---|
| Add a new product to database | Edit `enriched_products.csv` → run `build_data.py` → push |
| Change prices | Edit `m` values in `data.js` → push |
| Change label layout/design | Edit `css/style.css` (preview section) + `app.js` (buildBackHTML) |
| Change label print size | Edit `@page{size:...}` inside `pF()` or `pB()` in `app.js` |
| Change brand copy/text | Edit `index.html` directly |
| Add a new pack size | Add to `make_variants()` in `build_data.py` + re-run |
| Change sidebar image | Replace `sidebar.png` with new file (same name) |
| Test Excel upload | Use `TEST_DATA.xlsx` — drag it into the Excel upload area |

---

## UI Structure (index.html)

```
<body>
  <header class="top-bar">       ← Red top bar (logo, tagline, clock, avatar)
  <div class="app-wrap">
    <aside class="sidebar">      ← Left sidebar (nav, spice photo)
    <main class="main">          ← Center form area
      <div class="main-header">  ← "LABEL MAKER" heading
      <div class="main-body">
        <div id="mode-db">       ← DB + Excel mode form
        <div id="mode-manual">   ← Manual entry form
    <aside class="preview-panel"> ← Right panel (live preview + print buttons)
      <div id="fp">              ← Front label preview target
      <div id="bp">              ← Back label preview target
```

---

## Known Limitations & Future Ideas

- [ ] **Prices** — Currently ₹0 placeholder — awaiting client data
- [ ] **Batch auto-increment** — Currently manual — could auto-count
- [ ] **MRP override** — DB mode doesn't allow price edit — add input field
- [ ] **Manufacturer address** — Not on label — add if FSSAI requires
- [ ] **FSSAI License No.** — Not on label — add per requirement
- [ ] **Barcode/QR** — Not implemented — future enhancement
- [ ] **Offline fonts** — DM Sans loaded from Google CDN — embed locally for full offline
- [ ] **Bulk print queue** — Select multiple products, print all labels in sequence

---

## Contact / Built With

- **Project:** 365 Spicery Internal Tools
- **Tool:** Antigravity AI (Google DeepMind)
- **Stack:** Vanilla HTML + CSS + JavaScript (zero frameworks)
- **Data source:** `enriched_products.csv` (Shopify product export → enriched)
