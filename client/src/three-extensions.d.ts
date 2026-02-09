import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ReactThreeFiber } from '@react-three/fiber';

declare module '@react-three/fiber' {
  interface ThreeElements {
    roundedBoxGeometry: ReactThreeFiber.BufferGeometryNode<
      RoundedBoxGeometry,
      typeof RoundedBoxGeometry
    >;
  }
}
