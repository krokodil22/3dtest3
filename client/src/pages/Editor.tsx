import { Toolbar } from '@/components/Toolbar';
import { Viewport } from '@/components/Viewport';
import { Sidebar } from '@/components/Sidebar';
import { ProjectManager } from '@/components/ProjectManager';
import { Loader2 } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { useEditorStore } from '@/lib/store';

export default function Editor() {
  const undo = useEditorStore(state => state.undo);
  const copySelection = useEditorStore(state => state.copySelection);
  const pasteClipboard = useEditorStore(state => state.pasteClipboard);
  const duplicateSelection = useEditorStore(state => state.duplicateSelection);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isEditableTarget) return;

      const key = event.key.toLowerCase();
      const isUndo = (event.ctrlKey || event.metaKey) && key === 'z';
      if (isUndo && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'c') {
        event.preventDefault();
        copySelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'v') {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'd') {
        event.preventDefault();
        duplicateSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelection, duplicateSelection, pasteClipboard, undo]);

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
                <span>Loading Scene...</span>
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
