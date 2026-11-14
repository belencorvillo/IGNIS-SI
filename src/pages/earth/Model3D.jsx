import { Suspense, useEffect, useMemo, useRef } from 'react'
import { AnimationMixer, Box3, Sphere } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Center, useAnimations, useGLTF } from '@react-three/drei'

const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Model({ url, rotation, spinAxis, spinSpeed, animation, zoom, offsetY }) {
  const { scene, animations } = useGLTF(url)
  const { viewport } = useThree()
  // SkeletonUtils.clone keeps rigged (skinned) models bound to their own copied skeleton.
  // Models carry their own node transforms, so measure their real size once loaded.
  const { model, radius } = useMemo(() => {
    const model = cloneSkinned(scene)
    // Measure the pose that will be shown: the clip's first frame if the model is animated.
    const clip = animation && animations.find((a) => a.name === animation)
    if (clip) new AnimationMixer(model).clipAction(clip).play().getMixer().update(0)
    // Skinned meshes are measured through their bones, so their world matrices must be current.
    model.updateMatrixWorld(true)
    const sphere = new Box3().setFromObject(model).getBoundingSphere(new Sphere())
    return { model, radius: sphere.radius || 1 }
  }, [scene, animations, animation])
  const rig = useRef()
  const { actions } = useAnimations(animations, rig)
  useEffect(() => {
    const action = animation && actions[animation]
    if (!action) return
    // With reduced motion, hold the clip's first pose instead of animating it.
    action.reset().setEffectiveTimeScale(reducedMotion ? 0 : 1).play()
    return () => action.stop()
  }, [actions, animation])
  const spin = useRef()
  const float = useRef()
  useFrame(({ clock }, dt) => {
    if (reducedMotion) return
    if (spin.current) spin.current.rotation[spinAxis] += dt * spinSpeed
    if (float.current) float.current.position.y = (offsetY + Math.sin(clock.elapsedTime * 0.8) * 0.02) * viewport.height
  })
  // Sit in the right part of the box (the left side fades out) and fill ~70% of its height.
  const size = Math.min(viewport.height * 0.36, viewport.width * 0.22) * zoom
  return (
    <group ref={float} position={[viewport.width * 0.2, offsetY * viewport.height, 0]}>
      <group rotation={rotation} scale={size}>
        <group ref={spin}>
          <Center scale={1 / radius}>
            <group ref={rig}>
              <primitive object={model} />
            </group>
          </Center>
        </group>
      </group>
    </group>
  )
}

/**
 * A slowly turning 3D model used as a line illustration. Fills its parent box.
 * `rotation` orients the model towards the viewer; `spinAxis` is the axis it turns around.
 * `animation` plays one of the model's own clips by name, if it has any.
 * `zoom` makes the model bigger (> 1) or smaller (< 1) than the default fit.
 * `offsetY` moves it up (> 0) or down (< 0), as a fraction of the box height.
 */
export default function Model3D({
  url,
  rotation = [0, 0, 0],
  spinAxis = 'y',
  spinSpeed = 0.25,
  animation,
  zoom = 1,
  offsetY = 0,
}) {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 6] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={['#dfe8ff', '#1a1c22', 1]} />
      <directionalLight position={[-3, 3, 4]} intensity={2.4} />
      <directionalLight position={[4, -2, 2]} intensity={0.7} color="#7aa3f5" />
      <Suspense fallback={null}>
        <Model url={url} rotation={rotation} spinAxis={spinAxis} spinSpeed={spinSpeed} animation={animation} zoom={zoom} offsetY={offsetY} />
      </Suspense>
    </Canvas>
  )
}
