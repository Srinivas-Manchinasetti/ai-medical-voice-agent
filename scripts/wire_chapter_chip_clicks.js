const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Updated wireFocus() with exact chapter chip click navigation
const updatedWireFocus = `function wireFocus() {
  const set = i => { RIG.focus = i; };
  $$('[data-chip]').forEach(el => {
    el.addEventListener('mouseenter', () => { 
      set(+el.dataset.chip); 
      $$('[data-chip]').forEach(o => o.classList.toggle('on', o === el)); 
    });
    el.addEventListener('mouseleave', () => { 
      set(-1); 
      el.classList.remove('on'); 
    });
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(el.dataset.chip, 10);
      const targetAnchor = anchors[idx + 1];
      if (typeof targetAnchor === 'number') {
        window.scrollTo({ top: targetAnchor, behavior: REDUCE ? 'auto' : 'smooth' });
      } else {
        const sec = SECS[idx + 1];
        if (sec) {
          window.scrollTo({ top: sec.offsetTop - 20, behavior: REDUCE ? 'auto' : 'smooth' });
        }
      }
    });
  });
  $$('[data-les]').forEach(el => {
    el.addEventListener('mouseenter', () => set(+el.dataset.les % 4));
    el.addEventListener('mouseleave', () => set(-1));
  });
}`;

const oldWireFocusStart = html.indexOf("function wireFocus()");
const oldWireFocusEnd = html.indexOf("function wireCursor()");

if (oldWireFocusStart !== -1 && oldWireFocusEnd !== -1) {
  html = html.substring(0, oldWireFocusStart) + updatedWireFocus + "\n\n" + html.substring(oldWireFocusEnd);
  fs.writeFileSync(targetFile, html, "utf8");
  console.log("Successfully wired exact chapter click navigation in " + targetFile);
} else {
  console.error("Could not find wireFocus block in " + targetFile);
}
