import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

export type ElementType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'torus'
  | 'cone'
  | 'pyramid'
  | 'heart'
  | 'star'
  | 'group'
  | 'subtraction'
  | 'mesh';
export type TransformMode = 'translate' | 'rotate' | 'scale';

export const ELEMENT_LABELS: Record<ElementType, string> = {
  box: 'Куб',
  sphere: 'Сфера',
  cylinder: 'Цилиндр',
  torus: 'Тор',
  cone: 'Конус',
  pyramid: 'Пирамида',
  heart: 'Сердце',
  star: 'Звезда',
  group: 'Группа',
  subtraction: 'Вычитание',
  mesh: 'Меш',
};

export interface SceneElement {
  id: string;
  name: string;
  type: ElementType;
  order: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  cornerRadius?: number;
  torusThickness?: number;
  objData?: string;
  parentId?: string;
  children?: string[]; // IDs of children
}

export type SelectionBounds = {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
};

interface EditorState {
  elements: Record<string, SceneElement>;
  selection: string[]; // IDs of selected elements
  transformMode: TransformMode;
  alignmentMode: boolean;
  history: Array<{
    elements: Record<string, SceneElement>;
    selection: string[];
  }>;
  redoHistory: Array<{
    elements: Record<string, SceneElement>;
    selection: string[];
  }>;
  clipboard: {
    elements: SceneElement[];
    selection: string[];
  } | null;
  
  // Actions
  addElement: (type: ElementType) => void;
  addObjElement: (name: string, objData: string) => void;
  updateElement: (id: string, updates: Partial<SceneElement>) => void;
  removeElements: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setTransformMode: (mode: TransformMode) => void;
  toggleAlignmentMode: () => void;
  setAlignmentMode: (enabled: boolean) => void;
  alignSelection: (axis: 'x' | 'y' | 'z', anchor: 'min' | 'center' | 'max') => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  subtractSelection: () => void;
  reorderElements: (activeId: string, overId: string) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  loadScene: (elements: Record<string, SceneElement>) => void;
  resetScene: () => void;
  undo: () => void;
  redo: () => void;
}

const DEFAULT_ELEMENT_PROPS = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  color: '#3b82f6',
};

const MAX_HISTORY = 50;

const cloneElements = (elements: Record<string, SceneElement>) =>
  Object.fromEntries(
    Object.entries(elements).map(([id, element]) => [
      id,
      {
        ...element,
        position: [...element.position] as [number, number, number],
        rotation: [...element.rotation] as [number, number, number],
        scale: [...element.scale] as [number, number, number],
        children: element.children ? [...element.children] : undefined,
      },
    ])
  );

const getNextOrder = (elements: Record<string, SceneElement>) => {
  const orders = Object.values(elements).map((element) => element.order ?? -1);
  return (orders.length ? Math.max(...orders) : -1) + 1;
};

const sortElementsByOrder = (elements: Record<string, SceneElement>) =>
  Object.values(elements).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const ensureElementOrder = (elements: Record<string, SceneElement>) => {
  const orders = Object.values(elements)
    .map((element) => element.order)
    .filter((order): order is number => typeof order === 'number');
  let nextOrder = (orders.length ? Math.max(...orders) : -1) + 1;

  return Object.fromEntries(
    Object.entries(elements).map(([id, element]) => {
      const order = typeof element.order === 'number' ? element.order : nextOrder++;
      return [
        id,
        {
          ...element,
          order,
        },
      ];
    })
  );
};

const collectDescendantIds = (elements: Record<string, SceneElement>, rootIds: string[]) => {
  const collected = new Set(rootIds);
  let added = true;

  while (added) {
    added = false;
    Object.values(elements).forEach((element) => {
      if (element.parentId && collected.has(element.parentId) && !collected.has(element.id)) {
        collected.add(element.id);
        added = true;
      }
    });
  }

  return [...collected];
};

const getWorldTransform = (elements: Record<string, SceneElement>, element: SceneElement) => {
  const position = new THREE.Vector3(...element.position);
  const rotation = new THREE.Euler(...element.rotation);
  const scale = new THREE.Vector3(...element.scale);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  let currentParentId = element.parentId;

  while (currentParentId) {
    const parent = elements[currentParentId];
    if (!parent) break;
    const parentScale = new THREE.Vector3(...parent.scale);
    const parentRotation = new THREE.Euler(...parent.rotation);
    const parentQuaternion = new THREE.Quaternion().setFromEuler(parentRotation);
    const parentPosition = new THREE.Vector3(...parent.position);

    position.multiply(parentScale).applyQuaternion(parentQuaternion).add(parentPosition);
    scale.multiply(parentScale);
    quaternion.premultiply(parentQuaternion);
    rotation.setFromQuaternion(quaternion);

    currentParentId = parent.parentId;
  }

  return {
    position: [position.x, position.y, position.z] as [number, number, number],
    rotation: [rotation.x, rotation.y, rotation.z] as [number, number, number],
    scale: [scale.x, scale.y, scale.z] as [number, number, number],
  };
};

const getElementHalfSize = (element: SceneElement): [number, number, number] => {
  switch (element.type) {
    case 'box':
      return [0.5, 0.5, 0.5];
    case 'sphere':
      return [1, 1, 1];
    case 'cylinder':
      return [1, 1, 1];
    case 'torus': {
      const tube = Math.max(0.05, Math.min(element.torusThickness ?? 0.3, 0.95));
      const radius = 1;
      return [radius + tube, tube, radius + tube];
    }
    case 'cone':
    case 'pyramid':
      return [1, 0.7, 1];
    case 'heart':
    case 'star':
      return [1, 1, 0.2];
    case 'mesh':
      return [0.5, 0.5, 0.5];
    default:
      return [0, 0, 0];
  }
};

const getSelectionCenter = (
  elements: Record<string, SceneElement>,
  ids: string[],
  includeDescendants: boolean
) => {
  const idsForBounds = includeDescendants ? collectDescendantIds(elements, ids) : ids;
  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  idsForBounds.forEach((id) => {
    const element = elements[id];
    if (!element || element.type === 'group' || element.type === 'subtraction') return;
    const { position, scale } = getWorldTransform(elements, element);
    const [halfX, halfY, halfZ] = getElementHalfSize(element);
    const scaledHalf: [number, number, number] = [
      halfX * scale[0],
      halfY * scale[1],
      halfZ * scale[2],
    ];
    min = [
      Math.min(min[0], position[0] - scaledHalf[0]),
      Math.min(min[1], position[1] - scaledHalf[1]),
      Math.min(min[2], position[2] - scaledHalf[2]),
    ];
    max = [
      Math.max(max[0], position[0] + scaledHalf[0]),
      Math.max(max[1], position[1] + scaledHalf[1]),
      Math.max(max[2], position[2] + scaledHalf[2]),
    ];
  });

  if (!Number.isFinite(min[0])) {
    return [0, 0, 0] as [number, number, number];
  }

  return [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ] as [number, number, number];
};

export const getSelectionBounds = (
  elements: Record<string, SceneElement>,
  ids: string[],
  includeDescendants: boolean
): SelectionBounds | null => {
  const idsForBounds = includeDescendants ? collectDescendantIds(elements, ids) : ids;
  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  idsForBounds.forEach((id) => {
    const element = elements[id];
    if (!element || element.type === 'group' || element.type === 'subtraction') return;
    const { position, scale } = getWorldTransform(elements, element);
    const [halfX, halfY, halfZ] = getElementHalfSize(element);
    const scaledHalf: [number, number, number] = [
      halfX * scale[0],
      halfY * scale[1],
      halfZ * scale[2],
    ];
    min = [
      Math.min(min[0], position[0] - scaledHalf[0]),
      Math.min(min[1], position[1] - scaledHalf[1]),
      Math.min(min[2], position[2] - scaledHalf[2]),
    ];
    max = [
      Math.max(max[0], position[0] + scaledHalf[0]),
      Math.max(max[1], position[1] + scaledHalf[1]),
      Math.max(max[2], position[2] + scaledHalf[2]),
    ];
  });

  if (!Number.isFinite(min[0])) {
    return null;
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];

  return { min, max, center };
};

const cloneElement = (element: SceneElement): SceneElement => ({
  ...element,
  position: [...element.position] as [number, number, number],
  rotation: [...element.rotation] as [number, number, number],
  scale: [...element.scale] as [number, number, number],
  children: element.children ? [...element.children] : undefined,
});

const buildClonedElements = (
  sourceElements: SceneElement[],
  selection: string[],
  offset: [number, number, number],
  orderStart: number
) => {
  const idMap = new Map<string, string>();
  sourceElements.forEach((element) => {
    idMap.set(element.id, uuidv4());
  });

  let currentOrder = orderStart;
  const clonedElements: SceneElement[] = sourceElements.map((element) => {
    const [x, y, z] = element.position;
    const newId = idMap.get(element.id) ?? uuidv4();
    const newParentId = element.parentId ? idMap.get(element.parentId) : undefined;
    return {
      ...cloneElement(element),
      id: newId,
      order: currentOrder++,
      parentId: newParentId,
      children: element.children?.map((childId) => idMap.get(childId) ?? childId),
      position: [x + offset[0], y + offset[1], z + offset[2]],
    };
  });

  const newSelection = selection
    .map((id) => idMap.get(id))
    .filter((id): id is string => Boolean(id));

  return { clonedElements, newSelection };
};

const pushHistory = (state: EditorState) =>
  [...state.history, { elements: cloneElements(state.elements), selection: [...state.selection] }].slice(
    -MAX_HISTORY
  );

const buildSnapshot = (state: EditorState) => ({
  elements: cloneElements(state.elements),
  selection: [...state.selection],
});

const applyWorldDeltaToElement = (
  elements: Record<string, SceneElement>,
  element: SceneElement,
  delta: THREE.Vector3
) => {
  if (!element.parentId) {
    return {
      ...element,
      position: [
        element.position[0] + delta.x,
        element.position[1] + delta.y,
        element.position[2] + delta.z,
      ] as [number, number, number],
    };
  }

  const parent = elements[element.parentId];
  if (!parent) {
    return {
      ...element,
      position: [
        element.position[0] + delta.x,
        element.position[1] + delta.y,
        element.position[2] + delta.z,
      ] as [number, number, number],
    };
  }

  const parentWorld = getWorldTransform(elements, parent);
  const parentRotation = new THREE.Euler(
    parentWorld.rotation[0],
    parentWorld.rotation[1],
    parentWorld.rotation[2]
  );
  const parentQuaternion = new THREE.Quaternion().setFromEuler(parentRotation);
  const parentScale = new THREE.Vector3(...parentWorld.scale);
  const safeScale = new THREE.Vector3(
    parentScale.x === 0 ? 1 : parentScale.x,
    parentScale.y === 0 ? 1 : parentScale.y,
    parentScale.z === 0 ? 1 : parentScale.z
  );
  const deltaLocal = delta.clone().applyQuaternion(parentQuaternion.clone().invert());
  deltaLocal.set(deltaLocal.x / safeScale.x, deltaLocal.y / safeScale.y, deltaLocal.z / safeScale.z);

  return {
    ...element,
    position: [
      element.position[0] + deltaLocal.x,
      element.position[1] + deltaLocal.y,
      element.position[2] + deltaLocal.z,
    ] as [number, number, number],
  };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  elements: {},
  selection: [],
  transformMode: 'translate',
  alignmentMode: false,
  history: [],
  redoHistory: [],
  clipboard: null,

  addElement: (type) => {
    const id = uuidv4();
    const newElement: SceneElement = {
      id,
      name: `${ELEMENT_LABELS[type]} ${Object.keys(get().elements).length + 1}`,
      type,
      order: getNextOrder(get().elements),
      ...DEFAULT_ELEMENT_PROPS,
      ...(type === 'box' ? { cornerRadius: 0 } : {}),
      ...(type === 'torus' ? { torusThickness: 0.3 } : {}),
      // Offset slightly so they don't overlap perfectly
      position: [Math.random() * 2 - 1, Math.random() * 2, Math.random() * 2 - 1],
    };

    set((state) => ({
      history: pushHistory(state),
      redoHistory: [],
      elements: { ...state.elements, [id]: newElement },
      selection: [id], // Auto-select new item
    }));
  },

  addObjElement: (name, objData) => {
    const id = uuidv4();
    const newElement: SceneElement = {
      id,
      name,
      type: 'mesh',
      order: getNextOrder(get().elements),
      ...DEFAULT_ELEMENT_PROPS,
      objData,
      position: [0, 0, 0],
    };

    set((state) => ({
      history: pushHistory(state),
      redoHistory: [],
      elements: { ...state.elements, [id]: newElement },
      selection: [id],
    }));
  },

  updateElement: (id, updates) => {
    set((state) => ({
      history: pushHistory(state),
      redoHistory: [],
      elements: {
        ...state.elements,
        [id]: { ...state.elements[id], ...updates },
      },
    }));
  },

  removeElements: (ids) => {
    set((state) => {
      const idsToRemove = collectDescendantIds(state.elements, ids);
      const newElements = { ...state.elements };
      idsToRemove.forEach((id) => delete newElements[id]);
      return {
        history: pushHistory(state),
        redoHistory: [],
        elements: newElements,
        selection: state.selection.filter((selId) => !idsToRemove.includes(selId)),
      };
    });
  },

  setSelection: (ids) =>
    set((state) => ({
      selection: ids,
      alignmentMode: ids.length > 1 ? state.alignmentMode : false,
    })),
  
  clearSelection: () => set({ selection: [], alignmentMode: false }),

  setTransformMode: (mode) => set({ transformMode: mode }),

  toggleAlignmentMode: () =>
    set((state) => ({
      alignmentMode: state.selection.length > 1 ? !state.alignmentMode : false,
    })),

  setAlignmentMode: (enabled) =>
    set((state) => ({
      alignmentMode: state.selection.length > 1 ? enabled : false,
    })),

  alignSelection: (axis, anchor) => {
    const state = get();
    if (state.selection.length < 2) return;
    const bounds = getSelectionBounds(state.elements, state.selection, true);
    if (!bounds) return;
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const target = anchor === 'min'
      ? bounds.min[axisIndex]
      : anchor === 'max'
        ? bounds.max[axisIndex]
        : bounds.center[axisIndex];

    set((state) => {
      const updatedElements = { ...state.elements };
      state.selection.forEach((id) => {
        const element = updatedElements[id];
        if (!element) return;
        const elementBounds = getSelectionBounds(state.elements, [id], true);
        if (!elementBounds) return;
        const sourceValue =
          anchor === 'min'
            ? elementBounds.min[axisIndex]
            : anchor === 'max'
              ? elementBounds.max[axisIndex]
              : elementBounds.center[axisIndex];
        const deltaValue = target - sourceValue;
        const delta = new THREE.Vector3(
          axisIndex === 0 ? deltaValue : 0,
          axisIndex === 1 ? deltaValue : 0,
          axisIndex === 2 ? deltaValue : 0
        );
        updatedElements[id] = applyWorldDeltaToElement(state.elements, element, delta);
      });

      return {
        history: pushHistory(state),
        redoHistory: [],
        elements: updatedElements,
      };
    });
  },

  groupSelection: () => {
    const state = get();
    const selectedIds = state.selection;
    if (selectedIds.length < 2) return;

    const center = getSelectionCenter(state.elements, selectedIds, true);
    const groupId = uuidv4();
    const group: SceneElement = {
      id: groupId,
      name: `${ELEMENT_LABELS.group} ${Object.keys(state.elements).length + 1}`,
      type: 'group',
      order: getNextOrder(state.elements),
      ...DEFAULT_ELEMENT_PROPS,
      position: center,
      children: selectedIds,
    };

    set((state) => {
      const updatedElements = { ...state.elements };
      
      // Update children to point to parent
      selectedIds.forEach(id => {
        const element = updatedElements[id];
        if (element) {
          const { position, rotation, scale } = getWorldTransform(state.elements, element);
          updatedElements[id] = {
            ...element,
            parentId: groupId,
            position: [
              position[0] - center[0],
              position[1] - center[1],
              position[2] - center[2],
            ],
            rotation,
            scale,
          };
        }
      });
      
      return {
        history: pushHistory(state),
        redoHistory: [],
        elements: { ...updatedElements, [groupId]: group },
        selection: [groupId],
      };
    });
  },

  ungroupSelection: () => {
    // Simplified ungroup logic
    const state = get();
    const selectedIds = state.selection;

    set((state) => {
      const updatedElements = { ...state.elements };
      const newSelection: string[] = [];

      selectedIds.forEach(groupId => {
        const group = updatedElements[groupId];
        if (group && group.type === 'group' && group.children) {
          group.children.forEach(childId => {
            const child = updatedElements[childId];
            if (child) {
              const { position, rotation, scale } = getWorldTransform(state.elements, child);
              updatedElements[childId] = {
                ...child,
                parentId: undefined,
                position,
                rotation,
                scale,
              };
              newSelection.push(childId);
            }
          });
          delete updatedElements[groupId];
        } else {
          // keep non-groups selected
          newSelection.push(groupId);
        }
      });

      return {
        history: pushHistory(state),
        redoHistory: [],
        elements: updatedElements,
        selection: newSelection,
      };
    });
  },
  
  subtractSelection: () => {
    const state = get();
    // Needs exactly 2 meshes
    if (state.selection.length !== 2) return;
    const canSubtract = state.selection.every((id) =>
      ['box', 'sphere', 'cylinder', 'torus', 'cone', 'pyramid', 'heart', 'star'].includes(
        state.elements[id]?.type
      )
    );
    if (!canSubtract) return;
    
    const orderedSelection = [...state.selection].sort((a, b) => {
      const orderA = state.elements[a]?.order ?? 0;
      const orderB = state.elements[b]?.order ?? 0;
      return orderA - orderB;
    });
    const [idA, idB] = orderedSelection;
    const center = getSelectionCenter(state.elements, [idA, idB], false);
    const csgId = uuidv4();
    
    // CSG Element acts as a container that tells the renderer to subtract B from A
    const csgElement: SceneElement = {
      id: csgId,
      name: `${ELEMENT_LABELS.subtraction} ${Object.keys(state.elements).length + 1}`,
      type: 'subtraction',
      order: getNextOrder(state.elements),
      ...DEFAULT_ELEMENT_PROPS,
      position: center,
      children: [idA, idB], // Order matters: A - B
    };
    
    set((state) => {
       const updatedElements = { ...state.elements };
       
       // Parent the operands to the CSG object
       [idA, idB].forEach(id => {
         const element = updatedElements[id];
         if (element) {
           const { position, rotation, scale } = getWorldTransform(state.elements, element);
           updatedElements[id] = {
             ...element,
             parentId: csgId,
             position: [
               position[0] - center[0],
               position[1] - center[1],
               position[2] - center[2],
             ],
             rotation,
             scale,
           };
         }
       });
       
       return {
         history: pushHistory(state),
         redoHistory: [],
         elements: { ...updatedElements, [csgId]: csgElement },
         selection: [csgId],
       };
    });
  },

  reorderElements: (activeId, overId) => {
    set((state) => {
      if (activeId === overId) return state;
      const ordered = sortElementsByOrder(state.elements);
      const activeIndex = ordered.findIndex((element) => element.id === activeId);
      const overIndex = ordered.findIndex((element) => element.id === overId);
      if (activeIndex === -1 || overIndex === -1) return state;

      const updatedOrder = [...ordered];
      const [moved] = updatedOrder.splice(activeIndex, 1);
      updatedOrder.splice(overIndex, 0, moved);

      const updatedElements = { ...state.elements };
      updatedOrder.forEach((element, index) => {
        updatedElements[element.id] = { ...updatedElements[element.id], order: index };
      });

      return {
        history: pushHistory(state),
        redoHistory: [],
        elements: updatedElements,
      };
    });
  },

  copySelection: () => {
    const state = get();
    if (state.selection.length === 0) return;
    const idsToCopy = collectDescendantIds(state.elements, state.selection);
    const elementsToCopy = sortElementsByOrder(state.elements).filter((element) =>
      idsToCopy.includes(element.id)
    );
    set({
      clipboard: {
        elements: elementsToCopy.map(cloneElement),
        selection: [...state.selection],
      },
    });
  },

  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard || state.clipboard.elements.length === 0) return;

    const orderStart = getNextOrder(state.elements);
    const { clonedElements, newSelection } = buildClonedElements(
      state.clipboard.elements,
      state.clipboard.selection,
      [0.5, 0.5, 0.5],
      orderStart
    );

    const updatedElements = { ...state.elements };
    clonedElements.forEach((element) => {
      updatedElements[element.id] = element;
    });

    set({
      history: pushHistory(state),
      redoHistory: [],
      elements: updatedElements,
      selection: newSelection,
    });
  },

  duplicateSelection: () => {
    const state = get();
    if (state.selection.length === 0) return;
    const idsToCopy = collectDescendantIds(state.elements, state.selection);
    const elementsToCopy = sortElementsByOrder(state.elements).filter((element) =>
      idsToCopy.includes(element.id)
    );
    const orderStart = getNextOrder(state.elements);
    const { clonedElements, newSelection } = buildClonedElements(
      elementsToCopy,
      state.selection,
      [0.5, 0.5, 0.5],
      orderStart
    );

    const updatedElements = { ...state.elements };
    clonedElements.forEach((element) => {
      updatedElements[element.id] = element;
    });

    set({
      history: pushHistory(state),
      redoHistory: [],
      elements: updatedElements,
      selection: newSelection,
    });
  },

  loadScene: (elements) =>
    set({
      elements: ensureElementOrder(elements),
      selection: [],
      alignmentMode: false,
      history: [],
      redoHistory: [],
      clipboard: null,
    }),
  
  resetScene: () =>
    set({ elements: {}, selection: [], alignmentMode: false, history: [], redoHistory: [], clipboard: null }),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      return {
        elements: previous.elements,
        selection: previous.selection,
        history: state.history.slice(0, -1),
        redoHistory: [...state.redoHistory, buildSnapshot(state)].slice(-MAX_HISTORY),
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoHistory.length === 0) return state;
      const next = state.redoHistory[state.redoHistory.length - 1];
      return {
        elements: next.elements,
        selection: next.selection,
        history: pushHistory(state),
        redoHistory: state.redoHistory.slice(0, -1),
      };
    }),
}));
