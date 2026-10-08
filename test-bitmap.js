function buildFrontTSPL(name, copies) {
  const DW = 520, DH = 200;
  const n = (name || '').toUpperCase().trim();
  const isJain = n.includes('JAIN');
  const jainBlockH = isJain ? 40 : 0;
  const availH = DH - 8 - jainBlockH;

  // Let's decide if 1, 2, or 3 lines based on length to get a decent base aspect ratio
  let lines = [n];
  if (n.length > 13) {
    // split to 2 lines
    const words = n.split(' ');
    if (words.length > 1) {
      let mid = Math.floor(words.length / 2);
      lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    }
  }
  
  // Create offscreen canvas for rendering text perfectly
  const vCanvas = document.createElement('canvas');
  const vCtx = vCanvas.getContext('2d');
  const fontSize = 100;
  vCtx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;

  let maxW = 1;
  let totalH = 0;
  const lineMetrics = [];
  
  for(let ln of lines) {
    const m = vCtx.measureText(ln);
    const w = m.width;
    const ascent = m.actualBoundingBoxAscent || 75;
    const descent = m.actualBoundingBoxDescent || 25;
    const h = ascent + descent;
    if (w > maxW) maxW = w;
    lineMetrics.push({ w, h, ascent, descent });
    totalH += (h + 10);
  }

  vCanvas.width = maxW;
  vCanvas.height = totalH;
  // Re-apply font after resizing canvas
  vCtx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  vCtx.fillStyle = 'white';
  vCtx.fillRect(0,0, vCanvas.width, vCanvas.height);
  vCtx.fillStyle = 'black';

  let cy = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lineMetrics[i];
    const cx = (vCanvas.width - m.w) / 2;
    cy += m.ascent;
    vCtx.fillText(lines[i], cx, cy);
    cy += m.descent + 10;
  }

  // Target canvas for stretching
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = availH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = 'white';
  ctx.fillRect(0,0, DW, availH);
  
  const usableW = DW - 16; // 8px margin each side
  const targetRatio = usableW / availH;
  const naturalRatio = vCanvas.width / vCanvas.height;
  
  let destW = usableW;
  let destH = availH;
  
  // if text is very narrow (like "JEERA"), don't stretch it to full width
  if (naturalRatio < targetRatio / 1.8) {
    destW = vCanvas.width * (availH / vCanvas.height) * 1.8;
  }
  
  const destX = (DW - destW) / 2;
  const destY = (availH - destH) / 2;
  
  ctx.drawImage(vCanvas, destX, destY, destW, destH);

  // Read pixels and convert to TSPL HEX
  const imgData = ctx.getImageData(0,0, DW, availH);
  const data = imgData.data;
  
  const widthBytes = Math.ceil(DW / 8); 
  const buffer = new Uint8Array(widthBytes * availH);
  
  for (let y = 0; y < availH; y++) {
    for (let x = 0; x < DW; x++) {
      const idx = (y * DW + x) * 4;
      const gray = 0.299*data[idx] + 0.587*data[idx+1] + 0.114*data[idx+2];
      if (gray < 128) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        buffer[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  let hexString = '';
  const hexMap = "0123456789ABCDEF";
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    hexString += hexMap[(b >> 4) & 0x0F] + hexMap[b & 0x0F];
  }

  let jainCmds = '';
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    const subDot = 22;
    const yJain = availH + 4;
    const subW = sub.length * subDot * 0.58 * 2.8;
    const sx = Math.max(8, Math.round((DW - subW) / 2));
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
      jainCmds += `TEXT ${sx+dx},${yJain+dy},"ROMAN.TTF",0,${subDot},${subDot},"${sub}"\r\n`;
    });
  }

  const printData = [];
  printData.push({ type: 'raw', format: 'plain', data: `SET DARKNESS 12\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,4,${widthBytes},${availH},0,` });
  printData.push({ type: 'raw', format: 'hex', data: hexString });
  printData.push({ type: 'raw', format: 'plain', data: `\r\n${jainCmds}PRINT ${copies},1\r\n` });
  
  return printData;
}
