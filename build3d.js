/* ══════════════════════════════════════════════════════════════
   build3d.js — "Fra tom grund til nøglefærdigt hus"
   A scroll-driven 3D model of the studio's own project — a single-storey
   white house with a hipped roof, timber terrace and garage annex — that
   builds itself in six steps: plot → sketch → structure → walls → roof →
   lights on.
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

// As a page hero, the plot and the sketch draw themselves on load;
// scrolling then carries the house from structure to lights-on.
const INTRO = 0.31;
const INTRO_MS = 2600;

function setup(section) {
  section.classList.add('is-live');
  const canvas = section.querySelector('.build3d-canvas');
  const steps = [...section.querySelectorAll('.build3d-step')];
  const fill = section.querySelector('.build3d-progress-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = section.classList.contains('build3d--hero');

  let current = reduced ? 1 : 0;
  let scene3d = null;
  let visible = false;
  let raf = 0;
  let lastStep = -1;
  let introStart = 0;

  function readProgress(now) {
    if (reduced) return 1;
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    const s = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    if (!hero) return s;
    if (s > 0.0005) return INTRO + s * (1 - INTRO);
    if (!introStart) return 0;
    const t = Math.min(1, Math.max(0, (now - introStart) / INTRO_MS));
    return INTRO * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
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
    const target = readProgress(performance.now());
    current += (target - current) * 0.09;
    if (Math.abs(target - current) < 0.0004) current = target;
    updateUI(current);
    section.classList.toggle('is-moving', current > (hero ? INTRO : 0) + 0.03);
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
        scene3d = createScene(THREE, canvas, kick, { hero });
        section.classList.add('is-ready');
        // Let the loading screen clear before the pen starts drawing
        if (hero) introStart = performance.now() + 700;
        kick();
      })
      .catch(() => section.classList.add('no-webgl'));
  }, { rootMargin: '150% 0px' });
  loader.observe(section);

  // Lets a single frame be rendered on demand (used for checks and print).
  section.renderAt = (p) => scene3d && scene3d.render(p, 0);
}

/* ─────────────────────────────────────────────────────────────── */

function createScene(THREE, canvas, onChange, opts = {}) {
  const mobile = matchMedia('(max-width: 768px)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const C = (hex) => new THREE.Color(hex);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 42 : 30, 1, 0.5, 700);
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
  scene.fog = new THREE.Fog(pal.bg.clone(), 150, 360);

  /* ── Light ── */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d2c3, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(1, 0, 0);
  scene.add(sun, sun.target);
  const sunDay = new THREE.Vector3(26, 42, 22);
  const sunDusk = new THREE.Vector3(-34, 12, 26);
  const sunWarm = C('#FF9F5A');
  const skyDusk = C('#9AA6BF');

  /* ── Textures drawn in code (no image downloads) ── */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Soft round glow: window light spilling onto the terrace at dusk
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

  // Hardwood decking laid along the house
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = woodCanvas.height = 512;
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#5A2F1E';
  wctx.fillRect(0, 0, 512, 512);
  const tones = ['#A65C3B', '#9A5234', '#B3694A', '#8C4A2F', '#A9603F', '#94502F', '#B06343'];
  for (let r = 0; r < 16; r++) {
    let px = -rnd() * 140;
    while (px < 512) {
      const len = 90 + rnd() * 150;
      wctx.fillStyle = tones[(rnd() * tones.length) | 0];
      wctx.fillRect(px + 1.5, r * 32 + 1.5, len - 3, 29);
      px += len;
    }
  }
  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.anisotropy = 4;

  /* ── Materials ── */
  const solid = (color, roughness = 0.92) => new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const fading = (color, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, transparent: true, opacity: 0 });
  const wallMat = solid('#F7F6F2');
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2E3240', roughness: 0.7, metalness: 0.15, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const fasciaMat = solid('#3A3D47', 0.6);
  const slabMat = solid('#ECEBE6');
  const concreteMat = solid('#C9C8C3', 0.95);
  const annexRoofMat = solid('#30323A', 0.8);
  const boundaryMat = solid('#5E616A', 0.9);
  const frameMat = solid('#9A917E', 0.6);
  const treeMat = solid('#C3C7B1', 1);
  const trunkMat = solid('#8A8271', 1);
  const winFrameMat = fading('#1F2023', 0.5);
  const railMat = fading('#2F3134', 0.45);
  const wellMat = fading('#4E5258', 1);
  const doorMat = fading('#DCDCD8', 0.8);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, transparent: true, opacity: 0 });
  const lawnMat = new THREE.MeshStandardMaterial({ color: '#7E8C5E', roughness: 1, transparent: true, opacity: 0 });
  const groundMat = new THREE.MeshStandardMaterial({ color: pal.ground.clone(), roughness: 1 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#5F6B78', roughness: 0.25, metalness: 0.15,
    emissive: C('#FFC98A'), emissiveIntensity: 0, transparent: true, opacity: 0,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: '#FFB86E', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const inkMat = new THREE.LineBasicMaterial({ color: pal.ink.clone(), transparent: true, opacity: 1 });
  const plotMat = new THREE.LineDashedMaterial({ color: pal.ink.clone(), dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.85 });
  const gridMat = new THREE.LineBasicMaterial({ color: pal.grid.clone(), transparent: true, opacity: 0.5 });

  /* ── Ground, grid and plot ── */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const gridPts = [];
  for (let i = -56; i <= 56; i += 2) {
    gridPts.push(i, 0.012, -56, i, 0.012, 56, -56, 0.012, i, 56, 0.012, i);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  scene.add(grid);

  // The plot: 40 × 36 m, with the boundary wall on its back edge
  const PX0 = -18, PX1 = 22, PZ0 = -20, PZ1 = 16;
  const plotCorners = [[PX0, PZ0], [PX1, PZ0], [PX1, PZ1], [PX0, PZ1], [PX0, PZ0]];
  const plotPts = [];
  for (let e = 0; e < 4; e++) {
    const [ax, az] = plotCorners[e];
    const [bx, bz] = plotCorners[e + 1];
    for (let k = 0; k < 80; k++) {
      const t = k / 80;
      plotPts.push(new THREE.Vector3(ax + (bx - ax) * t, 0.03, az + (bz - az) * t));
    }
  }
  plotPts.push(new THREE.Vector3(PX0, 0.03, PZ0));
  const plot = new THREE.Line(new THREE.BufferGeometry().setFromPoints(plotPts), plotMat);
  plot.computeLineDistances();
  scene.add(plot);

  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(PX1 - PX0, PZ1 - PZ0), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set((PX0 + PX1) / 2, 0.02, (PZ0 + PZ1) / 2);
  lawn.receiveShadow = true;
  scene.add(lawn);

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
  // A box spanning two corner coordinates (x0..x1, z0..z1)
  const span = (x0, x1, z0, z1, h, mat, y0 = 0) => box(x1 - x0, h, z1 - z0, mat, (x0 + x1) / 2, y0, (z0 + z1) / 2);
  // A thin member from point a to point b that "grows" along its length (scale.z)
  function strut(a, b, t = 0.14, mat = frameMat) {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const g = new THREE.BoxGeometry(t, t, len);
    g.translate(0, 0, len / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(A);
    m.lookAt(B);
    m.castShadow = true;
    return m;
  }
  const grow = (m, t) => { m.scale.y = Math.max(0.0001, t); m.visible = t > 0.001; };
  const growZ = (m, t) => { m.scale.z = Math.max(0.0001, t); m.visible = t > 0.001; };

  /* ── The house (from the project renders) ──
     Single storey, 20 × 10 m, white render, hipped roof with a deep eave.
     The west end is set back 1.4 m under the roof as a covered porch. */
  const FL = 0.45;          // floor / terrace level
  const WH = 3.0;           // wall height
  const TOP = FL + WH;      // eaves
  const E = 0.7;            // roof overhang
  const house = new THREE.Group();
  scene.add(house);

  const plinth = span(-10, 10, -5, 5, FL, slabMat);
  const bodyA = span(-7, 10, -5, 5, WH, wallMat, FL);
  const bodyB = span(-10, -7, -5, 3.6, WH, wallMat, FL);
  house.add(plinth, bodyA, bodyB);

  // Hipped roof: two trapezoids, two triangles and the soffit underneath
  function hipRoof(x0, x1, z0, z1, h) {
    const run = (z1 - z0) / 2;
    const zc = (z0 + z1) / 2;
    const a = [x0, 0, z0], b = [x1, 0, z0], c = [x1, 0, z1], d = [x0, 0, z1];
    const r0 = [x0 + run, h, zc], r1 = [x1 - run, h, zc];
    const tris = [d, c, r1, d, r1, r0, b, a, r0, b, r0, r1, a, d, r0, c, b, r1, a, b, c, a, c, d];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    return { geo: g, r0, r1, a, b, c, d };
  }
  const RH = 2.3;
  const hip = hipRoof(-10 - E, 10 + E, -5 - E, 5 + E, RH);
  const roof = new THREE.Group();
  const roofMesh = new THREE.Mesh(hip.geo, roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  roof.add(roofMesh);
  [
    [20 + 2 * E + 0.1, 0.1, 0, -5 - E], [20 + 2 * E + 0.1, 0.1, 0, 5 + E],
  ].forEach(([w, d, x, z]) => roof.add(box(w, 0.2, d, fasciaMat, x, -0.17, z)));
  [-10 - E, 10 + E].forEach((x) => roof.add(box(0.1, 0.2, 10 + 2 * E, fasciaMat, x, -0.17, 0)));
  roof.position.y = TOP;
  house.add(roof);

  // Windows and glazed doors — black frames, mullions, transoms
  const glass = [];
  const winFrames = [];
  const FRONT = 0, BACK = Math.PI, WEST = -Math.PI / 2, EAST = Math.PI / 2;
  function win(x, z, ry, w, h, cols, transom = false, y0 = FL + 0.12) {
    const g = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    pane.position.y = h / 2;
    g.add(pane);
    glass.push(pane);
    const t = 0.07;
    const bar = (bw, bh, bx, by) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), winFrameMat);
      b.position.set(bx, by, 0.02);
      g.add(b);
      winFrames.push(b);
    };
    bar(w + t, t, 0, h);
    bar(w + t, t, 0, 0);
    bar(t, h, -w / 2, h / 2);
    bar(t, h, w / 2, h / 2);
    for (let i = 1; i < cols; i++) bar(t * 0.8, h, -w / 2 + (w * i) / cols, h / 2);
    if (transom) bar(w, t * 0.8, 0, h * 0.64);
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.03);
    g.position.set(x + n.x, y0, z + n.z);
    g.rotation.y = ry;
    house.add(g);
  }
  // Terrace side (south)
  win(-8.5, 3.6, FRONT, 0.95, 2.3, 1, false, FL + 0.02);
  win(-5.6, 5, FRONT, 2.4, 2.4, 3, false, FL + 0.02);
  win(-1.6, 5, FRONT, 4.4, 2.3, 6, true);
  win(1.6, 5, FRONT, 0.95, 2.3, 1, false, FL + 0.02);
  win(4.3, 5, FRONT, 1.2, 2.2, 2, true);
  win(7.5, 5, FRONT, 2.4, 2.3, 2, true);
  // West gable end: two big glazed doors to the terrace
  win(-10, -2.4, WEST, 2.6, 2.4, 3, false, FL + 0.02);
  win(-10, 1.3, WEST, 2.4, 2.4, 3, false, FL + 0.02);
  // East end
  win(10, -1.0, EAST, 1.8, 2.3, 3, true);
  // North side (garden / basement court)
  win(-6.2, -5, BACK, 1.6, 2.2, 2, true);
  win(-3.4, -5, BACK, 2.2, 2.2, 4, true);
  win(-0.6, -5, BACK, 0.95, 2.2, 1, false, FL + 0.02);
  win(2.4, -5, BACK, 1.6, 2.2, 2, true);
  win(5.2, -5, BACK, 1.4, 2.2, 2, true);
  win(8, -5, BACK, 0.8, 2.2, 1);

  /* ── Terrace: hardwood deck on a white edge, L-shaped round the west end ── */
  const deckParts = [[-7, 10, 5, 13], [-14, -7, 3.6, 13], [-14, -10, -3, 3.6]];
  const deckSlabs = deckParts.map(([x0, x1, z0, z1]) => span(x0, x1, z0, z1, FL, slabMat));
  const deckTops = deckParts.map(([x0, x1, z0, z1]) => {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
    const m = new THREE.Mesh(g, woodMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, FL + 0.003, (z0 + z1) / 2);
    m.receiveShadow = true;
    return m;
  });
  scene.add(...deckSlabs, ...deckTops);

  // Steel railing with horizontal bars on the open edge of the terrace
  const railing = new THREE.Group();
  function rail(a, b) {
    const [ax, az] = a, [bx, bz] = b;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.8));
    for (let i = 0; i <= n; i++) {
      const p = box(0.06, 1.05, 0.06, railMat, ax + ((bx - ax) * i) / n, FL, az + ((bz - az) * i) / n);
      railing.add(p);
    }
    [0.28, 0.55, 0.8, 1.05].forEach((y) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), railMat);
      r.position.set((ax + bx) / 2, FL + y, (az + bz) / 2);
      r.rotation.y = Math.atan2(bx - ax, bz - az);
      railing.add(r);
    });
  }
  rail([-14, -3], [-14, 13]);
  rail([-14, 13], [-6, 13]);
  rail([-14, -3], [-10.2, -3]);
  scene.add(railing);

  /* ── Concrete court, basement light well, garage annex, boundary wall ── */
  const concrete = [span(10, 17, -9, 13, FL, concreteMat), span(3, 10, -9, -5, FL, concreteMat), span(12, 19, -10, -9, FL, concreteMat)];
  scene.add(...concrete);
  const well = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.6), wellMat);
  well.rotation.x = -Math.PI / 2;
  well.position.set(6.5, FL + 0.004, -6.6);
  scene.add(well);
  rail([4, -7.9], [9, -7.9]);

  const annex = span(12, 19, -17, -10, 3.0, wallMat);
  const annexRoof = box(7.4, 0.3, 7.4, annexRoofMat, 15.5, 0, -13.5);
  annexRoof.position.y = 3.0;
  const garageDoor = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), doorMat);
  garageDoor.position.set(15.5, 1.2, -9.97);
  scene.add(annex, annexRoof, garageDoor);

  const boundary = [span(PX0, PX1, PZ0, PZ0 + 0.3, 1.4, boundaryMat), span(PX1 - 0.3, PX1, PZ0, -2, 1.4, boundaryMat)];
  scene.add(...boundary);

  /* ── Structural frame (the engineering step) ── */
  const frame = new THREE.Group();
  const columns = [];
  const col = (x, z) => columns.push(box(0.18, WH, 0.18, frameMat, x, FL, z));
  for (let i = 0; i <= 7; i++) col(-7 + (17 * i) / 7, 4.9);
  for (let i = 0; i <= 8; i++) col(-10 + (20 * i) / 8, -4.9);
  [-10, -7].forEach((x) => col(x + (x < -8 ? 0.1 : 0), 3.5));
  [-2.8, -0.6, 1.5].forEach((z) => col(-9.9, z));
  [-2.5, 0, 2.5].forEach((z) => col(9.9, z));
  columns.forEach((c) => frame.add(c));

  const beams = [
    strut([-7, TOP, 4.9], [10, TOP, 4.9]), strut([-10, TOP, 3.5], [-7, TOP, 3.5]),
    strut([-7, TOP, 3.5], [-7, TOP, 4.9]), strut([10, TOP, -4.9], [-10, TOP, -4.9]),
    strut([-9.9, TOP, -5], [-9.9, TOP, 3.6]), strut([9.9, TOP, 5], [9.9, TOP, -5]),
  ];
  beams.forEach((b) => frame.add(b));

  // Roof framing: ridge, four hip rafters, common and jack rafters
  const at = (p) => [p[0], TOP + p[1], p[2]];
  const ridge = [strut(at(hip.r0), at(hip.r1), 0.18)];
  const hips = [strut(at(hip.a), at(hip.r0)), strut(at(hip.d), at(hip.r0)), strut(at(hip.b), at(hip.r1)), strut(at(hip.c), at(hip.r1))];
  const rafters = [];
  const run = 5 + E, x0 = -10 - E, x1 = 10 + E;
  for (let x = x0 + 1.2; x < x1 - 0.6; x += 1.3) {
    // where this rafter meets the ridge or the hip line
    const s = Math.min(1, (x - x0) / run, (x1 - x) / run);
    [1, -1].forEach((side) => rafters.push(strut([x, TOP, side * run], [x, TOP + RH * s, side * run * (1 - s)], 0.11)));
  }
  for (let z = -run + 1.2; z < run - 0.6; z += 1.3) {
    const s = (run - Math.abs(z)) / run;
    [[x0, 1], [x1, -1]].forEach(([xe, dir]) => rafters.push(strut([xe, TOP, z], [xe + dir * run * s, TOP + RH * s, z], 0.11)));
  }
  [...ridge, ...hips, ...rafters].forEach((m) => frame.add(m));
  scene.add(frame);

  /* ── Site trees, outside the plot ── */
  const trees = [
    [-23, -12, 1.4], [-24, 2, 1.2], [-22, 13, 1.6], [27, -14, 1.3], [28, 0, 1.1],
    [26, 12, 1.5], [-6, 21, 1.0], [6, 22, 1.3], [15, 20, 1.1], [-12, -25, 1.2],
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

  /* ── Sketch: every edge of the finished project as one pen stroke ── */
  scene.updateMatrixWorld(true);
  const inkPos = [];
  [bodyA, bodyB, roofMesh, plinth, ...deckSlabs, ...concrete, annex, annexRoof, ...glass].forEach((m) => {
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

  /* ── Warm light pools in front of the big windows ── */
  const pools = [
    [-5.6, FL, 6.8, 4.6, 3.6], [-1.6, FL, 7, 6.6, 4], [7.5, FL, 6.8, 4.6, 3.6], [4.3, FL, 6.4, 2.6, 2.6],
    [-11.8, FL, -2.4, 3.2, 4.4], [-11.8, FL, 1.3, 3.2, 4.2], [11.6, FL, -1, 3, 3.6],
    [-3.4, 0, -6.8, 4, 3.2], [-6.2, 0, -6.6, 3, 2.8],
  ].map(([x, y, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), poolMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.06, z);
    m.renderOrder = 2;
    scene.add(m);
    return m;
  });

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
    if (w >= 900 && opts.hero) camera.setViewOffset(w, h, -w * 0.24, h * 0.06, w, h); // right of the headline, above the timeline
    else if (w >= 900) camera.setViewOffset(w, h, -w * 0.16, 0, w, h);    // model sits right of the text
    else if (w < 769) camera.setViewOffset(w, h, 0, h * (opts.hero ? -0.05 : 0.02), w, h); // model sits between title and steps
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

  const cam = mobile
    ? { r0: 96, r1: 104, h0: 82, h1: 31, tx: 3, tz: 1 }
    : { r0: 64, r1: 62, h0: 70, h1: 16, tx: 7.5, tz: 1 };
  if (opts.hero && !mobile) Object.assign(cam, { r0: 84, r1: 70, h0: 80, h1: 17 });

  /* ── One frame for progress p (0..1). Returns the dusk amount. ── */
  function render(p, time) {
    resize();

    // 01 · Plot — grid, dashed boundary, trees
    gridMat.opacity = 0.5 * (1 - smooth(p, 0.5, 0.64));
    grid.visible = gridMat.opacity > 0.01;
    plot.geometry.setDrawRange(0, Math.max(2, Math.floor(plotCount * smooth(p, 0.0, 0.13))));
    plotMat.opacity = 0.85 * (1 - 0.7 * smooth(p, 0.6, 0.72));
    trees.forEach((t, i) => {
      const s = smooth(p, 0.02 + i * 0.008, 0.1 + i * 0.008);
      t.scale.setScalar(Math.max(0.0001, s));
      t.visible = s > 0.001;
    });

    // 02 · Sketch — the whole project drawn as lines
    let n = Math.floor(inkCount * smooth(p, 0.17, 0.31));
    n -= n % 2;
    ink.geometry.setDrawRange(0, n);
    ink.visible = n > 0;
    inkMat.opacity = lerp(1, 0.18, smooth(p, 0.5, 0.75));

    // 03 · Structure — foundation, columns, ring beam, roof framing
    grow(plinth, smooth(p, 0.335, 0.37));
    concrete.forEach((c, i) => grow(c, smooth(p, 0.345 + i * 0.005, 0.385 + i * 0.005)));
    wellMat.opacity = smooth(p, 0.38, 0.4);
    well.visible = wellMat.opacity > 0.01;
    columns.forEach((c, i) => grow(c, smooth(p, 0.36 + i * 0.0012, 0.4 + i * 0.0012)));
    beams.forEach((b, i) => growZ(b, smooth(p, 0.4 + i * 0.002, 0.43 + i * 0.002)));
    ridge.forEach((b) => growZ(b, smooth(p, 0.425, 0.445)));
    hips.forEach((b, i) => growZ(b, smooth(p, 0.43 + i * 0.002, 0.455 + i * 0.002)));
    rafters.forEach((m, i) => growZ(m, smooth(p, 0.44 + i * 0.0006, 0.47 + i * 0.0006)));

    // 04 · Permit granted — walls rise, garden, terrace, glazing
    lawnMat.opacity = smooth(p, 0.5, 0.62);
    lawn.visible = lawnMat.opacity > 0.01;
    grow(bodyA, smooth(p, 0.5, 0.6));
    grow(bodyB, smooth(p, 0.52, 0.61));
    grow(annex, smooth(p, 0.53, 0.63));
    boundary.forEach((b, i) => grow(b, smooth(p, 0.55 + i * 0.01, 0.64 + i * 0.01)));
    deckSlabs.forEach((d, i) => grow(d, smooth(p, 0.57 + i * 0.006, 0.62 + i * 0.006)));
    woodMat.opacity = smooth(p, 0.62, 0.66);
    deckTops.forEach((d) => { d.visible = woodMat.opacity > 0.01; });
    const g = smooth(p, 0.6, 0.66);
    glassMat.opacity = g;
    winFrameMat.opacity = g;
    doorMat.opacity = g;
    glass.forEach((m) => { m.visible = g > 0.01; });
    winFrames.forEach((m) => { m.visible = g > 0.01; });
    garageDoor.visible = g > 0.01;
    railMat.opacity = smooth(p, 0.64, 0.7);
    railing.visible = railMat.opacity > 0.01;

    // 05 · Roof — lowered into place
    const ra = smooth(p, 0.67, 0.77);
    roof.position.y = TOP + (1 - easeOut(ra)) * 9;
    roof.visible = ra > 0.001;
    // Once the roof has landed the framing underneath would only poke through it
    if (ra > 0.97) [...ridge, ...hips, ...rafters].forEach((m) => { m.visible = false; });
    const rb = smooth(p, 0.7, 0.79);
    annexRoof.position.y = 3.0 + (1 - easeOut(rb)) * 6;
    annexRoof.visible = rb > 0.001;

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
    scene.fog.near = lerp(150, 60, d);
    scene.fog.far = lerp(360, 175, d);

    // Camera: from a high site view down to a low three-quarter view
    smx += (mx - smx) * 0.05;
    smy += (my - smy) * 0.05;
    const e = easeInOut(p);
    const theta = lerp(-0.95, 0.5, e) + smx * 0.07 + Math.sin(time * 0.00012) * 0.02;
    const radius = lerp(cam.r0, cam.r1, e);
    const height = lerp(cam.h0, cam.h1, e) + smy * 1.6;
    lookTarget.set(lerp(2, cam.tx, e), lerp(0.4, 2.2, e), lerp(-2, cam.tz, e));
    camera.position.set(lookTarget.x + Math.sin(theta) * radius, height, lookTarget.z + Math.cos(theta) * radius);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    return d;
  }

  return { render };
}
