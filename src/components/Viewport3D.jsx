import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  getFlameRegime,
  getActiveRack,
  getSootIndex,
  getConvDiffRatio,
} from '../data/investigations'

/* ═══════════════════════════════════════════════════════════════════════════
   Utility – colour helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

function flameColor(gravity, o2) {
  // Base: orange-yellow at 1 g, blue at 0 g
  tmpA.set('#FF8C00')
  tmpB.set('#4488FF')
  const base = tmpA.clone().lerp(tmpB, 1 - Math.min(gravity, 1))
  if (o2 > 50) {
    base.lerp(new THREE.Color('#E0F0FF'), (o2 - 50) / 35)
  }
  return base
}

function riskColor(o2) {
  if (o2 >= 50) return '#EF4444' // red
  if (o2 >= 30) return '#F59E0B' // amber
  return '#22C55E'               // green
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE A — Combustion Chamber Scene
   ═══════════════════════════════════════════════════════════════════════════ */

function Flame({ params }) {
  const { gravity, airflow, o2 } = params
  const groupRef = useRef()
  const lightRef = useRef()

  // 5 layered spheres for the flame body
  const layers = useMemo(() => {
    return [0, 1, 2, 3, 4].map((i) => ({
      key: i,
      scale: 1 - i * 0.15,
      opacity: 0.6 - i * 0.08,
      yOffset: i * 0.06,
    }))
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Gravity → vertical stretch
    const gClamped = Math.min(Math.max(gravity, 0), 1)
    const targetScaleY = 1 + gClamped * 2 // 1 at 0g → 3 at 1g
    const targetScaleXZ = o2 > 50 ? 0.7 : (gClamped < 0.05 ? 1.2 : 1.0)

    // Airflow → tilt
    const targetRotZ = airflow > 0 ? -Math.min(airflow / 30, 1) * 0.6 : 0
    const targetScaleX = targetScaleXZ + (airflow > 0 ? airflow / 60 : 0)

    // Smooth interpolation
    const g = groupRef.current
    g.scale.x += (targetScaleX - g.scale.x) * 0.05
    g.scale.y += (targetScaleY - g.scale.y) * 0.05
    g.scale.z += (targetScaleXZ - g.scale.z) * 0.05
    g.rotation.z += (targetRotZ - g.rotation.z) * 0.05

    // Flickering
    const flicker = 1 + Math.sin(t * 12) * 0.03 + Math.sin(t * 7.3) * 0.02
    g.scale.x *= flicker
    g.scale.y *= flicker
    g.scale.z *= flicker

    // Update point light colour
    if (lightRef.current) {
      lightRef.current.color.copy(flameColor(gravity, o2))
    }
  })

  const color = flameColor(gravity, o2)
  const hexColor = '#' + color.getHexString()

  // When o2 > 50, invert structure: inner bright, outer dim
  const invertIntensity = o2 > 50

  return (
    <group ref={groupRef} position={[0, 0.45, 0]}>
      {layers.map(({ key, scale, opacity, yOffset }) => {
        const effectiveOpacity = invertIntensity
          ? 0.3 + key * 0.12 // inner layers dimmer → outer brighter → inverted
          : opacity
        const emissiveIntensity = invertIntensity
          ? 1.5 + key * 0.5
          : 2.5 - key * 0.4
        return (
          <mesh key={key} position={[0, yOffset, 0]}>
            <sphereGeometry args={[0.2 * scale, 16, 16]} />
            <meshStandardMaterial
              color={hexColor}
              emissive={hexColor}
              emissiveIntensity={emissiveIntensity}
              transparent
              opacity={effectiveOpacity}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      <pointLight ref={lightRef} color={hexColor} intensity={3} distance={4} />
    </group>
  )
}

function SootTrail({ params }) {
  const ref = useRef()
  const { airflow, o2 } = params
  const visible = airflow > 0 && o2 <= 50

  useFrame((state) => {
    if (!ref.current || !visible) return
    const t = state.clock.elapsedTime
    ref.current.scale.x = 1 + Math.sin(t * 4) * 0.15
    ref.current.position.x = 0.35 + airflow / 60
  })

  if (!visible) return null
  return (
    <mesh ref={ref} position={[0.35, 0.6, 0]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshStandardMaterial
        color="#FF6600"
        emissive="#FF6600"
        emissiveIntensity={0.3}
        transparent
        opacity={0.25}
        depthWrite={false}
      />
    </mesh>
  )
}

function CombustionChamber({ params }) {
  return (
    <group>
      {/* Wireframe cylindrical chamber */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 2.2, 32, 1, true]} />
        <meshStandardMaterial
          color="#38BDF8"
          wireframe
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshStandardMaterial
          color="#38BDF8"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Burner nozzle */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.16, 16]} />
        <meshStandardMaterial color="#2A2A3A" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Flame */}
      <Flame params={params} />

      {/* Soot trail */}
      <SootTrail params={params} />

      {/* Floor grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[6, 6]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1E3A5F"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#38BDF8"
        fadeDistance={8}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 5, 2]} intensity={0.6} />
    </group>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE B — Lunar Habitat Module Scene
   ═══════════════════════════════════════════════════════════════════════════ */

function AirflowArrow({ start, direction, length }) {
  const ref = useRef()

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    // Gentle pulsing
    ref.current.scale.x = length * (1 + Math.sin(t * 3) * 0.05)
  })

  return (
    <group position={start} ref={ref}>
      {/* Shaft */}
      <mesh rotation={[0, 0, direction === 'right' ? -Math.PI / 2 : Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, length, 6]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#38BDF8"
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Arrowhead */}
      <mesh
        position={[direction === 'right' ? length / 2 : -length / 2, 0, 0]}
        rotation={[0, 0, direction === 'right' ? -Math.PI / 2 : Math.PI / 2]}
      >
        <coneGeometry args={[0.04, 0.1, 6]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#38BDF8"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  )
}

function SuppressionNozzle({ position }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.04, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

function LunarHabitat({ params }) {
  const { o2, airflow } = params
  const zoneColor = riskColor(o2)
  const arrowLen = Math.max(0.2, airflow / 15)

  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* Habitat cylinder — horizontal orientation (rotated 90° on Z) */}
      <mesh>
        <cylinderGeometry args={[1.2, 1.2, 4, 32, 1, true]} />
        <meshStandardMaterial
          color="#38BDF8"
          wireframe
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* End caps */}
      <mesh position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color="#38BDF8" wireframe transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color="#38BDF8" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Internal partition walls */}
      {[-0.8, 0.8].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2, 0.02, 2]} />
          <meshStandardMaterial
            color="#64748B"
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>
      ))}

      {/* Color-coded risk zone floors */}
      {[-1.4, 0, 1.4].map((y, i) => (
        <mesh key={y} position={[0, y, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.8, 1.2]} />
          <meshStandardMaterial
            color={zoneColor}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Suppression nozzles on ceiling */}
      {[-1.2, 0, 1.2].map((y) => (
        <SuppressionNozzle key={y} position={[0, y, 1.0]} />
      ))}

      {/* Airflow arrows — inside habitat (along the length) */}
      {[-0.4, 0.4].map((z) =>
        [-1, 0, 1].map((y) => (
          <AirflowArrow
            key={`${y}-${z}`}
            start={[0, y * 0.9, z]}
            direction="right"
            length={arrowLen}
          />
        ))
      )}

      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[2, 3, 4]} intensity={0.7} />
    </group>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HUD Overlay
   ═══════════════════════════════════════════════════════════════════════════ */

const hudStyle = {
  position: 'absolute',
  padding: '6px 10px',
  background: 'rgba(11, 17, 32, 0.75)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(56, 189, 248, 0.2)',
  borderRadius: 6,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: 11,
  color: '#94A3B8',
  pointerEvents: 'none',
  lineHeight: 1.4,
  zIndex: 10,
}

function HUD({ params }) {
  const regime = getFlameRegime(params)
  const rack = getActiveRack(params)
  const soot = getSootIndex(params)
  const ratio = getConvDiffRatio(params)

  return (
    <>
      <div style={{ ...hudStyle, top: 8, left: 8 }}>
        <div style={{ color: '#38BDF8', fontSize: 9, marginBottom: 2 }}>FLAME REGIME</div>
        {regime}
      </div>
      <div style={{ ...hudStyle, top: 8, right: 8, textAlign: 'right' }}>
        <div style={{ color: '#38BDF8', fontSize: 9, marginBottom: 2 }}>ACTIVE RACK</div>
        {rack}
      </div>
      <div style={{ ...hudStyle, bottom: 8, left: 8 }}>
        <div style={{ color: '#38BDF8', fontSize: 9, marginBottom: 2 }}>SOOT INDEX</div>
        {soot.toFixed(1)}
      </div>
      <div style={{ ...hudStyle, bottom: 8, right: 8, textAlign: 'right' }}>
        <div style={{ color: '#38BDF8', fontSize: 9, marginBottom: 2 }}>CONV / DIFF</div>
        {ratio.toFixed(2)}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Viewport3D Component
   ═══════════════════════════════════════════════════════════════════════════ */

const btnBase = {
  padding: '8px 18px',
  fontSize: 13,
  fontFamily: '"Inter", system-ui, sans-serif',
  fontWeight: 600,
  border: '1px solid rgba(56, 189, 248, 0.3)',
  cursor: 'pointer',
  transition: 'all 0.2s',
  letterSpacing: '0.02em',
}

const btnActive = {
  ...btnBase,
  background: 'rgba(56, 189, 248, 0.15)',
  color: '#38BDF8',
  borderColor: '#38BDF8',
}

const btnInactive = {
  ...btnBase,
  background: 'rgba(30, 41, 59, 0.5)',
  color: '#64748B',
  borderColor: 'rgba(100, 116, 139, 0.3)',
}

export default function Viewport3D({ params, viewMode, setViewMode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0B1120',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Mode toggle bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode('chamber')}
          style={{
            ...(viewMode === 'chamber' ? btnActive : btnInactive),
            borderRadius: '8px 0 0 0',
            flex: 1,
          }}
        >
          Combustion Chamber (CIR / MSG)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('habitat')}
          style={{
            ...(viewMode === 'habitat' ? btnActive : btnInactive),
            borderRadius: '0 8px 0 0',
            flex: 1,
          }}
        >
          Lunar Habitat Module
        </button>
      </div>

      {/* Canvas + HUD wrapper */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <HUD params={params} />

        <Canvas
          camera={{ position: [3, 2.5, 3], fov: 50 }}
          style={{ background: '#0B1120' }}
          gl={{ antialias: true, alpha: false }}
        >
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={1.5}
            maxDistance={12}
          />
          {viewMode === 'chamber' ? (
            <CombustionChamber params={params} />
          ) : (
            <LunarHabitat params={params} />
          )}
        </Canvas>
      </div>
    </div>
  )
}
