const fs = require("fs");
const path = require("path");

const contentPath = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957\\.system_generated\\steps\\1552\\content.md";
const raw = fs.readFileSync(contentPath, "utf8");

const start = raw.indexOf("<!DOCTYPE html>");
const end = raw.lastIndexOf("</html>") + "</html>".length;
let html = raw.substring(start, end);

html = html.replace("<head>", '<head>\n<base href="https://threeui.com/landing-pages/">');

const targetDir = path.join(process.cwd(), "public", "landing-pages");
fs.mkdirSync(targetDir, { recursive: true });
const targetFile = path.join(targetDir, "kage.html");
fs.writeFileSync(targetFile, html, "utf8");

console.log("Successfully wrote kage.html (" + html.length + " bytes) to " + targetFile);
