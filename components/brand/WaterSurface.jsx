import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Latar halaman masuk: foto instalasi WTP dilihat seperti dari balik permukaan air bening.
// WebGL 1 tanpa pustaka: satu fragment shader menggeser (refraksi) foto mengikuti permukaan air, memberi warna
// duotone biru merek, dan menambah kilau cahaya. Permukaan air = gelombang pelan + riak dari "tetes":
// - drop(x, y, kekuatan) dipanggil dari luar (tetes logo yang jatuh saat intro);
// - gerakan kursor / sentuhan membuat riak kecil, klik membuat riak lebih besar;
// - sesekali tetes kecil jatuh sendiri supaya permukaan tetap hidup saat diam.
// Tanpa WebGL atau dengan prefers-reduced-motion: foto statis dengan duotone CSS (fallback), tanpa gerak.

const MAX_DROPS = 10;
const DARK = [3 / 255, 24 / 255, 46 / 255]; // bayangan: navy lebih dalam dari biru merek
const LIGHT = [156 / 255, 214 / 255, 240 / 255]; // sorotan: biru air yang terang

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uImage;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uTime;
uniform float uDpr;
uniform vec4 uDrops[${MAX_DROPS}];
uniform vec3 uDark;
uniform vec3 uLight;
varying vec2 vUv;

// Foto dipasang "cover" seperti object-fit: cover
vec2 coverUv(vec2 uv) {
  float rs = uRes.x / uRes.y;
  float ri = uImgSize.x / uImgSize.y;
  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}

// Tinggi permukaan air di titik p (piksel layar, asal kiri atas)
float surface(vec2 p) {
  vec2 q = p / uDpr;
  float h = 0.55 * sin(q.x * 0.011 + uTime * 0.55) * sin(q.y * 0.016 - uTime * 0.42);
  h += 0.3 * sin((q.x * 0.7 + q.y) * 0.019 - uTime * 0.75);
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    vec4 d = uDrops[i];
    float t = uTime - d.z;
    if (d.w <= 0.0 || t < 0.0 || t > 7.0) continue;
    float r = distance(q, d.xy);
    float x = r - t * 190.0;                       // jarak ke muka gelombang yang menyebar
    float env = exp(-(x * x) / 5200.0) * exp(-t * 0.75);
    h += d.w * env * sin(x * 0.075) * (1.0 - exp(-r * 0.02));
  }
  return h;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float e = 1.5 * uDpr;
  float hx = surface(p + vec2(e, 0.0)) - surface(p - vec2(e, 0.0));
  float hy = surface(p + vec2(0.0, e)) - surface(p - vec2(0.0, e));
  vec2 grad = vec2(hx, hy) / (2.0 * e / uDpr);

  // Refraksi: geser foto sesuai kemiringan permukaan (dalam piksel layar)
  vec2 offset = grad * 140.0 / uRes * uDpr;
  vec2 uv = coverUv(vUv) + vec2(offset.x, -offset.y);
  vec3 photo = texture2D(uImage, clamp(uv, 0.001, 0.999)).rgb;

  // Duotone biru merek
  float lum = dot(photo, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(uDark, uLight, smoothstep(0.04, 0.92, lum));

  // Kilau cahaya di punggung riak
  vec3 n = normalize(vec3(-grad * 6.0, 1.0));
  float spec = pow(max(dot(n, normalize(vec3(-0.35, 0.45, 1.0))), 0.0), 60.0);
  col += spec * 0.22;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}

const WaterSurface = forwardRef(function WaterSurface({ src, className = '' }, ref) {
  const canvasRef = useRef(null);
  const dropsRef = useRef([]); // [{x, y, t0, w}] dalam piksel CSS dan detik
  const clockRef = useRef(null);
  const [mode, setMode] = useState('init'); // init | webgl | static

  useImperativeHandle(ref, () => ({
    // x, y = koordinat layar (clientX/clientY), w = kekuatan riak (0..1,5)
    drop(x, y, w = 1) {
      const c = canvasRef.current;
      if (!c || !clockRef.current) return;
      const r = c.getBoundingClientRect();
      const list = dropsRef.current;
      list.push({ x: x - r.left, y: y - r.top, t0: clockRef.current(), w });
      if (list.length > MAX_DROPS) list.shift();
    },
  }));

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    const gl = !reduce && canvas && (canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }));
    if (!gl) { setMode('static'); return undefined; }

    let raf = 0;
    let disposed = false;
    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
    } catch (err) {
      setMode('static');
      return undefined;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name) => gl.getUniformLocation(program, name);
    const uRes = u('uRes'); const uImgSize = u('uImgSize'); const uTime = u('uTime'); const uDpr = u('uDpr');
    const uDrops = u('uDrops'); const uDark = u('uDark'); const uLight = u('uLight');
    gl.uniform3fv(uDark, DARK);
    gl.uniform3fv(uLight, LIGHT);

    const tex = gl.createTexture();
    const img = new Image();
    img.decoding = 'async';
    img.src = src;

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5);
    function resize() {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
    }

    const start = performance.now();
    const now = () => (performance.now() - start) / 1000;
    clockRef.current = now;
    const dropData = new Float32Array(MAX_DROPS * 4);

    function frame() {
      if (disposed) return;
      resize();
      dropData.fill(0);
      dropsRef.current.forEach((d, i) => { dropData.set([d.x, d.y, d.t0, d.w], i * 4); });
      gl.uniform4fv(uDrops, dropData);
      gl.uniform1f(uTime, now());
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }

    img.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // baris pertama gambar = atas layar
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform2f(uImgSize, img.naturalWidth, img.naturalHeight);
      setMode('webgl');
      frame();
    };
    img.onerror = () => setMode('static');

    // Riak dari kursor (dibatasi supaya tidak berlebihan), klik, dan sentuhan
    let last = { x: -999, y: -999, t: 0 };
    function onMove(e) {
      const t = performance.now();
      if (t - last.t < 120 || Math.hypot(e.clientX - last.x, e.clientY - last.y) < 28) return;
      last = { x: e.clientX, y: e.clientY, t };
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      dropsRef.current.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: now(), w: 0.35 });
      if (dropsRef.current.length > MAX_DROPS) dropsRef.current.shift();
    }
    function onDown(e) {
      const r = canvas.getBoundingClientRect();
      const pt = e.touches ? e.touches[0] : e;
      if (!pt || pt.clientY > r.bottom) return;
      dropsRef.current.push({ x: pt.clientX - r.left, y: pt.clientY - r.top, t0: now(), w: 1 });
      if (dropsRef.current.length > MAX_DROPS) dropsRef.current.shift();
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });

    // Sesekali satu tetes kecil jatuh sendiri
    const ambient = setInterval(() => {
      const w = canvas.clientWidth; const h = canvas.clientHeight;
      dropsRef.current.push({ x: w * (0.15 + Math.random() * 0.7), y: h * (0.15 + Math.random() * 0.7), t0: now(), w: 0.45 });
      if (dropsRef.current.length > MAX_DROPS) dropsRef.current.shift();
    }, 6500);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearInterval(ambient);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      clockRef.current = null;
      img.onload = null;
      img.onerror = null;
      // Sumber daya dihapus, konteksnya dibiarkan: kanvas yang sama dipakai lagi kalau efek dijalankan ulang
      // (React strict mode di dev memasang efek dua kali; konteks yang di-loseContext() tidak bisa dipakai lagi).
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    };
  }, [src]);

  return (
    <div className={`absolute inset-0 overflow-hidden water-base ${className}`} aria-hidden="true">
      {mode !== 'webgl' && (
        // Fallback statis: duotone yang sama dengan CSS (foto abu-abu x biru terang, lalu bayangan diangkat ke navy)
        <>
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover grayscale contrast-125" />
          <div className="absolute inset-0 water-tint" />
          <div className="absolute inset-0 water-lift" />
        </>
      )}
      <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${mode === 'webgl' ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
});

export default WaterSurface;
