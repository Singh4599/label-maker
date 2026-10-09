const { createCanvas } = require('canvas');
const fs = require('fs');

function generateFrontCanvas(name) {
  const DW = 520, DH = 200;
  const n = name;
  const isJain = false;
  const availH = DH;
  let lines = [name]; // simplify
  const canvas = createCanvas(DW, DH);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DW, DH);
  
  const SAFE_X = 32; 
  const SAFE_Y = 24; 
  
  const usableW = DW - (SAFE_X * 2); 
  const usableH = availH - (SAFE_Y * 2);
  const numLines = lines.length;
  const gap = 0;
  const lineDestH = Math.floor(usableH);

  let currentY = SAFE_Y;

  for (let i = 0; i < numLines; i++) {
    const ln = lines[i];
    const lCanvas = createCanvas(800, 200); // approx
    const lCtx = lCanvas.getContext('2d');
    const fontSize = 100;
    lCtx.font = `900 ${fontSize}px "Arial Black"`;
    
    const m = lCtx.measureText(ln);
    const left = 0;
    const w = m.width;
    const ascent = 75;
    const h = 100;
    
    lCanvas.width = w + 10;
    lCanvas.height = h + 10;
    
    lCtx.font = `900 ${fontSize}px "Arial Black"`;
    lCtx.fillStyle = 'white';
    lCtx.fillRect(0, 0, lCanvas.width, lCanvas.height);
    lCtx.fillStyle = 'black';
    lCtx.fillText(ln, left + 5, ascent + 5);

    ctx.drawImage(lCanvas, 5, 5, w, h, SAFE_X, currentY, usableW, lineDestH);
    currentY += lineDestH + gap;
  }
  return canvas;
}

const canvas = generateFrontCanvas('TEST');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('test-front.png', buffer);
