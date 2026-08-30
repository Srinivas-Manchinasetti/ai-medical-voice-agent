const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Updated buildTemple with exact camera frustum placement & crystal-sharp filtering
const sharpHospital3D = `/* ======================================================= 4 · hospital center */
function buildTemple() {
  const g = new THREE.Group();
  
  const texLoader = new THREE.TextureLoader();
  const hospitalTex = texLoader.load('/images/medvoice-hospital-hero.jpg');
  hospitalTex.encoding = THREE.sRGBEncoding;
  hospitalTex.generateMipmaps = false;
  hospitalTex.minFilter = THREE.LinearFilter;
  hospitalTex.magFilter = THREE.LinearFilter;

  // Exact 16:9 wide aspect ratio fitting the camera's 40 deg FOV at distance 70
  // Camera is at [0, 1.8, 12], looking at [0, 6.0, -35]
  const planeW = 112, planeH = 63;
  const hospitalPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({
      map: hospitalTex,
      transparent: false,
      depthWrite: true,
      fog: false
    })
  );
  // Positioned at z = -58, y = 17.0 to display the entire building, moon, and steps
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
}

/* --------------------------------------------------- moon & portal handles */
const MOON = { x: 17.9, y: 31.9, z: -72, r: 8.6 };
function buildMoon() { WORLD.moon = null; }
function placeMoon() {}
function buildTorii() { WORLD.torii = null; }`;

// 2. Adjust buildWordmark so it is placed gracefully and doesn't block the hospital entrance
const wordmarkComment = "/* --------------------------------------------------- the giant wordmark */";
const wordmarkEnd = "const WORD = { glyphs: [], group: null, ink: null, reveal: 0 };";

const refinedWordmark = `/* --------------------------------------------------- the giant wordmark */
const WORD_Z = 3.0;
function buildWordmark() {
  const SZ = 190, TRACK = .22, PAD = 20;
  const m = cvs(4, 4).getContext('2d');
  m.font = '600 ' + SZ + 'px Wordmark, sans-serif';
  m.textBaseline = 'alphabetic'; m.textAlign = 'left';
  const word = 'MEDVOICE', gl = [];
  let pen = 0, ascMax = 0, descMax = 0, xMin = 1e9, xMax = -1e9;
  for (const ch of word) {
    const t = m.measureText(ch);
    const g = { ch: ch, adv: t.width, asc: t.actualBoundingBoxAscent, desc: t.actualBoundingBoxDescent,
                l: t.actualBoundingBoxLeft, r: t.actualBoundingBoxRight, pen: pen };
    gl.push(g);
    ascMax = Math.max(ascMax, g.asc); descMax = Math.max(descMax, g.desc);
    xMin = Math.min(xMin, pen - g.l); xMax = Math.max(xMax, pen + g.r);
    pen += t.width + TRACK * SZ;
  }
  const group = new THREE.Group();
  WORD.glyphs = [];
  gl.forEach((g, i) => {
    const cw = Math.ceil(g.l + g.r) + PAD * 2, chh = Math.ceil(g.asc + g.desc) + PAD * 2;
    const c = cvs(cw, chh), x = c.getContext('2d');
    x.font = '600 ' + SZ + 'px Wordmark, sans-serif';
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const gy0 = PAD + g.asc - ascMax, gy1 = PAD + g.asc + descMax * .4;
    const grad = x.createLinearGradient(0, gy0, 0, gy1);
    grad.addColorStop(0, 'rgba(240, 253, 255, 0.9)');
    grad.addColorStop(.5, 'rgba(56, 189, 248, 0.85)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0.4)');
    x.fillStyle = grad;
    x.fillText(g.ch, PAD + g.l, PAD + g.asc);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh),
      new THREE.MeshBasicMaterial({ map: tx(c, { aniso: 16 }), transparent: true,
        depthWrite: false, side: THREE.DoubleSide, fog: true, opacity: 0.85 }));
    mesh.position.set(g.pen + (g.r - g.l) / 2, (g.asc - g.desc) / 2, 0);
    mesh.position.y = (g.asc - g.desc) / 2;
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    mesh.userData.baseY = mesh.position.y;
    group.add(mesh);
    WORD.glyphs.push(mesh);
  });
  group.position.z = WORD_Z;
  group.position.y = -1.2;
  scene.add(group);
  WORD.group = group;
  WORD.ink = { xMin: xMin, xMax: xMax, cx: (xMin + xMax) / 2, w: xMax - xMin, asc: ascMax };
}`;

// Replace temple block
const templeStart = html.indexOf("/* ======================================================= 4 · hospital center */");
const lanternStart = html.indexOf("function buildLantern(x, z, s, y)");

if (templeStart !== -1 && lanternStart !== -1) {
  html = html.substring(0, templeStart) + sharpHospital3D + "\n\n" + html.substring(lanternStart);
}

// Replace wordmark block
const wmStart = html.indexOf(wordmarkComment);
const wmEnd = html.indexOf(wordmarkEnd);

if (wmStart !== -1 && wmEnd !== -1) {
  html = html.substring(0, wmStart) + refinedWordmark + "\n" + html.substring(wmEnd);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully refined sharp hospital hero and wordmark in " + targetFile);
