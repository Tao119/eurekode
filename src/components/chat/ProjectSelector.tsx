"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  status: string;
}

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function ProjectSelector({
  selectedProjectId,
  onProjectChange,
  disabled = false,
  className,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/projects?status=planning,in_progress&limit=50");
        const data = await response.json();
        if (data.success) {
          setProjects(data.data.items);
          // Set selected project if ID is provided
          if (selectedProjectId) {
            const found = data.data.items.find((p: Project) => p.id === selectedProjectId);
            setSelectedProject(found || null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [selectedProjectId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (project: Project | null) => {
      setSelectedProject(project);
      onProjectChange(project?.id || null);
      setIsOpen(false);
    },
    [onProjectChange]
  );

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all",
          selectedProject
            ? "border-primary/50 bg-primary/5 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/30",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "hover:bg-muted/50"
        )}
      >
        <span className="material-symbols-outlined text-base">
          {selectedProject ? "folder" : "folder_open"}
        </span>
        <span className="max-w-[120px] truncate">
          {selectedProject ? selectedProject.title : "プロジェクト"}
        </span>
        <span className="material-symbols-outlined text-sm">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg z-50">
          {/* No project option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
              !selectedProject ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/30"
            )}
          >
            <span className="material-symbols-outlined text-base">do_not_disturb_on</span>
            紐づけなし
          </button>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <span className="material-symbols-outlined animate-spin text-muted-foreground">
                progress_activity
              </span>
            </div>
          )}

          {/* Project list */}
          {!isLoading && projects.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              アクティブなプロジェクトがありません
            </div>
          )}

          {!isLoading &&
            projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  selectedProject?.id === project.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/30"
                )}
              >
                <span className="material-symbols-outlined text-base">folder</span>
                <span className="flex-1 truncate">{project.title}</span>
                {selectedProject?.id === project.id && (
                  <span className="material-symbols-outlined text-base text-primary">check</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
