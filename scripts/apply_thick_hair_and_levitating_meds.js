const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957";
const docSrc = path.join(brainDir, "med_doctor_thick_hair_1787832925931.jpg");
const medSrc = path.join(brainDir, "med_levitating_medicine_1787832962299.jpg");

fs.copyFileSync(docSrc, path.join(imgDir, "doctor-foreground.jpg"));
fs.copyFileSync(medSrc, path.join(imgDir, "medicine-foreground.jpg"));

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Update CSS with floating animation for levitating medicine and crisp alpha
const updatedCSS = `
/* ======================== Chapter 01 Doctor & Medicine Alpha Overlays ======================== */
[data-fg="gate"] .fg-doctor {
  left: 0;
  bottom: -10px;
  width: clamp(230px, 26vw, 420px);
  pointer-events: none;
  z-index: 10;
}

[data-fg="gate"] .fg-medicine {
  right: 0;
  bottom: -20px;
  width: clamp(260px, 29vw, 460px);
  pointer-events: none;
  z-index: 10;
  animation: floatLevitate 6s ease-in-out infinite;
}

@keyframes floatLevitate {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-14px) rotate(1.2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}

[data-fg="gate"] .fg-doctor img,
[data-fg="gate"] .fg-medicine img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 15px 35px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 25px rgba(56, 189, 248, 0.22));
}

@media (max-width: 820px) {
  [data-fg="gate"] .fg-doctor,
  [data-fg="gate"] .fg-medicine {
    display: none;
  }
}
`;

// Replace CSS
const cssStart = html.indexOf("/* ======================== Chapter 01 Doctor & Medicine Alpha Overlays ======================== */");
const cssEnd = html.indexOf("</style>");

if (cssStart !== -1 && cssEnd !== -1) {
  html = html.substring(0, cssStart) + updatedCSS.trim() + "\n" + html.substring(cssEnd);
}

// 2. Update initForegroundAlpha threshold so thick hair remains 100% solid opaque
const alphaFn = `function initForegroundAlpha() {
  const docImg = document.querySelector('[data-fg="gate"] .fg-doctor img');
  const medImg = document.querySelector('[data-fg="gate"] .fg-medicine img');
  // Strict low threshold (12, 22) keeps dark hair, clothes, and outlines 100% solid opaque
  if (docImg) processAlphaCutout(docImg, 12, 22);
  if (medImg) processAlphaCutout(medImg, 10, 20);
}`;

const oldInitAlphaStart = html.indexOf("function initForegroundAlpha()");
if (oldInitAlphaStart !== -1) {
  const oldInitAlphaEnd = html.indexOf("function boot()", oldInitAlphaStart);
  html = html.substring(0, oldInitAlphaStart) + alphaFn + "\n\n" + html.substring(oldInitAlphaEnd);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully applied thick hair doctor and floating levitating medicine in " + targetFile);
