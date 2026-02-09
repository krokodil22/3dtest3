import { useMemo, useState } from 'react';
import { useEditorStore, type SceneElement } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Cuboid, Layers, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function PropertyInput({ 
  label, 
  value, 
  onChange 
}: { 
  label: string, 
  value: number, 
  onChange: (val: number) => void 
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-4 text-muted-foreground font-mono">{label}</span>
      <Input 
        type="number" 
        step={0.1}
        className="h-7 text-xs px-2"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

export function Sidebar() {
  const elements = useEditorStore(state => state.elements);
  const selection = useEditorStore(state => state.selection);
  const setSelection = useEditorStore(state => state.setSelection);
  const updateElement = useEditorStore(state => state.updateElement);
  const removeElements = useEditorStore(state => state.removeElements);
  const reorderElements = useEditorStore(state => state.reorderElements);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const selectedId = selection.length === 1 ? selection[0] : null;
  const selectedElement = selectedId ? elements[selectedId] : null;

  const { rootElements, childrenByParent } = useMemo(() => {
    const orderedElements = Object.values(elements).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const rootKey = '__root__';
    const map = new Map<string, SceneElement[]>();

    orderedElements.forEach((element) => {
      const key = element.parentId ?? rootKey;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(element);
    });

    return {
      rootElements: map.get(rootKey) ?? [],
      childrenByParent: map,
    };
  }, [elements]);

  const renderElementRow = (el: SceneElement, depth: number) => {
    const childElements = childrenByParent.get(el.id) ?? [];

    return (
      <div key={el.id}>
        <div
          className={cn(
            "flex items-center gap-2 pr-3 py-2 rounded-md text-sm cursor-pointer transition-colors hover:bg-muted/50",
            selection.includes(el.id) && "bg-primary/10 text-primary font-medium",
            draggingId === el.id && "opacity-50"
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setSelection([el.id])}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', el.id);
            event.dataTransfer.effectAllowed = 'move';
            setDraggingId(el.id);
          }}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const activeId = event.dataTransfer.getData('text/plain');
            if (activeId) {
              reorderElements(activeId, el.id);
            }
            setDraggingId(null);
          }}
        >
          <Cuboid className="w-3.5 h-3.5 opacity-70" />
          <span className="truncate flex-1">{el.name}</span>
          <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {el.type}
          </span>
        </div>
        {childElements.length > 0 && (
          <div className="space-y-1">
            {childElements.map((child) => renderElementRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col shrink-0">
      {/* Scene Graph */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" /> Scene Graph
          </h3>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {rootElements.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Scene is empty. Add objects from the toolbar.
              </p>
            )}
            {rootElements.map((el) => renderElementRow(el, 0))}
          </div>
        </ScrollArea>
      </div>

      {/* Properties Panel */}
      <div className="h-1/2 border-t bg-card/50 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-sm">Properties</h3>
          {selectedId && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-7 w-7 p-0"
              onClick={() => removeElements([selectedId])}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        
        <ScrollArea className="flex-1 p-4">
          {!selectedElement ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              Select an object to edit properties
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Name</Label>
                <Input 
                  value={selectedElement.name} 
                  onChange={(e) => updateElement(selectedElement.id, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase text-muted-foreground">Position</Label>
                <div className="grid grid-cols-3 gap-2">
                  <PropertyInput 
                    label="X" 
                    value={selectedElement.position[0]} 
                    onChange={(v) => {
                      const [, y, z] = selectedElement.position;
                      updateElement(selectedElement.id, { position: [v, y, z] });
                    }} 
                  />
                  <PropertyInput 
                    label="Y" 
                    value={selectedElement.position[1]} 
                    onChange={(v) => {
                      const [x, , z] = selectedElement.position;
                      updateElement(selectedElement.id, { position: [x, v, z] });
                    }} 
                  />
                  <PropertyInput 
                    label="Z" 
                    value={selectedElement.position[2]} 
                    onChange={(v) => {
                      const [x, y, ] = selectedElement.position;
                      updateElement(selectedElement.id, { position: [x, y, v] });
                    }} 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase text-muted-foreground">Rotation</Label>
                <div className="grid grid-cols-3 gap-2">
                  <PropertyInput 
                    label="X" 
                    value={selectedElement.rotation[0]} 
                    onChange={(v) => {
                      const [, y, z] = selectedElement.rotation;
                      updateElement(selectedElement.id, { rotation: [v, y, z] });
                    }} 
                  />
                  <PropertyInput 
                    label="Y" 
                    value={selectedElement.rotation[1]} 
                    onChange={(v) => {
                      const [x, , z] = selectedElement.rotation;
                      updateElement(selectedElement.id, { rotation: [x, v, z] });
                    }} 
                  />
                  <PropertyInput 
                    label="Z" 
                    value={selectedElement.rotation[2]} 
                    onChange={(v) => {
                      const [x, y, ] = selectedElement.rotation;
                      updateElement(selectedElement.id, { rotation: [x, y, v] });
                    }} 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase text-muted-foreground">Scale</Label>
                <div className="grid grid-cols-3 gap-2">
                  <PropertyInput 
                    label="X" 
                    value={selectedElement.scale[0]} 
                    onChange={(v) => {
                      const [, y, z] = selectedElement.scale;
                      updateElement(selectedElement.id, { scale: [v, y, z] });
                    }} 
                  />
                  <PropertyInput 
                    label="Y" 
                    value={selectedElement.scale[1]} 
                    onChange={(v) => {
                      const [x, , z] = selectedElement.scale;
                      updateElement(selectedElement.id, { scale: [x, v, z] });
                    }} 
                  />
                  <PropertyInput 
                    label="Z" 
                    value={selectedElement.scale[2]} 
                    onChange={(v) => {
                      const [x, y, ] = selectedElement.scale;
                      updateElement(selectedElement.id, { scale: [x, y, v] });
                    }} 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Color</Label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={selectedElement.color}
                    onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                    className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"
                  />
                  <Input 
                    value={selectedElement.color}
                    onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                    className="h-8 font-mono text-xs flex-1" 
                  />
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
