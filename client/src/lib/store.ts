import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ElementType = 'box' | 'sphere' | 'cylinder' | 'torus' | 'group' | 'subtraction';
export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface SceneElement {
  id: string;
  name: string;
  type: ElementType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  parentId?: string;
  children?: string[]; // IDs of children
}

interface EditorState {
  elements: Record<string, SceneElement>;
  selection: string[]; // IDs of selected elements
  transformMode: TransformMode;
  
  // Actions
  addElement: (type: ElementType) => void;
  updateElement: (id: string, updates: Partial<SceneElement>) => void;
  removeElements: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setTransformMode: (mode: TransformMode) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  subtractSelection: () => void;
  loadScene: (elements: Record<string, SceneElement>) => void;
  resetScene: () => void;
}

const DEFAULT_ELEMENT_PROPS = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  color: '#3b82f6',
};

export const useEditorStore = create<EditorState>((set, get) => ({
  elements: {},
  selection: [],
  transformMode: 'translate',

  addElement: (type) => {
    const id = uuidv4();
    const newElement: SceneElement = {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${Object.keys(get().elements).length + 1}`,
      type,
      ...DEFAULT_ELEMENT_PROPS,
      // Offset slightly so they don't overlap perfectly
      position: [Math.random() * 2 - 1, Math.random() * 2, Math.random() * 2 - 1],
    };

    set((state) => ({
      elements: { ...state.elements, [id]: newElement },
      selection: [id], // Auto-select new item
    }));
  },

  updateElement: (id, updates) => {
    set((state) => ({
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
        elements: updatedElements,
        selection: newSelection,
      };
    });
  },
  
  subtractSelection: () => {
    const state = get();
    // Needs exactly 2 meshes
    if (state.selection.length !== 2) return;
    
    const [idA, idB] = state.selection;
    const csgId = uuidv4();
    
    // CSG Element acts as a container that tells the renderer to subtract B from A
    const csgElement: SceneElement = {
      id: csgId,
      name: `Subtraction ${Object.keys(state.elements).length + 1}`,
      type: 'subtraction',
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
         elements: { ...updatedElements, [csgId]: csgElement },
         selection: [csgId],
       };
    });
  },

  loadScene: (elements) => set({ elements, selection: [] }),
  
  resetScene: () => set({ elements: {}, selection: [] }),
}));
