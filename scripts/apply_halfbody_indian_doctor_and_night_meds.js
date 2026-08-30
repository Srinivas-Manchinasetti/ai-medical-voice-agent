const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957";
const docSrc = path.join(brainDir, "indian_doctor_half_body_night_1787842163960.jpg");
const medSrc = path.join(brainDir, "floating_medicine_night_lighting_1787842193045.jpg");

fs.copyFileSync(docSrc, path.join(imgDir, "doctor-greenscreen.jpg"));
fs.copyFileSync(medSrc, path.join(imgDir, "medicine-greenscreen.jpg"));

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Updated CSS for Half-Body Indian Doctor and Night Levitating Medicine
const updatedCSS = `
/* ======================== Chapter 01 Doctor & Medicine Alpha Overlays ======================== */
[data-fg="gate"] {
  z-index: 15;
}

[data-fg="gate"] .fg-doctor {
  left: -1%;
  bottom: -5px;
  width: clamp(330px, 34vw, 540px);
  pointer-events: none;
  z-index: 10;
}

[data-fg="gate"] .fg-medicine {
  right: 3%;
  bottom: 8%;
  width: clamp(230px, 24vw, 380px);
  pointer-events: none;
  z-index: 10;
  animation: floatLevitate 5.5s ease-in-out infinite;
}

@keyframes floatLevitate {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-16px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}

[data-fg="gate"] .fg-doctor img,
[data-fg="gate"] .fg-medicine img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 30px rgba(56, 189, 248, 0.25));
}

@media (max-width: 820px) {
  [data-fg="gate"] .fg-doctor,
  [data-fg="gate"] .fg-medicine {
    display: none;
  }
}
`;

const cssStart = html.indexOf("/* ======================== Chapter 01");
const cssEnd = html.indexOf("</style>");
if (cssStart !== -1 && cssEnd !== -1) {
  html = html.substring(0, cssStart) + updatedCSS.trim() + "\n" + html.substring(cssEnd);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully applied half-body Indian doctor and night-lighting floating medicine in " + targetFile);
