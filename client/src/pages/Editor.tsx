import { Toolbar } from '@/components/Toolbar';
import { Viewport } from '@/components/Viewport';
import { Sidebar } from '@/components/Sidebar';
import { ProjectManager } from '@/components/ProjectManager';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

export default function Editor() {
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
