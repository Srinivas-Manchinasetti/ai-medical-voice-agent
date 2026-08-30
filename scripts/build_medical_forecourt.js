const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Wet Architectural Forecourt & Plaza (Option 1 + 5)
const forecourtCode = `/* ========================================================== 5 · forecourt & world */
const WORLD = {};                 /* named handles the page can animate */
const swayers = [];               /* things the wind touches */

const PODIUM    = 0.0;
const STEPS     = 10;
const STAIR_Z0  = -18.0;
const STAIR_RUN = 0.6;
const STAIR_W   = 16.0;
const TEMPLE_Z  = -58;

/* Wet Architectural Forecourt with Reflective Dark Stone & Cyan Pathway */
function buildShell() {
  const g = new THREE.Group();

  // 1. Dark Wet Reflective Stone Plaza Ground
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x06090e,
    roughness: 0.18,
    metalness: 0.45
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.05, -30);
  floor.receiveShadow = true;
  scene.add(floor);
  WORLD.floor = floor;
  WORLD.floorMat = floorMat;

  // 2. Central Polished Paved Pathway
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x0a1017,
    roughness: 0.14,
    metalness: 0.55
  });
  const walkway = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 90), pathMat);
  walkway.rotation.x = -Math.PI / 2;
  walkway.position.set(0, 0.01, -30);
  walkway.receiveShadow = true;
  g.add(walkway);

  // 3. Embedded Cyan Light Strips (Visual Metaphor for Patient Care Pathway)
  const cyanNeon = new THREE.MeshBasicMaterial({
    color: hdr(0.3, 2.4, 3.2),
    fog: false,
    toneMapped: false
  });
  [-4.8, 4.8].forEach(x => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 88), cyanNeon);
    strip.position.set(x, 0.03, -30);
    g.add(strip);
  });

  // 4. Subtle Ground Mist / Atmosphere
  const groundMist = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 20),
    new THREE.MeshBasicMaterial({
      map: tx(texGlow('rgba(14,165,233,0.3)', 'rgba(2,132,199,0.06)')),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.35
    })
  );
  groundMist.position.set(0, 1.2, -18);
  groundMist.renderOrder = 2;
  g.add(groundMist);

  scene.add(g);
}

/* ======================================================= 4 · hospital center */
function buildTemple() {
  const g = new THREE.Group();
  
  const texLoader = new THREE.TextureLoader();
  const hospitalTex = texLoader.load('/images/medvoice-hospital-hero.jpg');
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
function buildTorii() { WORLD.torii = null; }

/* --------------------------------------------------- modern bollards */
function buildLantern(x, z, s, y) {
  const g = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
  const lensCyan = new THREE.MeshBasicMaterial({ color: hdr(0.4, 2.2, 2.8), fog: false, toneMapped: false });
  
  // Sleek minimalist architectural bollard
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.9, 16), darkMetal);
  post.position.y = 0.45;
  g.add(post);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 16), lensCyan);
  head.position.y = 0.95;
  g.add(head);

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: tx(texGlow('rgba(56,189,248,0.7)', 'rgba(2,132,199,0.15)')),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.4 }));
  glow.position.y = 0.95;
  glow.renderOrder = 2;
  g.add(glow);

  g.position.set(x, y || 0, z);
  g.scale.setScalar(s || 1);
  scene.add(g);
  return g;
}

/* Clean, zero ornamental trees */
function buildMaple() {}
function buildRocks() {}
function buildForeground() {
  WORLD.fg = [];
}
function buildLeafFall() {
  WORLD.leaves = null;
}`;

// Replace everything from buildShell up to buildWordmark
const shellStart = html.indexOf("function buildShell()");
const wordmarkStart = html.indexOf("/* --------------------------------------------------- the giant wordmark */");

if (shellStart !== -1 && wordmarkStart !== -1) {
  html = html.substring(0, shellStart) + forecourtCode + "\n\n" + html.substring(wordmarkStart);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully built clean wet architectural forecourt in " + targetFile);
