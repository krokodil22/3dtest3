import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { useProjects, useCreateProject, useUpdateProject } from '@/hooks/use-projects';
import { useEditorStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FolderOpen, Loader2, Plus, Save, Upload } from 'lucide-react';
import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

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
  const addObjElement = useEditorStore(state => state.addObjElement);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buildExportScene = () => {
    const scene = new THREE.Scene();
    const elementObjects = new Map<string, THREE.Object3D>();

    Object.values(elements).forEach((element) => {
      let object: THREE.Object3D;
      const material = new THREE.MeshStandardMaterial({
        color: element.color,
        roughness: 0.3,
        metalness: 0.2,
      });

      switch (element.type) {
        case 'box':
          object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
          break;
        case 'sphere':
          object = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), material);
          break;
        case 'cylinder':
          object = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32), material);
          break;
        case 'torus':
          object = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 16, 100), material);
          break;
        case 'mesh': {
          if (!element.objData) return;
          const loader = new OBJLoader();
          object = loader.parse(element.objData);
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = material;
            }
          });
          break;
        }
        default:
          object = new THREE.Object3D();
      }

      object.name = element.name;
      object.position.set(...element.position);
      object.rotation.set(...element.rotation);
      object.scale.set(...element.scale);
      elementObjects.set(element.id, object);
    });

    elementObjects.forEach((object, id) => {
      const element = elements[id];
      if (element?.parentId && elementObjects.has(element.parentId)) {
        elementObjects.get(element.parentId)?.add(object);
      } else {
        scene.add(object);
      }
    });

    return scene;
  };

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

  const handleExportObj = () => {
    const exporter = new OBJExporter();
    const scene = buildExportScene();
    const objText = exporter.parse(scene);
    const blob = new Blob([objText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProjectId ? `project-${activeProjectId}` : 'scene'}.obj`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportObj = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text) return;
      const name = file.name.replace(/\.obj$/i, '') || 'Imported OBJ';
      addObjElement(name, text);
    };
    reader.readAsText(file);
    event.target.value = '';
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
        <Button
          size="sm"
          variant="secondary"
          onClick={handleExportObj}
          className="shadow-lg"
        >
          <Download className="w-4 h-4 mr-2" />
          Export OBJ
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          className="shadow-lg"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import OBJ
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".obj"
          className="hidden"
          onChange={handleImportObj}
        />
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
