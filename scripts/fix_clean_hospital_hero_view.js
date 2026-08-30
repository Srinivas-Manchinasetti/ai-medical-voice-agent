const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Remove all slicing 3D planes from buildShell
const cleanShell = `/* Wet Architectural Forecourt - rendered directly in high-res hospital backdrop */
function buildShell() {}`;

const shellStart = html.indexOf("/* Wet Architectural Forecourt with Reflective Dark Stone");
const templeStart = html.indexOf("/* ======================================================= 4 · hospital center */");

if (shellStart !== -1 && templeStart !== -1) {
  html = html.substring(0, shellStart) + cleanShell + "\n\n" + html.substring(templeStart);
}

// 2. Adjust buildTemple positioning so the full 16:9 hospital image with blue moon & entrance is perfectly framed
const perfectTemple = `/* ======================================================= 4 · hospital center */
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

  // Perfect 16:9 aspect ratio matching camera frustum
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
  hospitalPlane.position.set(0, 16.5, -58);
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
      opacity: 0.65
    })
  );
  crossGlow.position.set(0, 36.5, -57.5);
  crossGlow.renderOrder = 3;
  g.add(crossGlow);

  WORLD.templeTop = 38;
  scene.add(g);
  WORLD.temple = g;
}`;

const templeEnd = html.indexOf("/* --------------------------------------------------- moon & portal handles */");
if (templeStart !== -1 && templeEnd !== -1) {
  html = html.substring(0, html.indexOf("/* ======================================================= 4 · hospital center */")) + perfectTemple + "\n\n" + html.substring(templeEnd);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully removed slicing 3D meshes and restored pristine hospital hero framing in " + targetFile);
