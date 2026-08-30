const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957\\.user_uploaded";
const ch1Src = path.join(brainDir, "media_1787837765174.jpg");
const destCh1 = path.join(imgDir, "medvoice-chapter1-hero.jpg");

if (fs.existsSync(ch1Src)) {
  fs.copyFileSync(ch1Src, destCh1);
  console.log("Successfully copied Chapter 01 hero visual to " + destCh1);
} else {
  console.error("Could not find Chapter 01 source at " + ch1Src);
}
