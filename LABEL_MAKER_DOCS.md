# 365 Spicery Label Studio - Comprehensive Documentation

This document serves as the absolute source of truth for the Label Maker application. It details the architecture, hardware, file structures, and specific rendering logic so that any developer (or AI) can instantly understand the context and debug/extend the application even if previous chat context is lost.

---

## 1. Core Architecture & Tech Stack
- **Frontend UI:** HTML5, Vanilla CSS (`css/app.css`), and Vanilla JavaScript (`js/app.js`).
- **Printing Engine:** QZ Tray (`js/qz-tray.js`) interacting with `js/qz-print.js`.
- **Backend/Data Pipeline:** Python scripts that read `.xlsx` files and output static `.js` files containing JSON objects. No active server backend is required at runtime; the app runs fully client-side.
- **Rendering Strategy:** Labels are drawn natively on HTML5 `<canvas>` elements. The canvas pixels are then converted into a 1-bit monochrome Hex Bitmap and embedded into raw **TSPL** (TSC Printer Command Language) commands.

---

## 2. Hardware (Printers & Label Sizes)
The application hardcodes specific printer names (as installed on the Windows OS) for specific label modes. **Do not change these names in the OS without updating the code.**

| Mode / Category | Label Dimensions | Target Printer | JS Generation Function |
| :--- | :--- | :--- | :--- |
| **Standard Front** | 65mm x 25mm | `TSC TE244 (Copy 1)` | `generateFrontCanvas()` |
| **Standard Back** | 65mm x 25mm | `TSC TE244` | `generateBackCanvas()` |
| **Dukan Bai (Front)** | 80mm x 25mm | `TSC TE244 (Copy 1)` | `generateFrontCanvas()` (DW modified to 640) |
| **Dukan Bai (Back)** | 50mm x 90mm | `TSC TE244` | `generateBackCanvas()` (DW:400, DH:720) |
| **32x25 Label (Back)**| 32.5mm x 25mm (x2) | `TSC TE244` | `generateNew32Canvas()` (Splits 65mm roll into two) |
| **Parties Data** | 104mm x 152mm | `TSC TA210` | `generatePartiesCanvas()` |
| **Yellow 365** | 104mm x 152mm | `TSC TA210` | `generateYellowCanvas()` |
| **Internal Material** | 90mm x 85mm | `TSC TA210` | `generateInternalInnerCanvas()` & `generateInternalOuterCanvas()` |

> **Note on Resolution:** TSC Printers operate at 203 DPI (Dots Per Inch), which equates to exactly **8 dots per mm**.
> *Example:* 65mm x 25mm = 520px x 200px canvas size.

---

## 3. Directory & File Structure

```text
/label-maker/
│
├── index.html                  # Main UI. Cache busters (e.g. ?v=67) are used here to force JS reloads.
├── css/app.css                 # All UI styling.
│
├── js/
│   ├── app.js                  # Global State (ST), DOM interactions, preview rendering, print dispatch.
│   ├── qz-print.js             # Canvas drawing logic, Text stretching logic, TSPL conversion, QZ Tray calls.
│   ├── qz-tray.js              # Official QZ Tray library.
│   ├── db.js                   # (Auto-generated) Standard & Dukan Bai products data.
│   ├── parties-data.js         # (Auto-generated) Parties products data.
│   └── internal-data.js        # (Auto-generated) Internal Material products data.
│
└── Python Data Builders/       # Run these when Excel files are updated
    ├── build_data.py           # Reads "LABEL STUDIO 365.xlsx"
    ├── build_parties.py        # Reads "PARTIES 104x152 LABEL.xlsx"
    └── build_internal.py       # Reads "ALL PRODUCT NAME.xlsx"
```

---

## 4. Key Logic & Algorithms

### A. The "Stretch Text" Logic
For labels like the **Standard Front** and **Internal Inner**, the product name must stretch to fill the available space dynamically, removing empty gaps regardless of the name's length.
1. The string is split into 1, 2, or 3 lines using `balanceLines()`.
2. Each line is drawn on an *offscreen temporary canvas*.
3. The exact bounding box (using `measureText().actualBoundingBox`) is calculated.
4. `ctx.drawImage` is used to draw the offscreen canvas onto the main canvas, scaling it (`destW` and `destH`) proportionally to fill the allotted vertical block (`lineDestH`), applying aspect-ratio limits so short words don't look comically large.

### B. Live Previews
- Triggered by `renderFront()` and `renderBack()` in `app.js`.
- They call the exact same `generateXXXCanvas()` functions used for printing.
- The returned Canvas is converted via `.toDataURL()` and injected into the right-side UI panel. What you see on screen is pixel-for-pixel what is sent to the printer.

### C. Offline Fallback Popups
If QZ Tray is offline or closed, clicking "Print" does not fail silently.
- `qzPrint...()` functions return a Promise that resolves to `false` (or rejects).
- `app.js` catches this `false` response and manually invokes `build...TSPL(canvas, disablePopup=false)`.
- This triggers a large, red-bordered absolute `<div>` to appear on the screen showing the raw canvas image, allowing development and testing without a physical printer.

### D. Specific Label Quirks
- **Jain Products:** In `generateFrontCanvas`, if the product name contains `"JAIN"`, it reserves 36px at the bottom left to draw a specific Green Square indicator.
- **Barcode Generation:** Handled by `JsBarcode` using `CODE128` format to avoid checksum crashes that EAN13 sometimes causes with invalid digits.
- **Internal Outer Use-By Date:** The "Use By Date" is strictly hardcoded to exactly **1 year minus 1 day** from the Packing Date (handled inside `generateInternalOuterCanvas()`).
- **32x25 Split Label:** Prints 2 copies of a 32.5x25mm design side-by-side on a single 65mm wide roll using X-axis offsets (0 and 288). The batch number font is capped at 21px with `maxWidth=230` to prevent long batches from cutting off on the right edge.
- **Internal Inner Label:** Does **not** require a Pack Size (`ST.vi`) to be selected to print, as it does not contain weight or pricing information.

---

## 5. How to Debug or Add New Features

### Updating a Script
If you make a change in `js/app.js` or `js/qz-print.js`:
1. Save the file.
2. Open `index.html`.
3. Scroll to the bottom and increment the cache buster string (`?v=XX`) on the updated script tag. This forces the browser to load the new JS instead of the cached version.

### Adding a New Label Size/Mode
1. **HTML:** Add a new button in `index.html` sidebar.
2. **State:** Add the new mode handling in `setMode()` within `app.js`.
3. **Canvas Generator:** Create a new `generateNewModeCanvas(p, v, ...)` in `qz-print.js`. Make sure `DW` and `DH` are exactly `width_in_mm * 8` and `height_in_mm * 8`.
4. **TSPL Builder:** Create a `buildNewModeTSPL()` mapping function. Set the `SIZE X mm, Y mm` TSPL command perfectly to the physical roll.
5. **Print Dispatcher:** Create `qzPrintNewMode()` to send it to the correct hardcoded printer.
6. **UI Connect:** Map the print button inside `pF()` or `pB()` in `app.js` to trigger your new dispatcher.

### Modifying Text Sizes or Positions
Always test text modifications by opening the app and viewing the Live Preview box.
If you need to fix text cut-offs:
- Use `ctx.font = 'bold XXpx Arial'` to lower font size.
- Utilize the 4th parameter of `fillText`: `ctx.fillText(text, x, y, maxWidth)` to force horizontal squishing on overflow.

### Rebuilding Data
If the user modifies their Excel files:
1. Open a terminal in the `/label-maker` directory.
2. Run `python build_data.py` (or the respective script).
3. Refresh the web page.

---
*Generated and maintained by Gemini / Antigravity.*
