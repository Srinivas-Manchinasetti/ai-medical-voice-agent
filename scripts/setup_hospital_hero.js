const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957\\.user_uploaded";
const heroSrc = path.join(brainDir, "media_1787819097810.jpg");
const destHero = path.join(imgDir, "medvoice-hospital-hero.jpg");

if (fs.existsSync(heroSrc)) {
  fs.copyFileSync(heroSrc, destHero);
  console.log("Successfully copied hospital hero image to " + destHero);
} else {
  console.error("Could not find hero source at " + heroSrc);
}
