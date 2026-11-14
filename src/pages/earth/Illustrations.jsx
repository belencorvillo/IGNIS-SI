// ── IGNIS · On Earth illustrations ─────────────────────────────────────────
// One decorative 3D model per research line (keyed by the block `id` in spinoffs.js).
// Purely visual.

import { useGLTF } from '@react-three/drei'
import Model3D from './Model3D'
// 3D models (CC BY 4.0, optimized for the web) — credited in the Sources section of the page.
import smokeDetectorUrl from './smoke-detector.glb?url' // "Simple smoke detector" by Sousinho
import valveUrl from './valve.glb?url' // "Valve II" by Víctor Hernández
import gasMaskUrl from './gas-mask.glb?url' // "Gas Mask" by DinoMac
import extinguisherUrl from './fire-extinguisher.glb?url' // "Fire Extinguisher" by Loïc
import cameraUrl from './security-camera.glb?url' // "Security Camera" by Bryan
import gaugeUrl from './pressure-gauge.glb?url' // "Pressure gauge" by takeboncog
import capeUrl from './cape.glb?url' // "1856 Cape (Kukushkina)" by Aleksei Moskvin
import droneUrl from './drone.glb?url' // "animated drone with camera (FREE)" by ulunkwulunk
import robotUrl from './robot.glb?url' // "cute robot" by victory_mirosya

useGLTF.preload(smokeDetectorUrl)
useGLTF.preload(valveUrl)
useGLTF.preload(gasMaskUrl)
useGLTF.preload(extinguisherUrl)
useGLTF.preload(cameraUrl)
useGLTF.preload(gaugeUrl)
useGLTF.preload(capeUrl)
useGLTF.preload(droneUrl)
useGLTF.preload(robotUrl)

/* 01 · Smart smoke detector — 3D model, front facing the viewer as if seen from below. */
const SmokeDetector3D = () => <Model3D url={smokeDetectorUrl} rotation={[Math.PI + 0.6, 0, 0]} spinAxis="z" />

/* 02 · Home-oxygen fire guard — 3D shut-off valve, turning around its stem. */
const Valve3D = () => <Model3D url={valveUrl} rotation={[0.35, 0, 0]} spinAxis="y" />

/* 03 · Firefighter risk wearable — 3D breathing mask, turning slowly. */
const GasMask3D = () => <Model3D url={gasMaskUrl} rotation={[0.1, 0, 0]} spinAxis="y" spinSpeed={0.3} />

/* 04 · Tuned water-mist extinguisher — 3D extinguisher, turning slowly. */
const Extinguisher3D = () => <Model3D url={extinguisherUrl} rotation={[0.15, 0, 0]} spinAxis="y" />

/* 05 · Cool-flame sensor — 3D sensor camera, turning slowly. */
const Camera3D = () => <Model3D url={cameraUrl} rotation={[0.25, 0, 0]} spinAxis="y" />

/* 06 · Soot exposure estimator — 3D gauge, turning slowly. */
const Gauge3D = () => <Model3D url={gaugeUrl} spinAxis="y" />

/* 07 · Protective textile data — 3D fabric cape, turning slowly. */
const Cape3D = () => <Model3D url={capeUrl} rotation={[0.1, 0, 0]} spinAxis="y" />

/* 08 · Drone fire-growth estimator and VR trainer — 3D drone hovering, tilted to show its top. */
const Drone3D = () => <Model3D url={droneUrl} rotation={[0.45, 0, 0]} spinAxis="y" animation="hover" zoom={1.3} offsetY={-0.12} />

/* 09 · Material and fire-behavior assistant — 3D robot helper, turning slowly. */
const Robot3D = () => <Model3D url={robotUrl} rotation={[0.1, 0, 0]} spinAxis="y" />

const ILLUSTRATIONS = {
  smoke: SmokeDetector3D,
  oxygen: Valve3D,
  wearable: GasMask3D,
  mist: Extinguisher3D,
  coolflame: Camera3D,
  soot: Gauge3D,
  textiles: Cape3D,
  models: Drone3D,
  assistant: Robot3D,
}

/** Illustration for a research line, fading in from the left. Size it with `className`. */
export default function Illustration({ id, className = 'aspect-[4/3]' }) {
  const Art = ILLUSTRATIONS[id]
  if (!Art) return null
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 65%)',
        maskImage: 'linear-gradient(to right, transparent 0%, #000 65%)',
      }}
    >
      <Art />
    </div>
  )
}
