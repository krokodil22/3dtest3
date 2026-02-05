import { useState } from 'react';
import { useProjects, useCreateProject, useUpdateProject } from '@/hooks/use-projects';
import { useEditorStore } from '@/lib/store';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, Save, Loader2, Plus } from 'lucide-react';

export function ProjectManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  
  const elements = useEditorStore(state => state.elements);
  const loadScene = useEditorStore(state => state.loadScene);
  const resetScene = useEditorStore(state => state.resetScene);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    try {
      const result = await createProject.mutateAsync({
        name: newProjectName,
        elements: {}, // Start empty
      });
      setActiveProjectId(result.id);
      resetScene();
      setNewProjectName('');
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (activeProjectId) {
      updateProject.mutate({
        id: activeProjectId,
        elements,
      });
    } else {
      setIsOpen(true); // Open dialog to create/select
    }
  };

  const handleLoad = (project: any) => {
    setActiveProjectId(project.id);
    loadScene(project.elements as any);
    setIsOpen(false);
  };

  return (
    <>
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => setIsOpen(true)}
          className="shadow-lg"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Projects
        </Button>
        <Button 
          size="sm" 
          onClick={handleSave}
          disabled={updateProject.isPending}
          className="shadow-lg"
        >
          {updateProject.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Projects</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 my-2">
            <Input 
              placeholder="New project name..." 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={createProject.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <ScrollArea className="h-[300px] border rounded-md p-4 bg-muted/20">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : projects?.length === 0 ? (
               <div className="text-center text-muted-foreground p-4">
                 No projects yet. Create one!
               </div>
            ) : (
              <div className="space-y-2">
                {projects?.map((project) => (
                  <div 
                    key={project.id}
                    onClick={() => handleLoad(project)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors border border-transparent hover:border-border"
                  >
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
