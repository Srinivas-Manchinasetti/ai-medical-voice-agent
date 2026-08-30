const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Rock-solid buildTemple with DoubleSide and instant texture handling
const rockSolidTemple = `/* ======================================================= 4 · hospital center */
function buildTemple() {
  const g = new THREE.Group();
  
  const texLoader = new THREE.TextureLoader();
  const hospitalTex = texLoader.load('/images/medvoice-hospital-hero.jpg', () => {
    if (typeof renderer !== 'undefined' && renderer) renderer.render(scene, camera);
  });
  hospitalTex.encoding = THREE.sRGBEncoding;
  hospitalTex.generateMipmaps = false;
  hospitalTex.minFilter = THREE.LinearFilter;
  hospitalTex.magFilter = THREE.LinearFilter;

  // Exact 16:9 wide aspect ratio matching camera FOV
  const planeW = 112, planeH = 63;
  const hospitalPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({
      map: hospitalTex,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      fog: false
    })
  );
  hospitalPlane.position.set(0, 17.0, -58);
  g.add(hospitalPlane);

  // Subtle Rooftop Cross Glow Enhancement
  const crossGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({
      map: tx(texGlow('rgba(56,189,248,0.95)', 'rgba(2,132,199,0.25)')),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      opacity: 0.6
    })
  );
  crossGlow.position.set(0, 36.5, -57.5);
  crossGlow.renderOrder = 3;
  g.add(crossGlow);

  WORLD.templeTop = 38;
  scene.add(g);
  WORLD.temple = g;
}`;

// Replace buildTemple block
const templeStart = html.indexOf("/* ======================================================= 4 · hospital center */");
const moonStart = html.indexOf("/* --------------------------------------------------- moon & portal handles */");

if (templeStart !== -1 && moonStart !== -1) {
  html = html.substring(0, templeStart) + rockSolidTemple + "\n\n" + html.substring(moonStart);
}

// 2. Fix boot() sequence and remove race conditions
const cleanBoot = `function boot() {
  try { makeGrain(); } catch (e) { console.warn(e); }
  try { wireReveals(); wireForegroundStages(); wireNav(); wireHeroExit(); wireFocus(); wireCursor(); } catch (e) { console.warn(e); }
  try { initForegroundAlpha(); } catch (e) { console.warn(e); }
  document.body.classList.add('is-locked');

  let i = 0;
  const step = () => {
    if (i >= JOBS.length) {
      if (preEl) preEl.classList.add('done');
      document.body.classList.remove('is-locked');
      start();
      return;
    }
    const j = JOBS[i];
    const done = () => {
      i++;
      const p = Math.min(1, i / JOBS.length);
      if (preFill) preFill.style.right = ((1 - p) * 100).toFixed(1) + '%';
      if (prePct) prePct.textContent = Math.round(p * 100);
      step();
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
  step();
}`;

const bootStart = html.indexOf("function boot() {");
const fallbackStart = html.indexOf("function fallback(err)");

if (bootStart !== -1 && fallbackStart !== -1) {
  html = html.substring(0, bootStart) + cleanBoot + "\n\n" + html.substring(fallbackStart);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully patched buildTemple and clean sequential boot in " + targetFile);
