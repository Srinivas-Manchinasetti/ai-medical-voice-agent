const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// Bulletproof JOBS list with comprehensive null-safety
const bulletproofJobs = `const JOBS = [
  ['Reading the type', () => Promise.resolve()],
  ['Pouring the ground', () => { 
    try { initGL(); } catch (e) { console.warn(e); }
    WORLD.uT = { value: 0 }; 
    try { buildRig(); } catch (e) { console.warn(e); }
    try { buildLights(); } catch (e) { console.warn(e); }
  }],
  ['Cutting the approach', () => { try { buildShell(); } catch (e) { console.warn(e); } }],
  ['Raising the hall', () => { try { buildTemple(); } catch (e) { console.warn(e); } }],
  ['Hanging the moon', () => { try { buildMoon(); } catch (e) { console.warn(e); } }],
  ['Setting the gate', () => { try { buildTorii(); } catch (e) { console.warn(e); } }],
  ['Placing the stones', () => {
    try { buildRocks(); } catch (e) { console.warn(e); }
    try { buildLantern(7.4, -7.0, 1.15); buildLantern(-7.6, -5.2, 1.0); } catch (e) { console.warn(e); }
  }],
  ['Growing the maples', () => { try { buildMaple(); } catch (e) { console.warn(e); } }],
  ['Painting the near grass', () => { try { buildForeground(); } catch (e) { console.warn(e); } }],
  ['Cutting the word', () => { try { buildWordmark(); } catch (e) { console.warn(e); } }],
  ['Raising the mist', () => { 
    try { buildAtmosphere(); } catch (e) { console.warn(e); }
    try { buildLeafFall(); } catch (e) { console.warn(e); }
    try { buildWisps(); } catch (e) { console.warn(e); }
  }],
  ['Polishing the water', () => {
    try { initPost(); } catch (e) { console.warn(e); }
    try { buildCards(); } catch (e) { console.warn(e); }
    try { buildCardCloth(); } catch (e) { console.warn(e); }
    if (WORLD.fg && Array.isArray(WORLD.fg)) WORLD.fg.forEach(m => m && m.layers && m.layers.set(1));
    if (WORD.glyphs && Array.isArray(WORD.glyphs)) WORD.glyphs.forEach(m => m && m.layers && m.layers.set(2));
    if (WORLD.rain && WORLD.rain.layers) WORLD.rain.layers.set(1);
    if (WORLD.leaves && WORLD.leaves.mesh && WORLD.leaves.mesh.layers) WORLD.leaves.mesh.layers.set(1);
    if (WORLD.ripples && Array.isArray(WORLD.ripples)) WORLD.ripples.forEach(r => r && r.layers && r.layers.set(1));
    try { layoutWord(); measure(); } catch (e) { console.warn(e); }
    if (WANT_SHADOW && WORLD.key && WORLD.key.shadow) { WORLD.key.shadow.autoUpdate = false; WORLD.key.shadow.needsUpdate = true; }
  }]
];

function boot() {
  try { makeGrain(); } catch (e) { console.warn(e); }
  try { wireReveals(); wireForegroundStages(); wireNav(); wireHeroExit(); wireFocus(); wireCursor(); } catch (e) { console.warn(e); }
  document.body.classList.add('is-locked');

  const dismiss = () => {
    if (preEl && !preEl.classList.contains('done')) {
      preEl.classList.add('done');
      document.body.classList.remove('is-locked');
      try { start(); } catch (e) { console.warn(e); }
    }
  };

  if (preEl) {
    preEl.addEventListener('click', dismiss);
  }

  // Fast auto-dismiss in 600ms
  setTimeout(dismiss, 600);

  let i = 0;
  const step = () => {
    if (i >= JOBS.length) {
      setTimeout(dismiss, 80);
      return;
    }
    const j = JOBS[i];
    const done = () => {
      i++;
      const p = Math.min(1, i / JOBS.length);
      if (preFill) preFill.style.right = ((1 - p) * 100).toFixed(1) + '%';
      if (prePct) prePct.textContent = Math.round(p * 100);
      if (i < JOBS.length) setTimeout(step, 8); else setTimeout(dismiss, 80);
    };
    try {
      const r = j[1]();
      if (r && typeof r.then === 'function') {
        r.then(done, done);
      } else {
        done();
      }
    } catch (err) {
      console.warn('[kage] job "' + j[0] + '" warning', err);
      done();
    }
  };
  setTimeout(step, 10);
}`;

// Replace JOBS and boot blocks
const jobsStart = html.indexOf("const JOBS = [");
const fallbackStart = html.indexOf("function fallback(err)");

if (jobsStart !== -1 && fallbackStart !== -1) {
  html = html.substring(0, jobsStart) + bulletproofJobs + "\n\n" + html.substring(fallbackStart);
  fs.writeFileSync(targetFile, html, "utf8");
  console.log("Successfully patched bulletproof JOBS and instant auto-dismiss boot in " + targetFile);
} else {
  console.error("Could not find bounds for JOBS in " + targetFile);
}
