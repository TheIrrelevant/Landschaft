/*
 * ---metadata---
 * type: app-source
 * description: Three.js terrain preview scene for the Landschaft editor.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: keep default canvas empty until terrain is generated
 * ---end-metadata---
 */
import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { DoubleSide, PlaneGeometry, Texture, TextureLoader } from "three";
import { useEditorStore } from "../state/editorStore";

function TerrainPlane() {
  const { orthophotoPreviewUrl, terrain } = useEditorStore();
  const [texture, setTexture] = useState<Texture | null>(null);
  const sceneScale = Math.max(terrain.width, terrain.depth, 1) / 80;
  const width = terrain.width / sceneScale;
  const depth = terrain.depth / sceneScale;
  const elevationRange = Math.max(terrain.maxElevation - terrain.minElevation, 1);

  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(
      width,
      depth,
      terrain.gridSize - 1,
      terrain.gridSize - 1
    );
    const positions = plane.attributes.position;

    for (let index = 0; index < positions.count; index += 1) {
      const elevation = terrain.heightmap[index] ?? terrain.minElevation;
      const normalizedElevation =
        (elevation - terrain.minElevation) / elevationRange;

      positions.setZ(index, normalizedElevation * 8);
    }

    positions.needsUpdate = true;
    plane.computeVertexNormals();

    return plane;
  }, [depth, elevationRange, terrain, width]);

  useEffect(() => {
    if (!orthophotoPreviewUrl) {
      setTexture(null);
      return;
    }

    const loader = new TextureLoader();
    loader.load(orthophotoPreviewUrl, (loadedTexture) => {
      setTexture(loadedTexture);
    });

    return () => {
      setTexture((currentTexture) => {
        currentTexture?.dispose();
        return null;
      });
    };
  }, [orthophotoPreviewUrl]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color={texture ? "#ffffff" : "#6f8f69"}
        map={texture}
        metalness={0}
        roughness={0.92}
        side={DoubleSide}
      />
    </mesh>
  );
}

export function TerrainScene() {
  const terrainGenerated = useEditorStore((state) => state.terrainGenerated);

  return (
    <Canvas camera={{ position: [34, 34, 34], fov: 42 }} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[18, 28, 12]} intensity={1.2} castShadow />
      {terrainGenerated ? <TerrainPlane /> : null}
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
