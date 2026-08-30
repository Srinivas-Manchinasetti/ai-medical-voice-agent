const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 3D Wordmark creation function for Three.js scene
const wordmarkCode = `/* --------------------------------------------------- the giant 3D wordmark */
const WORD_Z = 3.0;
const WORD = { glyphs: [], group: null, ink: null, reveal: 0 };

function buildWordmark() {
  const SZ = 320, TRACK = .18, PAD = 24;
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
    grad.addColorStop(0, 'rgba(240, 253, 255, 0.95)');
    grad.addColorStop(.48, 'rgba(56, 189, 248, 0.88)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0.35)');
    x.fillStyle = grad;
    x.fillText(g.ch, PAD + g.l, PAD + g.asc);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh),
      new THREE.MeshBasicMaterial({ map: tx(c, { aniso: 16 }), transparent: true,
        depthWrite: false, side: THREE.DoubleSide, fog: true, opacity: 0.9 }));
    mesh.position.set(g.pen + (g.r - g.l) / 2, (g.asc - g.desc) / 2, 0);
    mesh.position.y = (g.asc - g.desc) / 2;
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    mesh.userData.baseY = mesh.position.y;
    group.add(mesh);
    WORD.glyphs.push(mesh);
  });
  group.position.z = WORD_Z;
  scene.add(group);
  WORD.group = group;
  WORD.ink = { xMin: xMin, xMax: xMax, cx: (xMin + xMax) / 2, w: xMax - xMin, asc: ascMax };
}`;

// Insert wordmarkCode right before layoutWord
const layoutWordIdx = html.indexOf("/* ============================================ 10 · the wordmark layout */");
if (layoutWordIdx !== -1) {
  html = html.substring(0, layoutWordIdx) + wordmarkCode + "\n\n" + html.substring(layoutWordIdx);
  fs.writeFileSync(targetFile, html, "utf8");
  console.log("Successfully restored 3D wordmark in " + targetFile);
} else {
  console.error("Could not find layoutWord index in " + targetFile);
}
