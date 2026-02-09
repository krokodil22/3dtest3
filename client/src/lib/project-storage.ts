import { v4 as uuidv4 } from 'uuid';
import type { SceneElement } from '@/lib/store';

export type StoredProject = {
  id: string;
  name: string;
  elements: Record<string, SceneElement>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectExport = {
  version: 1;
  name: string;
  elements: Record<string, SceneElement>;
  createdAt?: string;
  updatedAt?: string;
};

const STORAGE_KEY = 'three-projects-cache-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeProject = (value: unknown): StoredProject | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (!isRecord(value.elements)) return null;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null;

  return {
    id: value.id,
    name: value.name,
    elements: value.elements as Record<string, SceneElement>,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const readProjects = (): StoredProject[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeProject).filter((project): project is StoredProject => !!project);
  } catch {
    return [];
  }
};

const writeProjects = (projects: StoredProject[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getStoredProjects = () =>
  readProjects().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const createStoredProject = (
  name: string,
  elements: Record<string, SceneElement>
): StoredProject => {
  const now = new Date().toISOString();
  const project: StoredProject = {
    id: uuidv4(),
    name: name.trim() || 'Безымянный проект',
    elements,
    createdAt: now,
    updatedAt: now,
  };
  const projects = readProjects();
  writeProjects([...projects, project]);
  return project;
};

export const updateStoredProject = (
  id: string,
  elements: Record<string, SceneElement>
): StoredProject | null => {
  const projects = readProjects();
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;

  const updated: StoredProject = {
    ...projects[index],
    elements,
    updatedAt: new Date().toISOString(),
  };
  const next = [...projects];
  next[index] = updated;
  writeProjects(next);
  return updated;
};

export const updateStoredProjectName = (id: string, name: string): StoredProject | null => {
  const projects = readProjects();
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;

  const updated: StoredProject = {
    ...projects[index],
    name: name.trim() || 'Безымянный проект',
    updatedAt: new Date().toISOString(),
  };
  const next = [...projects];
  next[index] = updated;
  writeProjects(next);
  return updated;
};

export const removeStoredProject = (id: string): boolean => {
  const projects = readProjects();
  const next = projects.filter((project) => project.id !== id);
  if (next.length === projects.length) return false;
  writeProjects(next);
  return true;
};

export const buildProjectExport = (project: {
  name: string;
  elements: Record<string, SceneElement>;
  createdAt?: string;
  updatedAt?: string;
}): ProjectExport => ({
  version: 1,
  name: project.name,
  elements: project.elements,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

export const parseProjectExport = (payload: string): ProjectExport => {
  const parsed = JSON.parse(payload);
  if (!isRecord(parsed)) {
    throw new Error('Неверный формат JSON');
  }
  if (parsed.version !== 1) {
    throw new Error('Неподдерживаемая версия проекта');
  }
  if (typeof parsed.name !== 'string' || !isRecord(parsed.elements)) {
    throw new Error('В файле не хватает данных проекта');
  }

  return {
    version: 1,
    name: parsed.name,
    elements: parsed.elements as Record<string, SceneElement>,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
  };
};

export const importProjectExport = (exported: ProjectExport): StoredProject => {
  const now = new Date().toISOString();
  const project: StoredProject = {
    id: uuidv4(),
    name: exported.name,
    elements: exported.elements,
    createdAt: exported.createdAt ?? now,
    updatedAt: exported.updatedAt ?? now,
  };
  const projects = readProjects();
  writeProjects([...projects, project]);
  return project;
};
