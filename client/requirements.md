## Packages
three | 3D library
@react-three/fiber | React renderer for Three.js
@react-three/drei | Helpers for R3F
@react-three/csg | Constructive Solid Geometry for R3F
zustand | State management for the 3D scene
uuid | For generating unique IDs for scene elements
framer-motion | UI animations

## Notes
- The app requires a robust state management solution (Zustand) to handle the scene graph separate from the API data.
- 3D operations (CSG) can be computationally expensive; efficient react-three-fiber usage is key.
- The editor needs to handle complex object relationships (parenting, grouping).
