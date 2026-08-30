const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Replace all red gradients and highlights in .les with glowing blue/cyan
html = html.replace(
  /linear-gradient\(145deg,rgba\(224,35,28,\.13\),transparent 58%\)/g,
  'linear-gradient(145deg, rgba(14, 165, 233, 0.24) 0%, rgba(2, 132, 199, 0.12) 48%, transparent 72%)'
);

html = html.replace(
  /linear-gradient\(90deg,\s*rgba\(224,35,28,\.09\),\s*transparent 46%\)/g,
  'linear-gradient(90deg, rgba(14, 165, 233, 0.20), transparent 55%)'
);

// 2. Replace .les:hover .k and .les .bar color
html = html.replace(
  /\.les:hover \.k\{\s*color:var\(--vermilion\);\s*\}/g,
  '.les:hover .k{ color:#38bdf8; }'
);

html = html.replace(
  /\.les \.bar\{\s*position:absolute;\s*left:0;\s*bottom:-1px;\s*height:1px;\s*width:100%;\s*background:var\(--vermilion\);/g,
  '.les .bar{ position:absolute; left:0; bottom:-1px; height:1.5px; width:100%; background:linear-gradient(90deg, #0ea5e9, #38bdf8);'
);

// 3. Add enhanced blue glow CSS for Chapter 03 cards
const enhancedCh3CSS = `
/* ======================== Chapter 03 Blue Gradient & Glow ======================== */
body[data-layout-curriculum="b"] .les {
  border: 1px solid rgba(56, 189, 248, 0.12) !important;
  border-radius: 12px;
  backdrop-filter: blur(16px);
  transition: padding .4s var(--ease-out), border-color .35s, box-shadow .35s, transform .35s;
}

body[data-layout-curriculum="b"] .les:hover {
  border-color: rgba(56, 189, 248, 0.45) !important;
  box-shadow: 0 16px 40px -12px rgba(2, 132, 199, 0.35), inset 0 0 24px rgba(56, 189, 248, 0.10);
  transform: translate3d(0, -2px, 0);
}

body[data-layout-curriculum="b"] .les .k {
  color: #38bdf8 !important;
  font-weight: 600;
}

body[data-layout-curriculum="b"] .les h3 em {
  color: #7dd3fc;
}
`;

if (!html.includes("Chapter 03 Blue Gradient")) {
  html = html.replace("</style>", enhancedCh3CSS + "\n</style>");
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully updated Chapter 03 to blue gradient in " + targetFile);
