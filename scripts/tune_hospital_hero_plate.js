const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// Replace buildShell to create a seamless photorealistic environment
const newBuildShell = `function buildShell() {
  const wallT = texWall();
  const wallMap = tx(wallT.map, { wrap: THREE.RepeatWrapping, repeat: [4, 1.4] });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallMap, roughness: .78, metalness: .05, color: 0x1e293b
  });

  const fT = texFloor();
  const floorMat = new THREE.MeshStandardMaterial({
    map: tx(fT.map, { wrap: THREE.RepeatWrapping, repeat: [7, 7], aniso: 16 }),
    roughness: .85, metalness: .08, color: 0x0f172a
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.5, -18); floor.receiveShadow = true;
  scene.add(floor);
  WORLD.floor = floor; WORLD.floorMat = floorMat;
}`;

// Replace buildTemple to place the high-resolution hospital backdrop perfectly in 3D
const newBuildTemple = `/* ======================================================= 4 · hospital center */
function buildTemple() {
  const g = new THREE.Group();
  
  const texLoader = new THREE.TextureLoader();
  const hospitalTex = texLoader.load('/images/medvoice-hospital-hero.jpg');
  hospitalTex.encoding = THREE.sRGBEncoding;

  // Beauty pass hospital environment backdrop (16:9 ratio)
  const planeW = 86, planeH = 48.375;
  const hospitalPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({
      map: hospitalTex,
      transparent: false,
      depthWrite: true,
      fog: false
    })
  );
  hospitalPlane.position.set(0, 16.5, -28);
  g.add(hospitalPlane);

  // Luminous Clinical Cyan Medical Cross Glow Overlay on Rooftop
  const crossGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({
      map: tx(texGlow('rgba(56,189,248,0.95)', 'rgba(2,132,199,0.25)')),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.75
    })
  );
  crossGlow.position.set(0, 31, -27.5);
  crossGlow.renderOrder = 3;
  g.add(crossGlow);

  WORLD.templeTop = 32;
  scene.add(g);
  WORLD.temple = g;
}

/* --------------------------------------------------- moon & portal handles */
const MOON = { x: 17.9, y: 31.9, z: -72, r: 8.6 };
function buildMoon() { WORLD.moon = null; }
function placeMoon() {}
function buildTorii() { WORLD.torii = null; }`;

// Replace buildShell
const shellStart = html.indexOf("function buildShell()");
const templeCommentStart = html.indexOf("/* ======================================================= 4 · hospital center */");

if (shellStart !== -1 && templeCommentStart !== -1) {
  html = html.substring(0, shellStart) + newBuildShell + "\n\n" + html.substring(templeCommentStart);
}

// Replace buildTemple
const templeStart = html.indexOf("/* ======================================================= 4 · hospital center */");
const lanternStart = html.indexOf("function buildLantern(x, z, s, y)");

if (templeStart !== -1 && lanternStart !== -1) {
  html = html.substring(0, templeStart) + newBuildTemple + "\n\n" + html.substring(lanternStart);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully refined 3D hospital hero plate in " + targetFile);
