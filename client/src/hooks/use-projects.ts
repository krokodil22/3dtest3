import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type errorSchemas } from "@shared/routes";
import type { InsertProject, Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useProjects() {
  return useQuery({
    queryKey: [api.projects.list.path],
    queryFn: async () => {
      const res = await fetch(api.projects.list.path);
      if (!res.ok) throw new Error("Не удалось загрузить проекты");
      return api.projects.list.responses[200].parse(await res.json());
    },
  });
}

export function useProject(id: number | null) {
  return useQuery({
    queryKey: [api.projects.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.projects.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Не удалось загрузить проект");
      return api.projects.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await fetch(api.projects.create.path, {
        method: api.projects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Ошибка валидации");
        }
        throw new Error("Не удалось создать проект");
      }
      return api.projects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({ title: "Проект создан", description: "Можно начинать работу со сценой." });
    },
    onError: (error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertProject>) => {
      const url = buildUrl(api.projects.update.path, { id });
      const res = await fetch(url, {
        method: api.projects.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Не удалось обновить проект");
      return api.projects.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, data.id] });
      toast({ title: "Сохранено", description: "Изменения проекта успешно сохранены." });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.projects.delete.path, { id });
      const res = await fetch(url, { method: api.projects.delete.method });
      if (!res.ok) throw new Error("Не удалось удалить проект");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({ title: "Удалено", description: "Проект удален." });
    },
  });
}
