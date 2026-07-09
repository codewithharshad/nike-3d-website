# Nike AeroGlide — 3D Scroll Experience

A scroll-driven 3D product page for the AeroGlide shoe, built with React Three Fiber.

## Stack

- **Vite + React** — app shell
- **Three.js + @react-three/fiber + @react-three/drei** — 3D rendering
- **Lenis** — smooth scrolling that drives the shoe animation

## Project structure

```
├── public/          # static assets (optimized 3D model, product images, icons)
├── src/             # React app: App.jsx, Experience.jsx (3D scene), scroll.js
├── scripts/         # dev utilities for capturing/diffing scroll frames
├── index.html
└── vite.config.js
```

## How the scroll interaction works

- The 3D canvas is fixed full-screen behind the page content.
- Lenis reports scroll progress (0–1) into a shared `scrollState` object (`src/scroll.js`).
- `src/Experience.jsx` defines one keyframe (position / rotation / scale) per page
  section and interpolates between them each frame with damped smoothing, so the
  shoe rotates and travels as you scroll. The pointer adds a subtle parallax.

## Assets

- `public/models/shoe.glb` — optimized from the original 61 MB GLB down to ~0.9 MB
  (mesh simplification + meshopt compression + WebP textures via gltf-transform).
- `public/images/` — product multiview renders used in the gallery.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```
