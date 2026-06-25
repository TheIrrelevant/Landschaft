/*
 * type: app-source
 * description: Three.js terrain preview scene for the Landschaft editor.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added first terrain scene
 */
import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

function TerrainPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80, 96, 96]} />
      <meshStandardMaterial color="#6f8f69" roughness={0.92} metalness={0} />
    </mesh>
  );
}

export function TerrainScene() {
  return (
    <Canvas camera={{ position: [34, 34, 34], fov: 42 }} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[18, 28, 12]} intensity={1.2} castShadow />
      <TerrainPlane />
      <Grid
        args={[80, 80]}
        cellColor="#d6dfd0"
        cellSize={2}
        fadeDistance={90}
        fadeStrength={1}
        sectionColor="#ffffff"
        sectionSize={10}
      />
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}
