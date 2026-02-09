import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore, type SceneElement } from '@/lib/store';
import {
  buildProjectExport,
  createStoredProject,
  getStoredProjects,
  importProjectExport,
  parseProjectExport,
  removeStoredProject,
  updateStoredProject,
  updateStoredProjectName,
  type StoredProject,
} from '@/lib/project-storage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileJson, FolderOpen, Menu, Plus, Save, Trash2, Upload } from 'lucide-react';
import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const formatRelativeTime = (timestamp: string, now: Date) => {
  const updatedAt = new Date(timestamp);
  const diffMs = now.getTime() - updatedAt.getTime();
  if (Number.isNaN(diffMs)) return 'только что';
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 60) return 'только что';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} дн назад`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} нед назад`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} мес назад`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} г назад`;
};

export function ProjectManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [projectName, setProjectName] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [now, setNow] = useState(() => new Date());
  
  const elements = useEditorStore(state => state.elements);
  const loadScene = useEditorStore(state => state.loadScene);
  const resetScene = useEditorStore(state => state.resetScene);
  const addObjElement = useEditorStore(state => state.addObjElement);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const elementsRef = useRef(elements);
  const activeProjectIdRef = useRef(activeProjectId);
  const { toast } = useToast();

  useEffect(() => {
    const project = createStoredProject('Новый проект', {});
    setActiveProjectId(project.id);
    setProjects(getStoredProjects());
    resetScene();
    setAutoSaveEnabled(false);
  }, [resetScene]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    setProjectName(activeProject?.name ?? '');
  }, [activeProject?.name]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeProjectId || !autoSaveEnabled) return;
    const interval = window.setInterval(() => {
      const id = activeProjectIdRef.current;
      if (!id) return;
      const updated = updateStoredProject(id, elementsRef.current);
      if (updated) {
        setProjects(getStoredProjects());
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [activeProjectId, autoSaveEnabled]);

  useEffect(() => {
    if (!activeProjectId || autoSaveEnabled) return;
    if (Object.keys(elements).length === 0) return;
    setAutoSaveEnabled(true);
    const updated = updateStoredProject(activeProjectId, elements);
    if (updated) {
      setProjects(getStoredProjects());
    }
  }, [activeProjectId, autoSaveEnabled, elements]);

  const buildExportScene = () => {
    const scene = new THREE.Scene();
    const rootKey = '__root__';
    const orderedElements = Object.values(elements).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const childrenByParent = new Map<string, SceneElement[]>();

    orderedElements.forEach((element) => {
      const key = element.parentId ?? rootKey;
      if (!childrenByParent.has(key)) {
        childrenByParent.set(key, []);
      }
      childrenByParent.get(key)?.push(element);
    });

    const buildObjectForElement = (element: SceneElement) => {
      let object: THREE.Object3D;
      const material = new THREE.MeshStandardMaterial({
        color: element.color,
        roughness: 0.3,
        metalness: 0.2,
      });

      switch (element.type) {
        case 'box':
          if (element.cornerRadius && element.cornerRadius > 0) {
            const radius = Math.max(0, Math.min(element.cornerRadius, 0.5));
            object = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 2, radius), material);
          } else {
            object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
          }
          break;
        case 'sphere':
          object = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), material);
          break;
        case 'cylinder':
          object = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32), material);
          break;
        case 'torus':
          object = new THREE.Mesh(
            new THREE.TorusGeometry(
              0.5,
              Math.max(0.05, Math.min(element.torusThickness ?? 0.3, 0.95)),
              16,
              100
            ),
            material
          );
          break;
        case 'cone':
          object = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 32), material);
          break;
        case 'pyramid':
          object = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 4), material);
          break;
        case 'mesh': {
          if (!element.objData) {
            object = new THREE.Group();
            break;
          }
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
        case 'group':
        case 'subtraction':
        default:
          object = new THREE.Group();
      }

      object.name = element.name;
      object.position.set(...element.position);
      object.rotation.set(...element.rotation);
      object.scale.set(...element.scale);

      const childElements = childrenByParent.get(element.id) ?? [];
      childElements.forEach((child) => {
        object.add(buildObjectForElement(child));
      });

      return object;
    };

    const rootElements = childrenByParent.get(rootKey) ?? [];
    rootElements.forEach((element) => {
      scene.add(buildObjectForElement(element));
    });

    scene.updateMatrixWorld(true);
    return scene;
  };

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = createStoredProject(newProjectName, {});
      setActiveProjectId(project.id);
      setProjects(getStoredProjects());
      resetScene();
      setAutoSaveEnabled(false);
      setNewProjectName('');
      setIsOpen(false);
      toast({ title: 'Проект создан', description: 'Сохранен в кэше браузера.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка', description: 'Не удалось создать проект.', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (activeProjectId) {
      const updated = updateStoredProject(activeProjectId, elements);
      if (updated) {
        setProjects(getStoredProjects());
        toast({ title: 'Сохранено', description: 'Проект обновлен в кэше браузера.' });
      } else {
        toast({ title: 'Ошибка', description: 'Проект не найден.', variant: 'destructive' });
      }
    } else {
      setIsOpen(true); // Open dialog to create/select
    }
  };

  const handleDeleteProject = (project: StoredProject) => {
    const shouldDelete = window.confirm(`Удалить проект "${project.name}"?`);
    if (!shouldDelete) return;
    const removed = removeStoredProject(project.id);
    if (!removed) {
      toast({ title: 'Ошибка', description: 'Проект не найден.', variant: 'destructive' });
      return;
    }
    const nextProjects = getStoredProjects();
    setProjects(nextProjects);
    if (activeProjectId === project.id) {
      setActiveProjectId(null);
      resetScene();
      setAutoSaveEnabled(false);
    }
    toast({ title: 'Проект удален', description: 'Проект удален из кэша браузера.' });
  };

  const handleLoad = (project: StoredProject) => {
    if (activeProjectId && activeProjectId !== project.id) {
      const updated = updateStoredProject(activeProjectId, elements);
      if (updated) {
        setProjects(getStoredProjects());
      }
    }
    setActiveProjectId(project.id);
    loadScene(project.elements);
    setAutoSaveEnabled(Object.keys(project.elements).length > 0);
    setIsOpen(false);
  };

  const handleProjectNameCommit = () => {
    if (!activeProjectId) return;
    const updated = updateStoredProjectName(activeProjectId, projectName);
    if (updated) {
      setProjects(getStoredProjects());
    }
  };

  const handleProjectNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
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

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const filename = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text) return;
      if (filename.endsWith('.obj')) {
        const name = file.name.replace(/\.obj$/i, '') || 'Импорт OBJ';
        addObjElement(name, text);
        return;
      }
      if (filename.endsWith('.json')) {
        try {
          const parsed = parseProjectExport(text);
          const project = importProjectExport(parsed);
          setProjects(getStoredProjects());
          setActiveProjectId(project.id);
          loadScene(project.elements);
          setAutoSaveEnabled(Object.keys(project.elements).length > 0);
          toast({
            title: 'Проект импортирован',
            description: 'Данные загружены и сохранены в кэше браузера.',
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Не удалось импортировать проект';
          toast({ title: 'Ошибка', description: message, variant: 'destructive' });
        }
        return;
      }
      toast({
        title: 'Ошибка',
        description: 'Поддерживаются только файлы JSON или OBJ.',
        variant: 'destructive',
      });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportJson = () => {
    const exportPayload = buildProjectExport({
      name: activeProject?.name ?? 'Сцена',
      elements,
      createdAt: activeProject?.createdAt,
      updatedAt: activeProject?.updatedAt,
    });
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject?.name ?? 'scene'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lastSavedLabel = useMemo(() => {
    if (!activeProject?.updatedAt) return null;
    return `Последнее сохранение: ${formatRelativeTime(activeProject.updatedAt, now)}`;
  }, [activeProject?.updatedAt, now]);

  return (
    <>
      <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-2">
        {activeProject ? (
          <Input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            onBlur={handleProjectNameCommit}
            onKeyDown={handleProjectNameKeyDown}
            className="h-9 w-48 bg-background/80 shadow-lg"
            aria-label="Название проекта"
          />
        ) : null}
        {activeProject && lastSavedLabel ? (
          <span className="rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-lg">
            {lastSavedLabel}
          </span>
        ) : null}
        <Button 
          size="sm" 
          onClick={handleSave}
          className="shadow-lg"
        >
          <Save className="w-4 h-4 mr-2" />
          Сохранить
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="shadow-lg"
              aria-label="Меню проектов"
            >
              <Menu className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsOpen(true)}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Проекты
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJson}>
              <FileJson className="w-4 h-4 mr-2" />
              Экспорт JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportObj}>
              <Download className="w-4 h-4 mr-2" />
              Экспорт OBJ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Импорт
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={importInputRef}
          type="file"
          accept=".obj,application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Проекты</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 my-2">
            <Input 
              placeholder="Название проекта..." 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <ScrollArea className="h-[300px] border rounded-md p-4 bg-muted/20">
            {projects.length === 0 ? (
               <div className="text-center text-muted-foreground p-4">
                 Проектов пока нет. Создайте первый!
               </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    onClick={() => handleLoad(project)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{project.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteProject(project);
                      }}
                      aria-label={`Удалить проект ${project.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
