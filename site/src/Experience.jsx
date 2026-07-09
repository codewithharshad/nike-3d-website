import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  useGLTF,
  Environment,
  Float,
  Sparkles,
} from '@react-three/drei'
import * as THREE from 'three'
import { scrollState, pointerState, spinState } from './scroll.js'

const MODEL_URL = '/models/shoe.glb'

/*
 * Keyframes for the shoe, one per page section (progress 0 → 1).
 * pos / rot are for the shoe group; the camera stays put so the
 * shoe itself performs for the viewer as they scroll.
 */
const KEYFRAMES = [
  // 0 — Hero: side profile, slightly angled, peeking around the headline
  { pos: [0.05, -0.32, 0], rot: [0.05, Math.PI * 0.5 + 0.35, -0.06], scale: 2.25 },
  // 1 — Airflow: nose-in toward camera, showing the perforated upper
  { pos: [0.85, 0.02, 0.2], rot: [0.25, Math.PI * 1.18, 0.12], scale: 2.2 },
  // 2 — Cushion: rolled to show the sculpted midsole from below
  { pos: [-0.85, 0.05, 0.15], rot: [-0.5, Math.PI * 1.85, 0.4], scale: 2.1 },
  // 3 — Traction: sole facing the camera, orange lugs on display
  { pos: [0.8, 0, 0.3], rot: [-1.35, Math.PI * 2.5, 0.55], scale: 2.0 },
  // 4 — Finale: side profile tipped back so the sole stays in view
  { pos: [0, -0.15, 0.1], rot: [-0.55, Math.PI * 2.5 + 0.3, 0.15], scale: 2.4 },
]

/*
 * Portrait variant: same rotations (so the story reads the same), but the
 * shoe stays centered and drops into the free space below the text, sized
 * to fill the narrow frame without cropping.
 */
const PORTRAIT_KEYFRAMES = [
  { pos: [0, -0.55, 0], rot: KEYFRAMES[0].rot, scale: 1.5 },
  { pos: [0.05, -0.5, 0.2], rot: KEYFRAMES[1].rot, scale: 1.8 },
  { pos: [-0.05, -0.5, 0.15], rot: KEYFRAMES[2].rot, scale: 1.6 },
  { pos: [0.05, -0.45, 0.3], rot: KEYFRAMES[3].rot, scale: 1.65 },
  { pos: [0, -0.4, 0.1], rot: KEYFRAMES[4].rot, scale: 1.55 },
]

function lerpKeyframes(progress, frames) {
  const segments = frames.length - 1
  const t = THREE.MathUtils.clamp(progress, 0, 1) * segments
  const i = Math.min(Math.floor(t), segments - 1)
  const f = THREE.MathUtils.smoothstep(t - i, 0, 1)
  const a = frames[i]
  const b = frames[i + 1]
  return {
    pos: a.pos.map((v, k) => THREE.MathUtils.lerp(v, b.pos[k], f)),
    rot: a.rot.map((v, k) => THREE.MathUtils.lerp(v, b.rot[k], f)),
    scale: THREE.MathUtils.lerp(a.scale, b.scale, f),
  }
}

/*
 * Safety net: clamp a pose so the shoe always stays fully inside the
 * viewport, whatever the screen size or scroll position. Projects the
 * model's bounding box through the current rotation, measures the visible
 * area at the shoe's depth, then caps scale and pulls the position in.
 */
const MODEL_HALF = [0.2, 0.212, 0.49] // half-extents of the centered GLB
const CAMERA_Z = 3.4
const HALF_FOV_TAN = Math.tan(THREE.MathUtils.degToRad(19))
const _fitEuler = new THREE.Euler()
const _fitMat = new THREE.Matrix4()

function fitToView(pos, rot, scale, aspect) {
  _fitEuler.set(rot[0], rot[1], rot[2])
  _fitMat.makeRotationFromEuler(_fitEuler)
  const e = _fitMat.elements
  // Half width/height of the rotated bounding box (scale 1)
  const ex = Math.abs(e[0]) * MODEL_HALF[0] + Math.abs(e[4]) * MODEL_HALF[1] + Math.abs(e[8]) * MODEL_HALF[2]
  const ey = Math.abs(e[1]) * MODEL_HALF[0] + Math.abs(e[5]) * MODEL_HALF[1] + Math.abs(e[9]) * MODEL_HALF[2]
  // Visible half extents at the shoe's depth (margin for float/drag wobble)
  const halfH = HALF_FOV_TAN * (CAMERA_Z - pos[2]) * 0.92
  const halfW = halfH * aspect
  const s = Math.min(scale, halfW / ex, halfH / ey)
  return {
    pos: [
      THREE.MathUtils.clamp(pos[0], -(halfW - s * ex), halfW - s * ex),
      THREE.MathUtils.clamp(pos[1], -(halfH - s * ey), halfH - s * ey),
      pos[2],
    ],
    scale: s,
  }
}

function Shoe() {
  const group = useRef()
  const inner = useRef()
  const spin = useRef(0)
  const { scene } = useGLTF(MODEL_URL)

  const model = useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.material.envMapIntensity = 1.1
      }
    })
    // Center the geometry so rotations pivot around the shoe's core
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    scene.position.sub(center)
    return scene
  }, [scene])

  useFrame((state, delta) => {
    const g = group.current

    // Blend between the desktop and portrait choreography by aspect ratio:
    // fully desktop above ~1.4, fully portrait below ~0.9.
    const aspect = state.size.width / state.size.height
    const portrait = THREE.MathUtils.clamp((1.4 - aspect) / 0.5, 0, 1)
    const dk = lerpKeyframes(scrollState.progress, KEYFRAMES)
    const pk = lerpKeyframes(scrollState.progress, PORTRAIT_KEYFRAMES)
    const rawPos = dk.pos.map((v, k) => THREE.MathUtils.lerp(v, pk.pos[k], portrait))
    const rot = dk.rot.map((v, k) => THREE.MathUtils.lerp(v, pk.rot[k], portrait))
    const rawScale = THREE.MathUtils.lerp(dk.scale, pk.scale, portrait)
    const { pos, scale } = fitToView(rawPos, rot, rawScale, aspect)

    g.position.x = THREE.MathUtils.damp(g.position.x, pos[0], 4.5, delta)
    g.position.y = THREE.MathUtils.damp(g.position.y, pos[1], 4.5, delta)
    g.position.z = THREE.MathUtils.damp(g.position.z, pos[2], 4.5, delta)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rot[0], 4.5, delta)
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, rot[1], 4.5, delta)
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, rot[2], 4.5, delta)
    const s = THREE.MathUtils.damp(g.scale.x, scale, 4.5, delta)
    g.scale.setScalar(s)

    // Grab-and-flick: drag velocity spins the shoe, inertia decays,
    // then the pose eases back home.
    spin.current += spinState.velocity * delta
    spinState.velocity *= Math.exp(-2.2 * delta)
    spin.current = THREE.MathUtils.damp(spin.current, 0, 0.9, delta)

    // Scroll velocity adds a little extra kick to the rotation
    const velocityKick = scrollState.velocity * 0.3

    inner.current.rotation.y = THREE.MathUtils.damp(
      inner.current.rotation.y,
      pointerState.x * 0.12 + spin.current + velocityKick,
      3.5,
      delta,
    )
    inner.current.rotation.x = THREE.MathUtils.damp(
      inner.current.rotation.x, pointerState.y * 0.08, 3, delta)
  })

  return (
    <group ref={group}>
      <group ref={inner}>
        <Float speed={1.6} rotationIntensity={0.08} floatIntensity={0.25} floatingRange={[-0.03, 0.03]}>
          <primitive object={model} />
        </Float>
      </group>
    </group>
  )
}

function GroundShadow() {
  const texture = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    )
    grad.addColorStop(0, 'rgba(0,0,0,0.34)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.14)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh position={[0, -0.68, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.6, 1.7, 1]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function Rig() {
  useFrame((state, delta) => {
    // Gentle camera drift with the pointer for depth
    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x, pointerState.x * 0.15, 2.5, delta)
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y, 0.1 + pointerState.y * -0.1, 2.5, delta)
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

export default function Experience() {
  return (
    <Canvas
      className="webgl"
      dpr={[1, 2]}
      camera={{ position: [0, 0.1, 3.4], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <directionalLight position={[-5, 2, -3]} intensity={0.5} color="#ffd9c2" />
        <spotLight position={[0, 5, 2]} angle={0.5} penumbra={1} intensity={0.8} />
        <Shoe />
        {/* Drifting embers around the product. Kept behind the shoe (z < 0)
            so the tiny points never pop in front of the model. */}
        <Sparkles count={55} scale={[5, 3, 1]} position={[0, 0, -0.9]} size={2.2} speed={0.3} opacity={0.42} color="#ff5a00" />
        <Sparkles count={35} scale={[6, 3.5, 1]} position={[0, 0, -1.1]} size={1.4} speed={0.2} opacity={0.25} color="#bdbdbd" />
        {/* Soft radial ground shadow. A baked texture instead of drei's
            ContactShadows: the live depth re-render flickered whenever the
            shoe crossed the shadow plane. */}
        <GroundShadow />
        <Environment preset="city" />
        <Rig />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)
