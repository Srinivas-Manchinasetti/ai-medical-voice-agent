const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Updated CSS for Chapter 01 overlays and text legibility
const fixedOverlayCSS = `
/* ======================== Chapter 01 Doctor & Medicine Compact Overlays ======================== */
[data-fg="gate"] {
  z-index: 4;
  pointer-events: none;
}

[data-fg="gate"] .fg-doctor {
  left: -1vw;
  bottom: -15px;
  width: clamp(160px, 16vw, 260px);
  pointer-events: none;
  z-index: 4;
}

[data-fg="gate"] .fg-medicine {
  right: 0.5vw;
  bottom: 2vh;
  width: clamp(120px, 12.5vw, 190px);
  pointer-events: none;
  z-index: 4;
  animation: floatLevitate 5.5s ease-in-out infinite;
}

@keyframes floatLevitate {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(1.5deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}

[data-fg="gate"] .fg-doctor img,
[data-fg="gate"] .fg-medicine img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 15px 30px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 20px rgba(56, 189, 248, 0.16));
}

/* Ensure Chapter 01 text and stats have elevated z-index and generous breathing room */
#gate {
  position: relative;
  z-index: 20;
}

#gate .sec-head,
#gate .gate-grid,
#gate .gate-stats {
  position: relative;
  z-index: 25;
}

#gate .gate-grid {
  padding-left: clamp(20px, 6vw, 90px);
  padding-right: clamp(20px, 6vw, 90px);
}

#gate .display.h-sec {
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.95), 0 1px 4px rgba(0, 0, 0, 0.9);
}

#gate .gate-copy p {
  text-shadow: 0 3px 20px rgba(0, 0, 0, 0.95);
}

@media (max-width: 960px) {
  [data-fg="gate"] .fg-doctor,
  [data-fg="gate"] .fg-medicine {
    display: none;
  }
  #gate .gate-grid {
    padding-left: 0;
    padding-right: 0;
  }
}
`;

// Replace existing Chapter 01 CSS
const cssStart = html.indexOf("/* ======================== Chapter 01");
const cssEnd = html.indexOf("</style>");

if (cssStart !== -1 && cssEnd !== -1) {
  html = html.substring(0, cssStart) + fixedOverlayCSS.trim() + "\n" + html.substring(cssEnd);
  fs.writeFileSync(targetFile, html, "utf8");
  console.log("Successfully refined compact image sizing and text readability in " + targetFile);
} else {
  console.error("Could not find CSS boundaries in " + targetFile);
}
