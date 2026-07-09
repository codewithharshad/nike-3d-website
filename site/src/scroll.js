// Shared state bridging the DOM (Lenis, pointer events) and the 3D scene.
// Written by App.jsx, read every frame by Experience.jsx without re-renders.
export const scrollState = {
  progress: 0,
  velocity: 0, // normalized -1..1
}

export const pointerState = {
  x: 0,
  y: 0,
}

// Angular velocity injected by grab-and-flick dragging (rad/s)
export const spinState = {
  velocity: 0,
}
