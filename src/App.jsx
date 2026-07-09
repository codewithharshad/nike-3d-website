import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { useProgress } from '@react-three/drei'
import Experience from './Experience.jsx'
import { scrollState, pointerState, spinState } from './scroll.js'
import './App.css'

/* Background color stops across scroll progress — drifts warm/cool,
   plunges to near-black for the traction act, returns for the finale. */
const BG_STOPS = [
  [0.0, [244, 244, 242]],
  [0.3, [237, 239, 243]],
  [0.5, [244, 238, 230]],
  [0.6, [17, 17, 19]],
  [0.8, [17, 17, 19]],
  [0.9, [244, 244, 242]],
  [1.0, [244, 244, 242]],
]

function bgAt(p) {
  for (let i = 0; i < BG_STOPS.length - 1; i++) {
    const [p0, c0] = BG_STOPS[i]
    const [p1, c1] = BG_STOPS[i + 1]
    if (p >= p0 && p <= p1) {
      const f = (p - p0) / (p1 - p0)
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f))
    }
  }
  return BG_STOPS[BG_STOPS.length - 1][1]
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible')
        })
      },
      { threshold: 0.25 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/* Loader tied to real asset loading (GLB + environment map) */
function Loader() {
  const { progress } = useProgress()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => setDone(true), 500)
      return () => clearTimeout(t)
    }
  }, [progress])

  return (
    <div className={`loader ${done ? 'loader--done' : ''}`}>
      <span className="loader__mark">AEROGLIDE</span>
      <span className="loader__bar">
        <span className="loader__bar-fill" style={{ transform: `scaleX(${progress / 100})` }} />
      </span>
      <span className="loader__pct">{Math.round(progress)}%</span>
    </div>
  )
}

function Marquee({ text }) {
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee__track">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i}>{text}&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const progressRef = useRef(null)
  const cursorRef = useRef(null)
  const dotRef = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true })

    lenis.on('scroll', ({ progress, velocity }) => {
      scrollState.progress = progress
      scrollState.velocity = Math.max(-1, Math.min(1, velocity / 60))
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`
      }
      const [r, g, b] = bgAt(progress)
      document.body.style.backgroundColor = `rgb(${r},${g},${b})`
      document.body.classList.toggle('theme-dark', progress > 0.56 && progress < 0.85)
    })

    // rAF loop: lenis + velocity-reactive skew + custom cursor
    const skewEls = document.querySelectorAll('[data-skew]')
    let skew = 0
    const cursor = { x: innerWidth / 2, y: innerHeight / 2 }
    const dot = { x: innerWidth / 2, y: innerHeight / 2 }
    const target = { x: innerWidth / 2, y: innerHeight / 2 }

    let raf
    const loop = (time) => {
      lenis.raf(time)

      skew += (scrollState.velocity * 4 - skew) * 0.1
      skewEls.forEach((el) => {
        el.style.transform = `skewY(${skew.toFixed(3)}deg)`
      })

      cursor.x += (target.x - cursor.x) * 0.16
      cursor.y += (target.y - cursor.y) * 0.16
      dot.x += (target.x - dot.x) * 0.4
      dot.y += (target.y - dot.y) * 0.4
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`
        dotRef.current.style.transform = `translate(${dot.x}px, ${dot.y}px)`
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // Pointer tracking + hover states for the custom cursor
    const onPointerMove = (e) => {
      pointerState.x = (e.clientX / innerWidth) * 2 - 1
      pointerState.y = (e.clientY / innerHeight) * 2 - 1
      target.x = e.clientX
      target.y = e.clientY
    }

    const onPointerOver = (e) => {
      const c = cursorRef.current
      if (!c) return
      const interactive = e.target.closest('a, button')
      const canvas = e.target.tagName === 'CANVAS'
      c.classList.toggle('cursor--link', !!interactive)
      c.classList.toggle('cursor--drag', canvas && !interactive)
    }

    // Grab-and-flick spin on the shoe
    let dragging = false
    let lastX = 0
    const onDown = (e) => {
      if (e.target.closest('a, button, figure')) return
      dragging = true
      lastX = e.clientX
      document.body.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      spinState.velocity += dx * 0.02
    }
    const onUp = () => {
      dragging = false
      document.body.classList.remove('is-dragging')
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerover', onPointerOver)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerover', onPointerOver)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('theme-dark', 'is-dragging')
      document.body.style.backgroundColor = ''
    }
  }, [])

  useReveal()

  return (
    <>
      <Loader />

      {/* Fixed 3D layer */}
      <div className="canvas-wrap">
        <Experience />
      </div>

      {/* Film grain */}
      <div className="grain" aria-hidden />

      {/* Custom cursor */}
      <div className="cursor" ref={cursorRef}>
        <span className="cursor__label">drag</span>
      </div>
      <div className="cursor-dot" ref={dotRef} />

      {/* Scroll progress */}
      <div className="progress" aria-hidden>
        <div className="progress__fill" ref={progressRef} />
      </div>

      {/* Nav */}
      <header className="nav">
        <a className="nav__logo" href="#top" aria-label="Nike">
          <svg viewBox="0 0 69 32" width="52" fill="currentColor" aria-hidden>
            <path d="M68.56 4L18.4 25.36Q12.16 28 7.92 28q-4.8 0-6.96-3.36-1.36-2.16-.8-5.48t2.96-7.08q2-3.04 6.56-8-1.6 2.56-2.24 5.28-1.2 5.12 2.16 7.52Q11.2 18 13.44 18q1.8 0 4.32-.88z" />
          </svg>
        </a>
        <nav className="nav__links">
          <a href="#airflow">Airflow</a>
          <a href="#cushion">Cushion</a>
          <a href="#traction">Traction</a>
          <a href="#gallery">Gallery</a>
        </nav>
        <a className="nav__cta" href="#buy">Buy now</a>
      </header>

      {/* Content sections drive the scroll; the shoe animates behind/above them */}
      <main id="top">
        {/* 0 — HERO */}
        <section className="section hero">
          <p className="hero__eyebrow" data-reveal>Nike Running — New for 2026</p>
          <h1 className="hero__title" aria-label="AeroGlide" data-skew>
            <span data-reveal style={{ '--d': '0.05s' }}>AERO</span>
            <span data-reveal style={{ '--d': '0.15s' }}>GLIDE</span>
          </h1>
          <p className="hero__sub" data-reveal style={{ '--d': '0.3s' }}>
            Fly light. Land soft. A racer built from air, foam and grip —
            scroll to take it apart.
          </p>
          <div className="hero__scroll" data-reveal style={{ '--d': '0.45s' }}>
            <span className="hero__scroll-dot" />
            Scroll to explore
          </div>
        </section>

        <Marquee text="FLY LIGHT — LAND SOFT" />

        {/* 1 — AIRFLOW */}
        <section className="section feature feature--left" id="airflow">
          <div className="feature__body" data-reveal>
            <span className="feature__index">01</span>
            <h2 data-skew>Engineered<br />airflow</h2>
            <p>
              Hundreds of laser-perforated vents map to the sweat zones of
              your foot. Air moves through the upper on every stride, so the
              inside of the shoe stays as cool as the outside.
            </p>
            <ul className="feature__stats">
              <li><strong>412</strong><span>micro vents</span></li>
              <li><strong>38%</strong><span>more airflow</span></li>
            </ul>
          </div>
        </section>

        {/* 2 — CUSHION */}
        <section className="section feature feature--right" id="cushion">
          <div className="feature__body" data-reveal>
            <span className="feature__index">02</span>
            <h2 data-skew>Cloud-form<br />midsole</h2>
            <p>
              A sculpted single-piece midsole compresses where you land and
              rebounds where you push off. Soft on impact, fast on toe-off —
              no plates, no gimmicks, just geometry.
            </p>
            <ul className="feature__stats">
              <li><strong>71%</strong><span>energy return</span></li>
              <li><strong>212g</strong><span>featherweight</span></li>
            </ul>
          </div>
        </section>

        {/* 3 — TRACTION (dark act) */}
        <section className="section feature feature--left" id="traction">
          <div className="feature__body" data-reveal>
            <span className="feature__index">03</span>
            <h2 data-skew>Grip that<br />bites back</h2>
            <p>
              Hi-vis orange traction pods are placed exactly where pressure
              peaks — heel strike, midfoot roll, forefoot launch. Wet roads,
              loose gravel, track rubber: it all holds.
            </p>
            <ul className="feature__stats">
              <li><strong>14</strong><span>traction pods</span></li>
              <li><strong>2.4×</strong><span>wet grip</span></li>
            </ul>
          </div>
        </section>

        <Marquee text="AEROGLIDE — GRIP THAT BITES" />

        {/* 4 — FINALE / GALLERY / BUY */}
        <section className="section finale" id="gallery">
          <h2 className="finale__title" data-reveal>Every angle,<br />zero compromise.</h2>
          <div className="gallery">
            <figure data-reveal style={{ '--d': '0.05s' }}>
              <img src="/images/side.jpeg" alt="AeroGlide side profile" loading="lazy" />
              <figcaption>Profile</figcaption>
            </figure>
            <figure data-reveal style={{ '--d': '0.15s' }}>
              <img src="/images/front.jpeg" alt="AeroGlide front view" loading="lazy" />
              <figcaption>Front</figcaption>
            </figure>
            <figure data-reveal style={{ '--d': '0.25s' }}>
              <img src="/images/back.jpeg" alt="AeroGlide heel pair" loading="lazy" />
              <figcaption>Heel</figcaption>
            </figure>
            <figure data-reveal style={{ '--d': '0.35s' }}>
              <img src="/images/heel.jpeg" alt="AeroGlide three-quarter back" loading="lazy" />
              <figcaption>Quarter</figcaption>
            </figure>
          </div>

          <div className="buy" id="buy" data-reveal>
            <div className="buy__info">
              <h3>Nike AeroGlide</h3>
              <p>Summit White / Total Orange</p>
            </div>
            <div className="buy__price">$160</div>
            <button className="buy__btn" type="button">Add to bag</button>
          </div>

          <footer className="footer">
            <span>© 2026 Nike, Inc. — Concept experience</span>
            <span>Built with React Three Fiber</span>
          </footer>
        </section>
      </main>
    </>
  )
}
