const fs = require("fs");
const path = require("path");

const p = path.join(process.cwd(), "public", "images", "medvoice-hospital-hero.jpg");
console.log("Path:", p);
console.log("Exists:", fs.existsSync(p));
if (fs.existsSync(p)) {
  console.log("Size:", fs.statSync(p).size);
}
