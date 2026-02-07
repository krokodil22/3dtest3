import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ElementType = 'box' | 'sphere' | 'cylinder' | 'torus' | 'group' | 'subtraction' | 'mesh';
export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface SceneElement {
  id: string;
  name: string;
  type: ElementType;
  order: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  objData?: string;
  parentId?: string;
  children?: string[]; // IDs of children
}

interface EditorState {
  elements: Record<string, SceneElement>;
  selection: string[]; // IDs of selected elements
  transformMode: TransformMode;
  history: Array<{
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

export const useEditorStore = create<EditorState>((set, get) => ({
  elements: {},
  selection: [],
  transformMode: 'translate',
  history: [],
  clipboard: null,

  addElement: (type) => {
    const id = uuidv4();
    const newElement: SceneElement = {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${Object.keys(get().elements).length + 1}`,
      type,
      order: getNextOrder(get().elements),
      ...DEFAULT_ELEMENT_PROPS,
      // Offset slightly so they don't overlap perfectly
      position: [Math.random() * 2 - 1, Math.random() * 2, Math.random() * 2 - 1],
    };

    set((state) => ({
      history: pushHistory(state),
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
      elements: { ...state.elements, [id]: newElement },
      selection: [id],
    }));
  },

  updateElement: (id, updates) => {
    set((state) => ({
      history: pushHistory(state),
      elements: {
        ...state.elements,
        [id]: { ...state.elements[id], ...updates },
      },
    }));
  },

  removeElements: (ids) => {
    set((state) => {
      const newElements = { ...state.elements };
      ids.forEach((id) => delete newElements[id]);
      return {
        history: pushHistory(state),
        elements: newElements,
        selection: state.selection.filter((selId) => !ids.includes(selId)),
      };
    });
  },

  setSelection: (ids) => set({ selection: ids }),
  
  clearSelection: () => set({ selection: [] }),

  setTransformMode: (mode) => set({ transformMode: mode }),

  groupSelection: () => {
    const state = get();
    const selectedIds = state.selection;
    if (selectedIds.length < 2) return;

    const groupId = uuidv4();
    const group: SceneElement = {
      id: groupId,
      name: `Group ${Object.keys(state.elements).length + 1}`,
      type: 'group',
      order: getNextOrder(state.elements),
      ...DEFAULT_ELEMENT_PROPS,
      children: selectedIds,
    };

    // Calculate center of selection to position group? 
    // For simplicity, group at 0,0,0, but logically parenthood is key.
    
    set((state) => {
      const updatedElements = { ...state.elements };
      
      // Update children to point to parent
      selectedIds.forEach(id => {
        if (updatedElements[id]) {
          updatedElements[id] = { ...updatedElements[id], parentId: groupId };
        }
      });
      
      return {
        history: pushHistory(state),
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
            if (updatedElements[childId]) {
              updatedElements[childId] = { ...updatedElements[childId], parentId: undefined };
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
      ['box', 'sphere', 'cylinder', 'torus'].includes(state.elements[id]?.type)
    );
    if (!canSubtract) return;
    
    const orderedSelection = [...state.selection].sort((a, b) => {
      const orderA = state.elements[a]?.order ?? 0;
      const orderB = state.elements[b]?.order ?? 0;
      return orderA - orderB;
    });
    const [idA, idB] = orderedSelection;
    const csgId = uuidv4();
    
    // CSG Element acts as a container that tells the renderer to subtract B from A
    const csgElement: SceneElement = {
      id: csgId,
      name: `Subtraction ${Object.keys(state.elements).length + 1}`,
      type: 'subtraction',
      order: getNextOrder(state.elements),
      ...DEFAULT_ELEMENT_PROPS,
      children: [idA, idB], // Order matters: A - B
    };
    
    set((state) => {
       const updatedElements = { ...state.elements };
       
       // Parent the operands to the CSG object
       [idA, idB].forEach(id => {
         if (updatedElements[id]) {
           updatedElements[id] = { ...updatedElements[id], parentId: csgId };
         }
       });
       
       return {
         history: pushHistory(state),
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
      elements: updatedElements,
      selection: newSelection,
    });
  },

  loadScene: (elements) =>
    set({ elements: ensureElementOrder(elements), selection: [], history: [], clipboard: null }),
  
  resetScene: () => set({ elements: {}, selection: [], history: [], clipboard: null }),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      return {
        elements: previous.elements,
        selection: previous.selection,
        history: state.history.slice(0, -1),
      };
    }),
}));
