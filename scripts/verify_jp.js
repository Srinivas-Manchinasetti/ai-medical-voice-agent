const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(process.cwd(), "public", "landing-pages", "kage.html"), "utf8");

const jpRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g;
const matches = html.match(jpRegex);
console.log("Japanese matches count: " + (matches ? matches.length : 0));
if (matches) {
  console.log("Remaining unique chars: " + Array.from(new Set(matches)).join(", "));
}
