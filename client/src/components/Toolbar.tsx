import { 
  Box, Circle, Cylinder, Combine, 
  Group, Ungroup, Move, RotateCw, Maximize, Undo2, Redo2, Copy, ClipboardPaste, CopyPlus
} from 'lucide-react';
import { useEditorStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TorusIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ConeIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 4L6 19h12L12 4Z" />
    <ellipse cx="12" cy="19" rx="6" ry="2" />
  </svg>
);

const PyramidIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 4L4 19h16L12 4Z" />
    <path d="M4 19h16" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
  </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.6L12 18l-5.8 3 1.1-6.6L2.6 9.8l6.5-.9L12 3Z" />
  </svg>
);

export function Toolbar() {
  const addElement = useEditorStore(state => state.addElement);
  const groupSelection = useEditorStore(state => state.groupSelection);
  const ungroupSelection = useEditorStore(state => state.ungroupSelection);
  const subtractSelection = useEditorStore(state => state.subtractSelection);
  const undo = useEditorStore(state => state.undo);
  const redo = useEditorStore(state => state.redo);
  const canUndo = useEditorStore(state => state.history.length > 0);
  const canRedo = useEditorStore(state => state.redoHistory.length > 0);
  const copySelection = useEditorStore(state => state.copySelection);
  const pasteClipboard = useEditorStore(state => state.pasteClipboard);
  const duplicateSelection = useEditorStore(state => state.duplicateSelection);
  const selection = useEditorStore(state => state.selection);
  const elements = useEditorStore(state => state.elements);
  const transformMode = useEditorStore(state => state.transformMode);
  const setTransformMode = useEditorStore(state => state.setTransformMode);

  const canGroup = selection.length > 1;
  const canUngroup = selection.length > 0; // Simple check
  const canSubtract =
    selection.length === 2 &&
    selection.every((id) =>
      ['box', 'sphere', 'cylinder', 'torus', 'cone', 'pyramid', 'heart', 'star'].includes(
        elements[id]?.type
      )
    );

  const transformTools = [
    { mode: 'translate', icon: Move, label: 'Перемещение (G)' },
    { mode: 'rotate', icon: RotateCw, label: 'Поворот (R)' },
    { mode: 'scale', icon: Maximize, label: 'Масштаб (S)' },
  ];

  const tools = [
    { label: 'Куб', icon: Box, action: () => addElement('box') },
    { label: 'Сфера', icon: Circle, action: () => addElement('sphere') },
    { label: 'Цилиндр', icon: Cylinder, action: () => addElement('cylinder') },
    { label: 'Тор', icon: TorusIcon, action: () => addElement('torus') },
    { label: 'Конус', icon: ConeIcon, action: () => addElement('cone') },
    { label: 'Пирамида', icon: PyramidIcon, action: () => addElement('pyramid') },
    { label: 'Сердце', icon: HeartIcon, action: () => addElement('heart') },
    { label: 'Звезда', icon: StarIcon, action: () => addElement('star') },
  ];

  const operations = [
    { 
      label: 'Группировать', 
      icon: Group, 
      action: groupSelection, 
      disabled: !canGroup 
    },
    { 
      label: 'Разгруппировать', 
      icon: Ungroup, 
      action: ungroupSelection, 
      disabled: !canUngroup 
    },
    { 
      label: 'Вычитание (A - B)', 
      icon: Combine, 
      action: subtractSelection, 
      disabled: !canSubtract 
    },
  ];

  return (
    <div className="h-16 border-b bg-card flex items-center px-4 justify-between shrink-0 z-10 shadow-sm">
      <div className="flex items-center space-x-2">
        <div className="font-bold text-xl mr-6 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          Tetrika 3D
        </div>
        
        <div className="flex items-center gap-1">
          {transformTools.map((tool) => (
            <Tooltip key={tool.mode}>
              <TooltipTrigger asChild>
                <Button 
                  variant={transformMode === tool.mode ? "default" : "ghost"} 
                  size="icon" 
                  onClick={() => setTransformMode(tool.mode as any)}
                  className="w-9 h-9"
                >
                  <tool.icon className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={undo}
                disabled={!canUndo}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <Undo2 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Отменить (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={redo}
                disabled={!canRedo}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <Redo2 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Повторить (Ctrl+Y)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={copySelection}
                disabled={selection.length === 0}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <Copy className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Копировать (Ctrl+C)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={pasteClipboard}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <ClipboardPaste className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Вставить (Ctrl+V)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={duplicateSelection}
                disabled={selection.length === 0}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <CopyPlus className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Дублировать (Ctrl+D)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />
        
        <div className="flex items-center gap-1">
           {tools.map((tool) => (
             <Tooltip key={tool.label}>
               <TooltipTrigger asChild>
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   onClick={tool.action}
                   className="hover:bg-primary/10 hover:text-primary transition-colors"
                 >
                   <tool.icon className="w-5 h-5" />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>{tool.label}</TooltipContent>
             </Tooltip>
           ))}
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        <div className="flex items-center gap-1">
          {operations.map((op) => (
            <Tooltip key={op.label}>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={op.action}
                  disabled={op.disabled}
                  className="hover:bg-accent hover:text-accent-foreground"
                >
                  <op.icon className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{op.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
