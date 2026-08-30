const fs = require("fs");
const path = require("path");
const vm = require("vm");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
const html = fs.readFileSync(targetFile, "utf8");

const startTag = "<script>";
const endTag = "</script>";
const scriptIdx = html.indexOf(startTag);
const scriptEnd = html.lastIndexOf(endTag);

if (scriptIdx !== -1 && scriptEnd !== -1) {
  const code = html.substring(scriptIdx + startTag.length, scriptEnd);
  try {
    new vm.Script(code);
    console.log("Main Inline Script syntax check: PASSED");
  } catch (err) {
    console.error("Main Inline Script syntax error:", err);
    process.exit(1);
  }
} else {
  console.error("No inline script found!");
  process.exit(1);
}
