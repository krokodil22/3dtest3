import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import { Scene } from './Scene';

export function Viewport() {
  const selectionLockRef = useRef(false);

  const unlockSelection = () => {
    requestAnimationFrame(() => {
      selectionLockRef.current = false;
    });
  };

  return (
    <div className="w-full h-full relative bg-[#111] canvas-container">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
        <Scene selectionLockRef={selectionLockRef} />
        <OrbitControls
          makeDefault
          onStart={() => {
            selectionLockRef.current = true;
          }}
          onEnd={unlockSelection}
        />
      </Canvas>
      
    </div>
  );
}
