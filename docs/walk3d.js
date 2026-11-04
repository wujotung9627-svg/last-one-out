// Walking forward into a photo. Each photo becomes a shallow 3D surface shaped by a
// depth map, and the camera moves into it: near things rush past while the far end
// of the corridor barely moves. At rest the surface lines up exactly with the photo.

const GRID_X = 160;
const GRID_Y = 106;
const NEAR = 1; // distance of the nearest surface (depth map white)
const FAR = 6; // distance of the farthest surface (depth map black)
const TAN_Y = 0.45;
const TAN_X = TAN_Y * 1.5; // photos are 3:2
const WALK_DEPTH = 0.55; // how far one walk moves in; must stay below NEAR
const DEPTH_W = 192;
const DEPTH_H = 128;

// uTan builds the surface from the photo; uView is the lens we look through. Widening
// uView while walking in is a dolly zoom: the far end slides away as you approach it.
// uWobble makes the walls breathe.
const VERTEX = `#version 300 es
in vec2 aUv;
uniform sampler2D uDepth;
uniform vec3 uCam;
uniform vec2 uTan;
uniform vec2 uView;
uniform float uWobble;
uniform float uTime;
out vec2 vUv;
void main() {
  vUv = aUv;
  float d = texture(uDepth, aUv).r;
  float dist = mix(${FAR.toFixed(1)}, ${NEAR.toFixed(1)}, d);
  dist *= 1.0 + uWobble * 0.05 * sin(aUv.y * 14.0 + uTime * 3.1) * sin(aUv.x * 9.0 + uTime * 2.3);
  vec2 ndc = vec2(aUv.x * 2.0 - 1.0, 1.0 - aUv.y * 2.0);
  vec3 p = vec3(ndc * uTan, -1.0) * dist - uCam;
  float z = -p.z;
  const float n = 0.05;
  const float f = 20.0;
  gl_Position = vec4(p.x / uView.x, p.y / uView.y, z * (f + n) / (f - n) - 2.0 * f * n / (f - n), z);
}`;

// uSplit pulls red and blue apart, like a cheap lens failing.
const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uPhoto;
uniform float uAlpha;
uniform float uSplit;
out vec4 color;
void main() {
  vec2 shift = (vUv - 0.5) * uSplit;
  float r = texture(uPhoto, vUv + shift).r;
  vec2 gb = texture(uPhoto, vUv).gb;
  float b = texture(uPhoto, vUv - shift).b;
  color = vec4(r, gb.x, b, uAlpha);
}`;

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clamp01 = (k) => Math.min(1, Math.max(0, k));

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function depthCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = DEPTH_W;
  canvas.height = DEPTH_H;
  return canvas;
}

// Rough depth when no depth map is available. Our photos are one-point perspective,
// so each scene is treated as a box seen from inside: floor, ceiling and side walls
// converge on the vanishing point and the far wall closes it off. Planes keep
// straight lines straight while walking. vx / vy are the vanishing point in NDC.
const BOXES = {
  corridor: { vx: 0, vy: 0.04, far: FAR, walls: true, ceiling: true },
  classroom: { vx: 0, vy: 0.1, far: 4, walls: true, ceiling: true },
  door: { vx: 0, vy: -0.3, far: 3, walls: false, ceiling: false }, // a flat wall facing you, floor below
};
const WALL_X = NEAR * TAN_X * 0.95;
const WALL_Y = NEAR * TAN_Y * 1.05;

function guessedDepth(sceneId) {
  const box = BOXES[sceneId] ?? BOXES.corridor;
  const canvas = depthCanvas();
  const g = canvas.getContext('2d');
  const image = g.createImageData(DEPTH_W, DEPTH_H);
  for (let y = 0; y < DEPTH_H; y++) {
    for (let x = 0; x < DEPTH_W; x++) {
      const ndcX = (x / (DEPTH_W - 1)) * 2 - 1;
      const ndcY = 1 - (y / (DEPTH_H - 1)) * 2;
      const toWall = box.walls ? WALL_X / Math.max(1e-3, Math.abs(ndcX - box.vx) * TAN_X) : Infinity;
      const above = ndcY > box.vy;
      const toFloor = above && !box.ceiling ? Infinity : WALL_Y / Math.max(1e-3, Math.abs(ndcY - box.vy) * TAN_Y);
      const z = Math.min(box.far, toWall, toFloor);
      const d = (FAR - z) / (FAR - NEAR);
      const v = Math.round(clamp01(d) * 255);
      const i = (y * DEPTH_W + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

// A depth map drawn by the image model. Rejected unless it really looks like one:
// grey, with real contrast, and brighter (nearer) at the bottom than in the middle.
async function drawnDepth(url) {
  const img = await loadImage(url);
  if (!img) return null;
  const canvas = depthCanvas();
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(2px)';
  g.drawImage(img, 0, 0, DEPTH_W, DEPTH_H);
  const image = g.getImageData(0, 0, DEPTH_W, DEPTH_H);
  const px = image.data;
  let chroma = 0;
  let sum = 0;
  let sumSq = 0;
  let bottom = 0;
  let middle = 0;
  const count = DEPTH_W * DEPTH_H;
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    chroma += Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
    sum += lum;
    sumSq += lum * lum;
    const y = Math.floor(p / DEPTH_W);
    const x = p % DEPTH_W;
    if (y > DEPTH_H * 0.85) bottom += lum;
    if (Math.abs(x - DEPTH_W / 2) < DEPTH_W * 0.1 && Math.abs(y - DEPTH_H * 0.46) < DEPTH_H * 0.1) middle += lum;
  }
  const mean = sum / count;
  const spread = Math.sqrt(sumSq / count - mean * mean);
  if (chroma / count > 18 || spread < 15) return null;
  const invert = bottom / (DEPTH_W * DEPTH_H * 0.15) < middle / (DEPTH_W * 0.2 * DEPTH_H * 0.2);
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = invert ? 255 - lum : lum;
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

// Head height while walking: lowest when a footstep lands (0.05 s, then every 0.5 s).
function stepBob(t) {
  return 0.014 * Math.cos((2 * Math.PI * (t + 0.2)) / 0.5);
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

export function createWalker(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn('3D walk unavailable:', err.message);
    return null;
  }

  const uvs = new Float32Array((GRID_X + 1) * (GRID_Y + 1) * 2);
  for (let y = 0, i = 0; y <= GRID_Y; y++) {
    for (let x = 0; x <= GRID_X; x++) {
      uvs[i++] = x / GRID_X;
      uvs[i++] = y / GRID_Y;
    }
  }
  const indices = new Uint16Array(GRID_X * GRID_Y * 6);
  for (let y = 0, i = 0; y < GRID_Y; y++) {
    for (let x = 0; x < GRID_X; x++) {
      const a = y * (GRID_X + 1) + x;
      const b = a + GRID_X + 1;
      indices.set([a, b, a + 1, a + 1, b, b + 1], i);
      i += 6;
    }
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  const aUv = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const loc = {
    depth: uniform('uDepth'),
    photo: uniform('uPhoto'),
    cam: uniform('uCam'),
    tan: uniform('uTan'),
    view: uniform('uView'),
    wobble: uniform('uWobble'),
    time: uniform('uTime'),
    split: uniform('uSplit'),
    alpha: uniform('uAlpha'),
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function texture(source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  const cache = new Map(); // photo url -> { photo, depth } textures

  async function prepare(scene) {
    if (cache.has(scene.photo)) return cache.get(scene.photo);
    const photo = await loadImage(scene.photo);
    if (!photo) throw new Error('photo did not load');
    const depth = (scene.depth && (await drawnDepth(scene.depth))) || guessedDepth(scene.id);
    const entry = { photo: texture(photo), depth: texture(depth) };
    cache.set(scene.photo, entry);
    if (cache.size > 12) {
      const [oldUrl, old] = cache.entries().next().value;
      gl.deleteTexture(old.photo);
      gl.deleteTexture(old.depth);
      cache.delete(oldUrl);
    }
    return entry;
  }

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  // Each layer: { entry, cam, alpha, lens (1 = normal, >1 = wider), wobble, split }.
  function frame(layers) {
    resize();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(loc.tan, TAN_X, TAN_Y);
    gl.uniform1f(loc.time, performance.now() / 1000);
    for (const layer of layers) {
      const lens = layer.lens ?? 1;
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, layer.entry.photo);
      gl.uniform1i(loc.photo, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, layer.entry.depth);
      gl.uniform1i(loc.depth, 1);
      gl.uniform3f(loc.cam, ...layer.cam);
      gl.uniform2f(loc.view, TAN_X * lens, TAN_Y * lens);
      gl.uniform1f(loc.wobble, layer.wobble ?? 0);
      gl.uniform1f(loc.split, layer.split ?? 0);
      gl.uniform1f(loc.alpha, layer.alpha);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }
  }

  function animate(ms, render) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (now) => {
        const k = clamp01((now - start) / ms);
        render(k);
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  return {
    // Walk from one photo into the next: move into the first, then cross into the
    // second as it settles from slightly behind into place.
    // warp (0 = none, ~1 = strong) grows with every walk: the dolly zoom, the breathing
    // walls and the lens split all get worse the longer you stay.
    // A photo whose depth map arrived later: its next use loads the real depth.
    forget(url) {
      const old = cache.get(url);
      if (!old) return;
      gl.deleteTexture(old.photo);
      gl.deleteTexture(old.depth);
      cache.delete(url);
    },

    async walk(from, to, ms, { warp = 0, onStart = null } = {}) {
      const [a, b] = await Promise.all([prepare(from), prepare(to)]);
      onStart?.(); // the footsteps start with the movement, not before it
      await animate(ms, (k) => {
        const go = ease(clamp01(k / 0.8));
        // Each footstep (heard every half second from 0.05 s) is the lowest point of a
        // step: the head dips as the heel lands and rises between steps.
        const t = (k * ms) / 1000;
        const bob = stepBob(t) * (1 - 0.35 * k);
        const sway = Math.sin(((t + 0.2) / 0.5) * Math.PI) * 0.006 * (1 + warp);
        // Into the dark first, then the next photo: a short overlap, no double image.
        const dim = clamp01((k - 0.58) / 0.22);
        const cross = ease(clamp01((k - 0.76) / 0.24));
        const peak = Math.sin(k * Math.PI);
        const layers = [
          {
            entry: a,
            cam: [sway, bob, -WALK_DEPTH * go],
            alpha: 1 - 0.75 * dim,
            lens: 1 + warp * 0.45 * go,
            wobble: warp * peak,
            split: warp * 0.012 * peak,
          },
        ];
        if (cross > 0) {
          layers.push({
            entry: b,
            cam: [0, bob * 0.5, 0.3 * (1 - cross)],
            alpha: cross,
            lens: 1 + warp * 0.25 * (1 - cross),
            wobble: warp * (1 - cross) * 0.6,
            split: warp * 0.008 * (1 - cross),
          });
        }
        frame(layers);
      });
      frame([{ entry: b, cam: [0, 0, 0], alpha: 1 }]);
    },

    // Arriving at the start of a walk: out of the dark, settling into place.
    async arrive(scene, ms, { warp = 0, onStart = null } = {}) {
      const entry = await prepare(scene);
      onStart?.();
      await animate(ms, (k) =>
        frame([
          {
            entry,
            cam: [Math.sin((((k * ms) / 1000 + 0.2) / 0.5) * Math.PI) * 0.005, stepBob((k * ms) / 1000) * (1 - k), 0.35 * (1 - ease(k))],
            alpha: ease(k),
            lens: 1 + warp * 0.3 * (1 - ease(k)),
            wobble: warp * (1 - k) * 0.6,
            split: warp * 0.01 * (1 - k),
          },
        ]),
      );
    },
  };
}
