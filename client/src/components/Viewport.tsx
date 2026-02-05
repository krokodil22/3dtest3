import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Scene } from './Scene';

export function Viewport() {
  return (
    <div className="w-full h-full relative bg-[#111] canvas-container">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
        <Scene />
        <OrbitControls makeDefault />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground pointer-events-none">
        <p>Left Click: Select</p>
        <p>Shift + Click: Multi-select</p>
        <p>Right Click: Rotate</p>
        <p>Scroll: Zoom</p>
      </div>
    </div>
  );
}
