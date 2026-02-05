import React, { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Box, Sphere, Cylinder, Torus } from '@react-three/drei';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useEditorStore, type SceneElement } from '@/lib/store';
import * as THREE from 'three';

const Material = ({ color, isSelected }: { color: string, isSelected: boolean }) => (
  <meshStandardMaterial 
    color={color} 
    emissive={isSelected ? '#444' : '#000'}
    roughness={0.3}
    metalness={0.2}
  />
);

const ElementRenderer = ({ id }: { id: string }) => {
  const element = useEditorStore(state => state.elements[id]);
  const selection = useEditorStore(state => state.selection);
  const isSelected = selection.includes(id);
  const meshRef = useRef<THREE.Mesh>(null!);

  // If element was deleted but still in render tree (shouldn't happen with correct state mgmt but safe guard)
  if (!element) return null;

  // If it has a parent that is NOT the root (undefined), don't render it directly
  // It will be rendered by the parent component (Group or CSG)
  // This is a simplification; a recursive render tree starting from root nodes is better.
  // But for this flat store structure, we can check parentId here.
  if (element.parentId) return null;

  return <RecursiveElement id={id} />;
};

// Recursive component to handle hierarchy
const RecursiveElement = ({ id }: { id: string }) => {
  const element = useEditorStore(state => state.elements[id]);
  const selection = useEditorStore(state => state.selection);
  const transformMode = useEditorStore(state => state.transformMode);
  const setSelection = useEditorStore(state => state.setSelection);
  const updateElement = useEditorStore(state => state.updateElement);
  const [isTransforming, setIsTransforming] = React.useState(false);
  const ghostRef = useRef<THREE.Group>(null!);
  
  const isSelected = selection.includes(id);

  const handleClick = (e: any) => {
    e.stopPropagation();
    // Multi-select with shift
    if (e.shiftKey) {
      setSelection([...selection, id]);
    } else {
      setSelection([id]);
    }
  };

  const handleTransformStart = () => {
    setIsTransforming(true);
  };

  const handleTransformChange = (e: any) => {
    if (!e?.target?.object || !ghostRef.current) return;
    const obj = e.target.object;
    ghostRef.current.position.copy(obj.position);
    ghostRef.current.rotation.copy(obj.rotation);
    ghostRef.current.scale.copy(obj.scale);
  };

  const handleTransformEnd = (e: any) => {
     setIsTransforming(false);
     if (!e?.target?.object) return;
     const obj = e.target.object;
     updateElement(id, {
       position: [obj.position.x, obj.position.y, obj.position.z],
       rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
       scale: [obj.scale.x, obj.scale.y, obj.scale.z],
     });
  };

  if (!element) return null;

  const commonProps = {
    position: element.position,
    rotation: element.rotation,
    scale: element.scale,
    onClick: handleClick,
    castShadow: true,
    receiveShadow: true,
  };

  // Find children
  const allElements = useEditorStore(state => state.elements);
  const childIds = Object.values(allElements)
    .filter(el => el.parentId === id)
    .map(el => el.id);

  const renderGeometry = (el: SceneElement) => {
    switch (el.type) {
      case 'box': return <boxGeometry />;
      case 'sphere': return <sphereGeometry />;
      case 'cylinder': return <cylinderGeometry />;
      case 'torus': return <torusGeometry />;
      default: return null;
    }
  };

  const GhostPreview = () => (
    <group ref={ghostRef} position={element.position} rotation={element.rotation} scale={element.scale}>
      <mesh>
        {element.type === 'subtraction' ? (
          <Geometry>
            {childIds.length === 2 && (() => {
              const baseEl = allElements[childIds[0]];
              const subEl = allElements[childIds[1]];
              return (
                <>
                  <Base position={baseEl.position} rotation={baseEl.rotation} scale={baseEl.scale}>
                    {renderGeometry(baseEl)}
                  </Base>
                  <Subtraction position={subEl.position} rotation={subEl.rotation} scale={subEl.scale}>
                    {renderGeometry(subEl)}
                  </Subtraction>
                </>
              );
            })()}
          </Geometry>
        ) : renderGeometry(element)}
        <meshStandardMaterial 
          color={element.color} 
          transparent 
          opacity={0.4} 
          depthWrite={false}
          emissive={element.color}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );

  if (element.type === 'subtraction') {
      // Expect exactly 2 children for subtraction for now
      if (childIds.length !== 2) return null;
      const [baseId, subId] = childIds;
      const baseEl = allElements[baseId];
      const subEl = allElements[subId];

      return (
        <group {...commonProps}>
          {isSelected && (
             <TransformControls 
               mode={transformMode} 
               onMouseDown={handleTransformStart}
               onChange={handleTransformChange}
               onMouseUp={handleTransformEnd} 
             />
          )}
          {isSelected && isTransforming && <GhostPreview />}
          <mesh visible={!isTransforming}>
             <Geometry>
                <Base 
                  position={baseEl.position} 
                  rotation={baseEl.rotation} 
                  scale={baseEl.scale}
                >
                  {renderGeometry(baseEl)}
                </Base>
                <Subtraction 
                  position={subEl.position} 
                  rotation={subEl.rotation} 
                  scale={subEl.scale}
                >
                  {renderGeometry(subEl)}
                </Subtraction>
             </Geometry>
             <Material color={baseEl.color} isSelected={isSelected} />
          </mesh>
        </group>
      );
  }
  
  if (element.type === 'group') {
    return (
      <group {...commonProps}>
        {isSelected && (
           <TransformControls 
             mode={transformMode} 
             onMouseDown={handleTransformStart}
             onChange={handleTransformChange}
             onMouseUp={handleTransformEnd} 
           />
        )}
        {isSelected && isTransforming && <GhostPreview />}
        <group visible={!isTransforming}>
          {childIds.map(childId => (
            <RecursiveElement key={childId} id={childId} />
          ))}
        </group>
      </group>
    );
  }

  // Primitives
  return (
    <>
      <mesh {...commonProps} visible={!isTransforming}>
        {renderGeometry(element)}
        <Material color={element.color} isSelected={isSelected} />
      </mesh>

      {isSelected && (
        <>
          <TransformControls 
              object={undefined} 
              mode={transformMode} 
              onMouseDown={handleTransformStart}
              onChange={handleTransformChange}
              onMouseUp={handleTransformEnd}
              position={element.position}
              rotation={element.rotation}
              scale={element.scale}
          />
          {isTransforming && <GhostPreview />}
        </>
      )}
    </>
  );
};

export const Scene = () => {
  const elements = useEditorStore(state => state.elements);
  const setSelection = useEditorStore(state => state.setSelection);
  
  // Get only root elements (no parent) to start the recursive render
  const rootIds = Object.values(elements)
    .filter(el => !el.parentId)
    .map(el => el.id);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow 
      />
      
      {/* Grid floor */}
      <gridHelper args={[20, 20, 0xcccccc, 0xeeeeee]} />
      
      {/* Click background to deselect */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        onClick={(e) => { e.stopPropagation(); setSelection([]); }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {rootIds.map(id => (
        <RecursiveElement key={id} id={id} />
      ))}
    </>
  );
};
