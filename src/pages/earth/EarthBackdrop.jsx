import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, PresentationControls, useGLTF } from '@react-three/drei'
import './earth-backdrop.css'
// "Earth" (https://skfb.ly/6Uy6v) by AirStudios, CC BY 4.0 — optimized for the web
// (textures 2048 px WebP, meshopt). Credited in the Sources section of the page.
import earthUrl from './earth.glb?url'

const MODEL_RADIUS = 98 // radius of the globe in the model's own units
const SPIN_SPEED = 0.05 // radians per second
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Earth() {
  const { scene } = useGLTF(earthUrl)
  const spin = useRef()
  useFrame((_, dt) => {
    if (!reducedMotion && spin.current) spin.current.rotation.y += dt * SPIN_SPEED
  })
  return (
    // Axial tilt, then spin around the planet's own axis.
    <group rotation={[0.12, -1.9, 0.41]}>
      <group ref={spin}>
        <Center scale={1 / MODEL_RADIUS}>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  )
}

/**
 * Decorative, slowly turning 3D Earth behind the page header.
 * Drag the planet to turn it; it eases back up/down tilt when released.
 */
export default function EarthBackdrop() {
  return (
    <div aria-hidden="true" className="earth-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden">
      <div className="earth-globe absolute -right-[300px] -top-[160px] opacity-90 md:-right-[180px] md:-top-[200px]">
        <div className="earth-glow" />
        <Canvas
          camera={{ fov: 30, position: [0, 0, 4.18] }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          style={{ pointerEvents: 'auto', touchAction: 'pan-y' }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[-4, 2, 3]} intensity={2.4} />
          <Suspense fallback={null}>
            {/* Drag only starts on the planet itself, not on the empty canvas around it. */}
            <PresentationControls
              global={false}
              cursor
              speed={1.4}
              polar={[-1, 1]}
              azimuth={[-Infinity, Infinity]}
              damping={0.25}
            >
              <Earth />
            </PresentationControls>
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

useGLTF.preload(earthUrl)
