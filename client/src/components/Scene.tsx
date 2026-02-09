import React, { useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useEditorStore, type SceneElement } from '@/lib/store';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

extend({ RoundedBoxGeometry });

const Material = ({ color, isSelected, opacity = 1 }: { color: string, isSelected: boolean, opacity?: number }) => (
  <meshStandardMaterial 
    color={color} 
    emissive={isSelected ? '#444' : '#000'}
    roughness={0.3}
    metalness={0.2}
    transparent={opacity < 1}
    opacity={opacity}
    depthWrite={opacity >= 1}
  />
);

const createHeartShape = () => {
  const shape = new THREE.Shape();
  const x = 0;
  const y = 0;
  shape.moveTo(x + 0.25, y + 0.25);
  shape.bezierCurveTo(x + 0.25, y + 0.25, x, y, x - 0.5, y);
  shape.bezierCurveTo(x - 1.2, y, x - 1.2, y + 0.7, x - 1.2, y + 0.7);
  shape.bezierCurveTo(x - 1.2, y + 1.1, x - 0.8, y + 1.5, x - 0.25, y + 1.75);
  shape.bezierCurveTo(x + 0.25, y + 1.95, x + 0.6, y + 1.7, x + 0.8, y + 1.4);
  shape.bezierCurveTo(x + 1.0, y + 1.5, x + 1.4, y + 1.1, x + 1.4, y + 0.7);
  shape.bezierCurveTo(x + 1.4, y + 0.7, x + 1.4, y, x + 0.75, y);
  shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
  return shape;
};

const createStarShape = (points = 5, outerRadius = 1, innerRadius = 0.5) => {
  const shape = new THREE.Shape();
  const step = Math.PI / points;

  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  shape.closePath();
  return shape;
};

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
const RecursiveElement = ({ id, inheritedOpacity = 1 }: { id: string; inheritedOpacity?: number }) => {
  const element = useEditorStore(state => state.elements[id]);
  const selection = useEditorStore(state => state.selection);
  const transformMode = useEditorStore(state => state.transformMode);
  const setSelection = useEditorStore(state => state.setSelection);
  const updateElement = useEditorStore(state => state.updateElement);
  const allElements = useEditorStore(state => state.elements);
  const [isTransforming, setIsTransforming] = React.useState(false);
  const ghostRef = useRef<THREE.Group>(null!);
  const ghostOpacity = 0.4;
  const effectiveOpacity = inheritedOpacity;
  
  const isSelected = selection.includes(id);
  const meshObject = React.useMemo(() => {
    if (!element || element.type !== 'mesh' || !element.objData) return null;
    const loader = new OBJLoader();
    const obj = loader.parse(element.objData);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: element.color,
          roughness: 0.3,
          metalness: 0.2,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return obj;
  }, [element?.type, element?.objData, element?.color]);

  const transparentMeshObject = React.useMemo(() => {
    if (!meshObject || !element || effectiveOpacity >= 1) return null;
    const clone = meshObject.clone(true);
    const color = new THREE.Color(element.color);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.3,
          metalness: 0.2,
          transparent: true,
          opacity: effectiveOpacity,
          depthWrite: false,
          emissive: color,
          emissiveIntensity: 0.2,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [meshObject, element, effectiveOpacity]);

  const extrudeSettings = React.useMemo(
    () => ({
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
      steps: 1,
    }),
    []
  );
  const heartGeometry = React.useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(createHeartShape(), extrudeSettings);
    geometry.center();
    geometry.scale(0.8, 0.8, 1);
    return geometry;
  }, [extrudeSettings]);
  const starGeometry = React.useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(createStarShape(), extrudeSettings);
    geometry.center();
    geometry.scale(0.9, 0.9, 1);
    return geometry;
  }, [extrudeSettings]);

  const buildBoundingObject = React.useCallback((el: SceneElement): THREE.Object3D | null => {
    switch (el.type) {
      case 'group': {
        const group = new THREE.Group();
        Object.values(allElements)
          .filter(child => child.parentId === el.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .forEach((child) => {
            const childObj = buildBoundingObject(child);
            if (!childObj) return;
            childObj.position.set(child.position[0], child.position[1], child.position[2]);
            childObj.rotation.set(child.rotation[0], child.rotation[1], child.rotation[2]);
            childObj.scale.set(child.scale[0], child.scale[1], child.scale[2]);
            group.add(childObj);
          });
        return group;
      }
      case 'subtraction': {
        const children = Object.values(allElements)
          .filter(child => child.parentId === el.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const baseEl = children[0];
        if (!baseEl) return null;
        const baseObj = buildBoundingObject(baseEl);
        if (!baseObj) return null;
        baseObj.position.set(baseEl.position[0], baseEl.position[1], baseEl.position[2]);
        baseObj.rotation.set(baseEl.rotation[0], baseEl.rotation[1], baseEl.rotation[2]);
        baseObj.scale.set(baseEl.scale[0], baseEl.scale[1], baseEl.scale[2]);
        return baseObj;
      }
      case 'mesh': {
        const obj = el.id === element?.id ? meshObject?.clone(true) : null;
        if (obj) return obj;
        if (!el.objData) return null;
        const loader = new OBJLoader();
        return loader.parse(el.objData);
      }
      case 'box':
      case 'sphere':
      case 'cylinder':
      case 'torus':
      case 'cone':
      case 'pyramid':
      case 'heart':
      case 'star': {
        const geometry = (() => {
          switch (el.type) {
            case 'box': {
              const radius = Math.max(0, Math.min(el.cornerRadius ?? 0, 0.5));
              return radius > 0 ? new RoundedBoxGeometry(1, 1, 1, 2, radius) : new THREE.BoxGeometry(1, 1, 1);
            }
            case 'sphere':
              return new THREE.SphereGeometry(1, 32, 16);
            case 'cylinder':
              return new THREE.CylinderGeometry(1, 1, 1, 32);
            case 'torus': {
              const tube = Math.max(0.05, Math.min(el.torusThickness ?? 0.3, 0.95));
              return new THREE.TorusGeometry(1, tube, 16, 32);
            }
            case 'cone':
              return new THREE.ConeGeometry(1, 1.4, 32);
            case 'pyramid':
              return new THREE.ConeGeometry(1, 1.4, 4);
            case 'heart':
              return heartGeometry.clone();
            case 'star':
              return starGeometry.clone();
            default:
              return null;
          }
        })();
        if (!geometry) return null;
        return new THREE.Mesh(geometry);
      }
      default:
        return null;
    }
  }, [allElements, element?.id, heartGeometry, meshObject, starGeometry]);

  const localCenter = React.useMemo(() => {
    if (!element) return new THREE.Vector3();
    const object = buildBoundingObject(element);
    if (!object) return new THREE.Vector3();
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return new THREE.Vector3();
    return box.getCenter(new THREE.Vector3());
  }, [buildBoundingObject, element]);

  const getGizmoOffset = React.useCallback((rotation: THREE.Euler, scale: THREE.Vector3) => {
    return localCenter.clone().multiply(scale).applyEuler(rotation);
  }, [localCenter]);

  const gizmoPosition = React.useMemo(() => {
    if (!element) return new THREE.Vector3();
    const rotation = new THREE.Euler(element.rotation[0], element.rotation[1], element.rotation[2]);
    const scale = new THREE.Vector3(element.scale[0], element.scale[1], element.scale[2]);
    const offset = getGizmoOffset(rotation, scale);
    return new THREE.Vector3(element.position[0], element.position[1], element.position[2]).add(offset);
  }, [element, getGizmoOffset]);
  const ghostMeshObject = React.useMemo(() => {
    if (!meshObject || !element) return null;
    const clone = meshObject.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: element.color,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          emissive: new THREE.Color(element.color),
          emissiveIntensity: 0.5,
        });
      }
    });
    return clone;
  }, [meshObject, element?.color]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    let targetId = id;
    let current = element;
    while (current?.parentId) {
      const parent = allElements[current.parentId];
      if (parent?.type === 'group') {
        targetId = parent.id;
      }
      current = parent;
    }
    // Multi-select with shift
    if (e.shiftKey) {
      const nextSelection = selection.includes(targetId)
        ? selection.filter((selectedId) => selectedId !== targetId)
        : [...selection, targetId];
      setSelection(nextSelection);
    } else {
      setSelection([targetId]);
    }
  };

  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
    setSelection([id]);
  };

  const handleTransformStart = () => {
    setIsTransforming(true);
  };

  const handleTransformChange = (e: any) => {
    if (!e?.target?.object || !ghostRef.current) return;
    const obj = e.target.object;
    const rotation = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
    const scale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);
    const offset = getGizmoOffset(rotation, scale);
    ghostRef.current.position.set(obj.position.x - offset.x, obj.position.y - offset.y, obj.position.z - offset.z);
    ghostRef.current.rotation.copy(obj.rotation);
    ghostRef.current.scale.copy(obj.scale);
  };

  const handleTransformEnd = (e: any) => {
     setIsTransforming(false);
     if (!e?.target?.object) return;
     const obj = e.target.object;
     const rotation = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
     const scale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);
     const offset = getGizmoOffset(rotation, scale);
     updateElement(id, {
       position: [obj.position.x - offset.x, obj.position.y - offset.y, obj.position.z - offset.z],
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
    onDoubleClick: handleDoubleClick,
    castShadow: true,
    receiveShadow: true,
  };

  // Find children
  const childIds = Object.values(allElements)
    .filter(el => el.parentId === id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(el => el.id);

  const renderGeometry = (el: SceneElement) => {
    switch (el.type) {
      case 'box': {
        const radius = Math.max(0, Math.min(el.cornerRadius ?? 0, 0.5));
        return radius > 0 ? <roundedBoxGeometry args={[1, 1, 1, 2, radius]} /> : <boxGeometry />;
      }
      case 'sphere':
        return <sphereGeometry />;
      case 'cylinder':
        return <cylinderGeometry />;
      case 'torus': {
        const tube = Math.max(0.05, Math.min(el.torusThickness ?? 0.3, 0.95));
        return <torusGeometry args={[1, tube, 16, 32]} />;
      }
      case 'cone':
        return <coneGeometry args={[1, 1.4, 32]} />;
      case 'pyramid':
        return <coneGeometry args={[1, 1.4, 4]} />;
      case 'heart':
        return <primitive object={heartGeometry} attach="geometry" />;
      case 'star':
        return <primitive object={starGeometry} attach="geometry" />;
      case 'mesh': return null;
      default: return null;
    }
  };

  const buildGeometry = React.useCallback((el: SceneElement): THREE.BufferGeometry | null => {
    switch (el.type) {
      case 'box': {
        const radius = Math.max(0, Math.min(el.cornerRadius ?? 0, 0.5));
        return radius > 0 ? new RoundedBoxGeometry(1, 1, 1, 2, radius) : new THREE.BoxGeometry(1, 1, 1);
      }
      case 'sphere':
        return new THREE.SphereGeometry(1, 32, 16);
      case 'cylinder':
        return new THREE.CylinderGeometry(1, 1, 1, 32);
      case 'torus': {
        const tube = Math.max(0.05, Math.min(el.torusThickness ?? 0.3, 0.95));
        return new THREE.TorusGeometry(1, tube, 16, 32);
      }
      case 'cone':
        return new THREE.ConeGeometry(1, 1.4, 32);
      case 'pyramid':
        return new THREE.ConeGeometry(1, 1.4, 4);
      case 'heart':
        return heartGeometry.clone();
      case 'star':
        return starGeometry.clone();
      default:
        return null;
    }
  }, [heartGeometry, starGeometry]);

  const buildGhostObject = React.useCallback((el: SceneElement): THREE.Object3D | null => {
    switch (el.type) {
      case 'group': {
        const group = new THREE.Group();
        Object.values(allElements)
          .filter(child => child.parentId === el.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .forEach((child) => {
            const childObj = buildGhostObject(child);
            if (!childObj) return;
            childObj.position.set(child.position[0], child.position[1], child.position[2]);
            childObj.rotation.set(child.rotation[0], child.rotation[1], child.rotation[2]);
            childObj.scale.set(child.scale[0], child.scale[1], child.scale[2]);
            group.add(childObj);
          });
        return group;
      }
      case 'mesh': {
        if (!el.objData) return null;
        const loader = new OBJLoader();
        const obj = loader.parse(el.objData);
        const color = new THREE.Color(el.color);
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshStandardMaterial({
              color,
              transparent: true,
              opacity: ghostOpacity,
              depthWrite: false,
              emissive: color,
              emissiveIntensity: 0.5,
            });
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        return obj;
      }
      case 'subtraction': {
        const children = Object.values(allElements)
          .filter(child => child.parentId === el.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const baseEl = children[0];
        if (!baseEl) return null;
        const baseObj = buildGhostObject(baseEl);
        if (!baseObj) return null;
        baseObj.position.set(baseEl.position[0], baseEl.position[1], baseEl.position[2]);
        baseObj.rotation.set(baseEl.rotation[0], baseEl.rotation[1], baseEl.rotation[2]);
        baseObj.scale.set(baseEl.scale[0], baseEl.scale[1], baseEl.scale[2]);
        const group = new THREE.Group();
        group.add(baseObj);
        return group;
      }
      case 'box':
      case 'sphere':
      case 'cylinder':
      case 'torus':
      case 'cone':
      case 'pyramid':
      case 'heart':
      case 'star': {
        const geometry = buildGeometry(el);
        if (!geometry) return null;
        return new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: el.color,
            transparent: true,
            opacity: ghostOpacity,
            depthWrite: false,
            emissive: new THREE.Color(el.color),
            emissiveIntensity: 0.5,
          }),
        );
      }
      default:
        return null;
    }
  }, [allElements, buildGeometry, ghostOpacity]);

  const GhostPreview = () => (
    <group ref={ghostRef} position={element.position} rotation={element.rotation} scale={element.scale}>
      {element.type === 'group' ? (
        (() => {
          const ghostGroupObject = buildGhostObject(element);
          return ghostGroupObject ? <primitive object={ghostGroupObject} /> : null;
        })()
      ) : (
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
          ) : element.type === 'mesh' && ghostMeshObject ? (
            <primitive object={ghostMeshObject} />
          ) : (
            renderGeometry(element)
          )}
          <meshStandardMaterial 
            color={element.color} 
            transparent 
            opacity={ghostOpacity} 
            depthWrite={false}
            emissive={element.color}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );

  if (element.type === 'subtraction') {
    // Expect exactly 2 children for subtraction for now
    if (childIds.length !== 2) return null;
    const [baseId, subId] = childIds;
    const baseEl = allElements[baseId];
    const subEl = allElements[subId];

    return (
      <>
        <group {...commonProps} visible={!isTransforming}>
          <mesh>
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
          <Material color={baseEl.color} isSelected={isSelected} opacity={effectiveOpacity} />
        </mesh>
      </group>
        {isSelected && (
          <TransformControls 
            mode={transformMode} 
            onMouseDown={handleTransformStart}
            onChange={handleTransformChange}
            onMouseUp={handleTransformEnd}
            position={gizmoPosition}
            rotation={element.rotation}
            scale={element.scale}
          />
        )}
        {isSelected && isTransforming && <GhostPreview />}
      </>
    );
  }
  
  if (element.type === 'group') {
    return (
      <>
        <group {...commonProps} visible={!isTransforming}>
          {childIds.map(childId => (
            <RecursiveElement
              key={childId}
              id={childId}
              inheritedOpacity={isTransforming ? Math.min(effectiveOpacity, 0.6) : effectiveOpacity}
            />
          ))}
        </group>
        {isSelected && (
          <TransformControls 
            mode={transformMode} 
            onMouseDown={handleTransformStart}
            onChange={handleTransformChange}
            onMouseUp={handleTransformEnd}
            position={gizmoPosition}
            rotation={element.rotation}
            scale={element.scale}
          />
        )}
        {isSelected && isTransforming && <GhostPreview />}
      </>
    );
  }

  // Primitives
  return (
    <>
      {element.type === 'mesh' ? (
        <group {...commonProps} visible={!isTransforming}>
          {meshObject && <primitive object={effectiveOpacity < 1 ? transparentMeshObject ?? meshObject : meshObject} />}
        </group>
      ) : (
        <mesh {...commonProps} visible={!isTransforming}>
          {renderGeometry(element)}
          <Material color={element.color} isSelected={isSelected} opacity={effectiveOpacity} />
        </mesh>
      )}

      {isSelected && (
        <>
          <TransformControls 
              object={undefined} 
              mode={transformMode} 
              onMouseDown={handleTransformStart}
              onChange={handleTransformChange}
              onMouseUp={handleTransformEnd}
              position={gizmoPosition}
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
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
