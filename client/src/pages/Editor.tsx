import { Toolbar } from '@/components/Toolbar';
import { Viewport } from '@/components/Viewport';
import { Sidebar } from '@/components/Sidebar';
import { ProjectManager } from '@/components/ProjectManager';
import { Loader2 } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { useEditorStore } from '@/lib/store';

export default function Editor() {
  const undo = useEditorStore(state => state.undo);
  const redo = useEditorStore(state => state.redo);
  const copySelection = useEditorStore(state => state.copySelection);
  const pasteClipboard = useEditorStore(state => state.pasteClipboard);
  const duplicateSelection = useEditorStore(state => state.duplicateSelection);
  const removeElements = useEditorStore(state => state.removeElements);
  const selection = useEditorStore(state => state.selection);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isEditableTarget) return;

      const key = event.key.toLowerCase();
      const code = event.code.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const isUndo = hasModifier && (key === 'z' || code === 'keyz');
      if (isUndo && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (isUndo) {
        event.preventDefault();
        undo();
        return;
      }

      if (hasModifier && (key === 'y' || code === 'keyy')) {
        event.preventDefault();
        redo();
        return;
      }

      if (hasModifier && (key === 'c' || code === 'keyc')) {
        event.preventDefault();
        copySelection();
        return;
      }

      if (hasModifier && (key === 'v' || code === 'keyv')) {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (hasModifier && (key === 'd' || code === 'keyd')) {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if ((key === 'delete' || key === 'backspace') && selection.length > 0) {
        event.preventDefault();
        removeElements(selection);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelection, duplicateSelection, pasteClipboard, redo, removeElements, selection, undo]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <ProjectManager />
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-[#111]">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span>Загрузка сцены...</span>
              </div>
            </div>
          }>
            <Viewport />
          </Suspense>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
