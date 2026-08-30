const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Updated CSS for .fg-doctor and .fg-medicine
const fgDoctorCSS = `
/* ======================== Chapter 01 Doctor & Medicine Alpha Overlays ======================== */
[data-fg="gate"] .fg-doctor {
  left: 0;
  bottom: -10px;
  width: clamp(220px, 24vw, 380px);
  pointer-events: none;
  z-index: 10;
}

[data-fg="gate"] .fg-medicine {
  right: 0;
  bottom: -20px;
  width: clamp(230px, 25vw, 390px);
  pointer-events: none;
  z-index: 10;
}

[data-fg="gate"] .fg-doctor img,
[data-fg="gate"] .fg-medicine img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 15px 30px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 20px rgba(56, 189, 248, 0.15));
}

@media (max-width: 820px) {
  [data-fg="gate"] .fg-doctor,
  [data-fg="gate"] .fg-medicine {
    display: none;
  }
}
`;

// Replace existing .fg-doctor CSS or insert
if (html.includes(".fg-doctor")) {
  const cssStart = html.indexOf("/* ======================== Chapter 01 Doctor & Medicine Cutouts ======================== */");
  const cssEnd = html.indexOf("</style>");
  if (cssStart !== -1) {
    html = html.substring(0, cssStart) + fgDoctorCSS.trim() + "\n" + html.substring(cssEnd);
  }
} else {
  html = html.replace("</style>", fgDoctorCSS + "\n</style>");
}

// 2. Add in-browser Alpha Cutout Extractor function
const alphaExtractorCode = `
/* --------------------------------------------------- alpha cutout processor */
/* Removes solid dark backgrounds from foreground plates to create true transparent PNG cutouts */
function processAlphaCutout(imgEl, threshold, feather) {
  if (!imgEl) return;
  const rawImg = new Image();
  rawImg.crossOrigin = 'anonymous';
  rawImg.onload = () => {
    const c = document.createElement('canvas');
    c.width = rawImg.naturalWidth || rawImg.width;
    c.height = rawImg.naturalHeight || rawImg.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(rawImg, 0, 0);
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    const th = threshold || 28;
    const fe = feather || 45;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const maxC = Math.max(r, g, b);
      if (maxC < th) {
        d[i + 3] = 0; // Pure Transparent
      } else if (maxC < th + fe) {
        // Soft Anti-aliased Edge Feathering
        d[i + 3] = Math.round(((maxC - th) / fe) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    imgEl.src = c.toDataURL('image/png');
  };
  rawImg.src = imgEl.src;
}

function initForegroundAlpha() {
  const docImg = document.querySelector('[data-fg="gate"] .fg-doctor img');
  const medImg = document.querySelector('[data-fg="gate"] .fg-medicine img');
  if (docImg) processAlphaCutout(docImg, 24, 40);
  if (medImg) processAlphaCutout(medImg, 22, 38);
}
`;

// Insert alpha cutout extractor right before boot()
if (!html.includes("function processAlphaCutout")) {
  html = html.replace("function boot() {", alphaExtractorCode + "\n\nfunction boot() {\n  try { initForegroundAlpha(); } catch(e) { console.warn(e); }");
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully integrated client-side alpha cutout processor in " + targetFile);
