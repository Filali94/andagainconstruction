/* ══════════════════════════════════════════════════════════════
   build3d.js — "Fra tom grund til nøglefærdigt hus"
   A scroll-driven 3D house that builds itself in six steps:
   plot → sketch → structure → walls → roof → lights on.
   Three.js is only fetched once the section is close to view.
══════════════════════════════════════════════════════════════ */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const STEPS = 6;

const root = document.querySelector('.build3d');
if (root) setup(root);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function setup(section) {
  section.classList.add('is-live');
  const canvas = section.querySelector('.build3d-canvas');
  const steps = [...section.querySelectorAll('.build3d-step')];
  const fill = section.querySelector('.build3d-progress-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = reduced ? 1 : 0;
  let scene3d = null;
  let visible = false;
  let raf = 0;
  let lastStep = -1;

  function readProgress() {
    if (reduced) return 1;
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
  }

  function updateUI(p) {
    const idx = Math.min(STEPS - 1, Math.floor(p * STEPS + 1e-4));
    if (idx !== lastStep) {
      steps.forEach((s, i) => {
        s.classList.toggle('is-active', i === idx);
        s.classList.toggle('is-done', i < idx);
      });
      lastStep = idx;
    }
    if (fill) fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  function frame(time) {
    raf = 0;
    const target = readProgress();
    current += (target - current) * 0.09;
    if (Math.abs(target - current) < 0.0004) current = target;
    updateUI(current);
    if (scene3d) section.classList.toggle('is-dusk', scene3d.render(current, time || 0) > 0.5);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  updateUI(current);

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  }, { rootMargin: '10% 0px' }).observe(section);

  const loader = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    loader.disconnect();
    if (!hasWebGL()) { section.classList.add('no-webgl'); return; }
    import(THREE_URL)
      .then((THREE) => {
        scene3d = createScene(THREE, canvas, kick);
        section.classList.add('is-ready');
        kick();
      })
      .catch(() => section.classList.add('no-webgl'));
  }, { rootMargin: '150% 0px' });
  loader.observe(section);

  // Lets a single frame be rendered on demand (used for checks and print).
  section.renderAt = (p) => scene3d && scene3d.render(p, 0);
}

/* ─────────────────────────────────────────────────────────────── */

function createScene(THREE, canvas, onChange) {
  const mobile = matchMedia('(max-width: 768px)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const C = (hex) => new THREE.Color(hex);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 42 : 30, 1, 0.5, 500);
  const lookTarget = new THREE.Vector3();

  /* ── Palette (follows the site's light/dark theme) ── */
  const pal = { bg: C('#F3F1EB'), ground: C('#E9E4D9'), ink: C('#1A1712'), grid: C('#B9B1A0') };
  const duskBg = C('#1E222A');
  const duskGround = C('#3A3E46');
  function readPalette() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const cream = getComputedStyle(document.documentElement).getPropertyValue('--cream').trim();
    pal.bg.set(cream || (dark ? '#14120E' : '#F3F1EB'));
    pal.ground.set(dark ? '#1F1C17' : '#E9E4D9');
    pal.ink.set(dark ? '#E9E3D6' : '#1A1712');
    pal.grid.set(dark ? '#5D5749' : '#B9B1A0');
    inkMat.color.copy(pal.ink);
    plotMat.color.copy(pal.ink);
    gridMat.color.copy(pal.grid);
    onChange();
  }

  scene.background = pal.bg.clone();
  scene.fog = new THREE.Fog(pal.bg.clone(), 90, 220);

  /* ── Light ── */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d2c3, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 100 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(1, 0, 3);
  scene.add(sun, sun.target);
  const sunDay = new THREE.Vector3(20, 32, 16);
  const sunDusk = new THREE.Vector3(-26, 9, 20);
  const sunWarm = C('#FF9F5A');
  const skyDusk = C('#9AA6BF');

  // Warm light spilling from the windows onto the ground at dusk
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = poolCanvas.height = 128;
  const pctx = poolCanvas.getContext('2d');
  const grad = pctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, 128, 128);
  const poolTex = new THREE.CanvasTexture(poolCanvas);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: '#FFB86E', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pools = [[-3.2, 5.9, 11, 4.6], [6.5, 11.4, 8, 4.4], [-9.6, 0, 3.4, 5.6], [10.9, 6.5, 3.2, 4]].map(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), poolMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.05, z);
    m.renderOrder = 2;
    scene.add(m);
    return m;
  });

  /* ── Materials ── */
  const solid = (color, roughness = 0.92) => new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const wallMat = solid('#FBF8F2');
  const annexMat = solid('#F1EDE4');
  const roofMat = solid('#2F2B26', 0.85);
  const slabMat = solid('#E4DED2');
  const frameMat = solid('#9A917E', 0.6);
  const treeMat = solid('#C3C7B1', 1);
  const trunkMat = solid('#8A8271', 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: pal.ground.clone(), roughness: 1 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#6E7884', roughness: 0.28, metalness: 0.1,
    emissive: C('#FFC98A'), emissiveIntensity: 0, transparent: true, opacity: 0,
  });
  const inkMat = new THREE.LineBasicMaterial({ color: pal.ink.clone(), transparent: true, opacity: 1 });
  const plotMat = new THREE.LineDashedMaterial({ color: pal.ink.clone(), dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.85 });
  const gridMat = new THREE.LineBasicMaterial({ color: pal.grid.clone(), transparent: true, opacity: 0.5 });

  /* ── Ground, grid and plot ── */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const gridPts = [];
  for (let i = -40; i <= 40; i += 2) {
    gridPts.push(i, 0.012, -40, i, 0.012, 40, -40, 0.012, i, 40, 0.012, i);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  scene.add(grid);

  const plotCorners = [[-13, -8.5], [14.5, -8.5], [14.5, 14], [-13, 14], [-13, -8.5]];
  const plotPts = [];
  for (let e = 0; e < 4; e++) {
    const [ax, az] = plotCorners[e];
    const [bx, bz] = plotCorners[e + 1];
    for (let k = 0; k < 60; k++) {
      const t = k / 60;
      plotPts.push(new THREE.Vector3(ax + (bx - ax) * t, 0.03, az + (bz - az) * t));
    }
  }
  plotPts.push(new THREE.Vector3(plotCorners[0][0], 0.03, plotCorners[0][1]));
  const plotGeo = new THREE.BufferGeometry().setFromPoints(plotPts);
  const plot = new THREE.Line(plotGeo, plotMat);
  plot.computeLineDistances();
  scene.add(plot);

  /* ── Building blocks ── */
  function box(w, h, d, mat, x, y0, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0); // anchored at its base so scale.y "grows" it
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y0, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  function beam(len, x, y, z, rotX = 0, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, len), frameMat);
    m.position.set(x, y, z);
    m.rotation.set(rotX, rotY, 0);
    m.castShadow = true;
    return m;
  }

  // Main gable house (A) + flat-roofed annex (B) forming an L
  const plinthA = box(16.6, 0.25, 7.6, slabMat, 0, 0, 0);
  const plinthB = box(7.6, 0.25, 6.4, slabMat, 6.5, 0, 6.6);
  const terrace = box(10.5, 0.14, 3.2, slabMat, -2.75, 0, 5.1);
  const bodyA = box(16, 3, 7, wallMat, 0, 0, 0);
  const bodyB = box(7, 3.4, 6, annexMat, 6.5, 0, 6.5);

  const R = 2.6, EAVE = 0.4, GABLE = 0.35;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-3.5 - EAVE, 0);
  roofShape.lineTo(3.5 + EAVE, 0);
  roofShape.lineTo(0, R + 0.25);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 16 + GABLE * 2, bevelEnabled: false });
  roofGeo.translate(0, 0, -(8 + GABLE));
  roofGeo.rotateY(Math.PI / 2);
  const roofA = new THREE.Mesh(roofGeo, roofMat);
  roofA.position.y = 3.002; // final resting height (the sketch lines are traced from here)
  roofA.castShadow = true;
  roofA.receiveShadow = true;
  const roofB = box(7.4, 0.24, 6.4, slabMat, 6.5, 3.4, 6.5);

  const glass = [];
  function pane(w, h, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    glass.push(m);
    return m;
  }
  const S = Math.PI, E = Math.PI / 2, W = -Math.PI / 2;
  [
    pane(1.8, 2.3, -6.2, 1.45, 3.53, 0), pane(1.8, 2.3, -3.4, 1.45, 3.53, 0),
    pane(1.8, 2.3, -0.6, 1.45, 3.53, 0), pane(1.1, 2.2, 1.7, 1.4, 3.53, 0),
    pane(1.6, 1.4, -5, 1.7, -3.53, S), pane(1.6, 1.4, -1, 1.7, -3.53, S),
    pane(1.6, 1.4, 3, 1.7, -3.53, S), pane(1.6, 1.4, 6, 1.7, -3.53, S),
    pane(2.6, 2.3, -8.03, 1.45, 0, W), pane(1.6, 2.0, 8.03, 1.4, -1.5, E),
    pane(5.4, 2.7, 6.5, 1.65, 9.53, 0), pane(2.4, 2.3, 10.03, 1.45, 6.5, E),
    pane(1.8, 2.3, 2.97, 1.45, 7.5, W),
  ];

  const house = new THREE.Group();
  house.add(plinthA, plinthB, terrace, bodyA, bodyB, roofA, roofB, ...glass);
  scene.add(house);

  /* ── Structural frame (the engineering step) ── */
  const frame = new THREE.Group();
  const columns = [];
  for (let i = 0; i <= 6; i++) {
    const x = -7.7 + i * (15.4 / 6);
    columns.push(box(0.18, 2.75, 0.18, frameMat, x, 0.25, 3.25), box(0.18, 2.75, 0.18, frameMat, x, 0.25, -3.25));
  }
  [[3.3, 9.2], [6.5, 9.2], [9.7, 9.2], [9.7, 6.5], [9.7, 3.8]].forEach(([x, z]) => {
    columns.push(box(0.18, 3.15, 0.18, frameMat, x, 0.25, z));
  });
  columns.forEach((c) => frame.add(c));

  const beams = [
    beam(15.6, 0, 2.93, 3.25, 0, E), beam(15.6, 0, 2.93, -3.25, 0, E),
    beam(6.5, -7.7, 2.93, 0), beam(6.5, 7.7, 2.93, 0),
    beam(15.6, 0, 5.45, 0, 0, E),
    beam(6.4, 6.5, 3.33, 9.2, 0, E), beam(5.4, 9.7, 3.33, 6.5),
  ];
  beams.forEach((b) => frame.add(b));

  const rafters = [];
  const rafterLen = Math.hypot(3.25, 2.45);
  const pitch = Math.atan2(2.45, 3.25);
  for (let i = 0; i <= 8; i++) {
    const x = -7.7 + i * (15.4 / 8);
    rafters.push(beam(rafterLen, x, 3 + 1.225, 1.625, pitch), beam(rafterLen, x, 3 + 1.225, -1.625, -pitch));
  }
  rafters.forEach((r) => frame.add(r));
  scene.add(frame);

  /* ── Site trees ── */
  const trees = [
    [-12, -6, 1.3], [-15, 3, 1.1], [-11, 10.5, 1.5], [13, -5, 1.2], [16, 4, 1.0],
    [15, 12.5, 1.4], [-4, 12.8, 0.9], [2, 16, 1.2], [-17, -2, 0.9], [8, -10, 1.1],
  ].map(([x, z, r]) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.6, 8), trunkMat);
    trunk.position.y = 0.8;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), treeMat);
    crown.position.y = 1.6 + r * 0.75;
    trunk.castShadow = crown.castShadow = true;
    g.add(trunk, crown);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  });

  /* ── Sketch: every edge of the finished house as one pen stroke ── */
  house.updateMatrixWorld(true);
  const inkPos = [];
  [bodyA, roofA, bodyB, roofB, plinthA, plinthB, ...glass].forEach((m) => {
    const e = new THREE.EdgesGeometry(m.geometry, 20);
    e.applyMatrix4(m.matrixWorld);
    inkPos.push(...e.attributes.position.array);
    e.dispose();
  });
  const inkGeo = new THREE.BufferGeometry();
  inkGeo.setAttribute('position', new THREE.Float32BufferAttribute(inkPos, 3));
  const ink = new THREE.LineSegments(inkGeo, inkMat);
  scene.add(ink);
  const inkCount = inkPos.length / 3;
  const plotCount = plotPts.length;

  readPalette();
  new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── Pointer parallax ── */
  let mx = 0, my = 0, smx = 0, smy = 0;
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ── Size ── */
  let vw = 1, vh = 1;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.16, 0, w, h);      // model sits right of the text
    else if (w < 769) camera.setViewOffset(w, h, 0, h * 0.02, w, h);   // model sits between title and steps
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    onChange();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ── Helpers ── */
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const smooth = (p, a, b) => { const t = clamp01((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grow = (m, t) => { m.scale.y = Math.max(0.0001, t); m.visible = t > 0.001; };

  const cam = mobile
    ? { r0: 68, r1: 62, h0: 58, h1: 19, tx: 2.4 }
    : { r0: 44, r1: 47, h0: 50, h1: 12, tx: 3.4 };

  /* ── One frame for progress p (0..1). Returns the dusk amount. ── */
  function render(p, time) {
    resize();

    // 01 · Plot — grid, dashed boundary, trees
    gridMat.opacity = 0.5 * (1 - smooth(p, 0.5, 0.64));
    grid.visible = gridMat.opacity > 0.01;
    plot.geometry.setDrawRange(0, Math.max(2, Math.floor(plotCount * smooth(p, 0.0, 0.13))));
    plotMat.opacity = 0.85 * (1 - 0.6 * smooth(p, 0.6, 0.72));
    trees.forEach((t, i) => {
      const s = smooth(p, 0.02 + i * 0.008, 0.1 + i * 0.008);
      t.scale.setScalar(Math.max(0.0001, s));
      t.visible = s > 0.001;
    });

    // 02 · Sketch — the house drawn as lines
    let n = Math.floor(inkCount * smooth(p, 0.17, 0.31));
    n -= n % 2;
    ink.geometry.setDrawRange(0, n);
    ink.visible = n > 0;
    inkMat.opacity = lerp(1, 0.3, smooth(p, 0.5, 0.62));

    // 03 · Structure — foundation, columns, beams, rafters
    grow(plinthA, smooth(p, 0.335, 0.37));
    grow(plinthB, smooth(p, 0.345, 0.38));
    grow(terrace, smooth(p, 0.6, 0.66));
    columns.forEach((c, i) => grow(c, smooth(p, 0.36 + i * 0.0018, 0.41 + i * 0.0018)));
    const b = smooth(p, 0.41, 0.46);
    beams.forEach((m) => { m.scale.z = Math.max(0.0001, b); m.visible = b > 0.001; });
    rafters.forEach((m, i) => {
      const t = smooth(p, 0.44 + i * 0.002, 0.49 + i * 0.002);
      m.scale.z = Math.max(0.0001, t);
      m.visible = t > 0.001;
    });

    // 04 · Permit granted — walls rise, glazing appears
    grow(bodyA, smooth(p, 0.5, 0.6));
    grow(bodyB, smooth(p, 0.53, 0.63));
    glassMat.opacity = smooth(p, 0.6, 0.66);
    glass.forEach((g) => { g.visible = glassMat.opacity > 0.01; });

    // 05 · Roof — lowered into place
    const ra = smooth(p, 0.67, 0.77);
    roofA.position.y = 3.002 + (1 - easeOut(ra)) * 8;
    roofA.visible = ra > 0.001;
    const rb = smooth(p, 0.7, 0.79);
    roofB.position.y = 3.402 + (1 - easeOut(rb)) * 6;
    roofB.visible = rb > 0.001;

    // 06 · Move-in ready — evening falls, the lights come on
    const d = smooth(p, 0.84, 0.97);
    scene.background.copy(pal.bg).lerp(duskBg, d);
    scene.fog.color.copy(scene.background);
    groundMat.color.copy(pal.ground).lerp(duskGround, d);
    hemi.intensity = lerp(1.7, 0.62, d);
    hemi.color.set(0xffffff).lerp(skyDusk, d);
    sun.intensity = lerp(2.4, 0.28, d);
    sun.color.set(0xffffff).lerp(sunWarm, d);
    sun.position.copy(sunDay).lerp(sunDusk, d);
    glassMat.emissiveIntensity = lerp(0, 1.25, d);
    poolMat.opacity = lerp(0, 0.6, d);
    pools.forEach((m) => { m.visible = d > 0.01; });
    scene.fog.near = lerp(90, 34, d);
    scene.fog.far = lerp(220, 125, d);

    // Camera: from a high site view down to a low three-quarter view
    smx += (mx - smx) * 0.05;
    smy += (my - smy) * 0.05;
    const e = easeInOut(p);
    const theta = lerp(-0.95, 0.5, e) + smx * 0.07 + Math.sin(time * 0.00012) * 0.02;
    const radius = lerp(cam.r0, cam.r1, e);
    const height = lerp(cam.h0, cam.h1, e) + smy * 1.4;
    lookTarget.set(lerp(1.2, cam.tx, e), lerp(0.4, 2.2, e), lerp(3, 4.2, e));
    camera.position.set(lookTarget.x + Math.sin(theta) * radius, height, lookTarget.z + Math.cos(theta) * radius);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    return d;
  }

  return { render };
}
