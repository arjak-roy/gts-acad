"use client";

import { createContext, useContext } from "react";
import type {
  LearningResourceContentType,
  LearningResourceFolderSummary,
  LearningResourceListPage,
  LearningResourceLookups,
  LearningResourceStatus,
  LearningResourceUploadConfig,
  LearningResourceVisibility,
} from "@/components/modules/course-builder/learning-resource-client";

// ─── Mode & Props ────────────────────────────────────────────────────────────

export type ResourceManagerMode = "browse" | "pick";

export type ContentSelectionMode = "LINK" | "COPY_LOCAL";

export type ResourceManagerPickResult = {
  resourceIds: string[];
  isRequired: boolean;
  contentSelectionMode: ContentSelectionMode;
};

export type ViewMode = "list" | "grid";

// ─── Folder Tree ─────────────────────────────────────────────────────────────

export type FolderTreeNode = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  pathLabel: string;
  children: FolderTreeNode[];
};

export function buildFolderTree(folders: LearningResourceFolderSummary[]): FolderTreeNode[] {
  const nodeMap = new Map<string, FolderTreeNode>();
  for (const f of folders) {
    nodeMap.set(f.id, { ...f, children: [] });
  }
  const roots: FolderTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

// ─── Filter State ────────────────────────────────────────────────────────────

export type ResourceFilterState = {
  search: string;
  status: LearningResourceStatus | "";
  visibility: LearningResourceVisibility | "";
  contentType: LearningResourceContentType | "";
  page: number;
  pageSize: number;
};

export const DEFAULT_FILTER_STATE: ResourceFilterState = {
  search: "",
  status: "",
  visibility: "",
  contentType: "",
  page: 1,
  pageSize: 30,
};

// ─── Upload State ────────────────────────────────────────────────────────────

export type UploadFileEntry = {
  id: string;
  file: File;
  title: string;
  status: "queued" | "uploading" | "complete" | "failed";
  progress: number;
  error?: string;
};

export type UploadState = {
  isUploading: boolean;
  files: UploadFileEntry[];
  completedCount: number;
  failedCount: number;
  totalCount: number;
};

export const EMPTY_UPLOAD_STATE: UploadState = {
  isUploading: false,
  files: [],
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
};

// ─── Context ─────────────────────────────────────────────────────────────────

export type ResourceManagerContextValue = {
  mode: ResourceManagerMode;
  lookups: LearningResourceLookups;
  folderTree: FolderTreeNode[];
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  filters: ResourceFilterState;
  setFilters: (filters: ResourceFilterState) => void;
  // Data
  resourcePage: LearningResourceListPage | null;
  isLoadingResources: boolean;
  refreshResources: () => void;
  refreshLookups: () => void;
  // Upload
  uploadState: UploadState;
  uploadConfig: LearningResourceUploadConfig | null;
  startUpload: (files: File[]) => void;
  // Selection (pick mode)
  selectedResourceIds: Set<string>;
  toggleResourceSelection: (id: string) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  disabledResourceIds: Set<string>;
  // Folder operations
  createFolder: (name: string, parentId: string | null) => Promise<boolean>;
  renameFolder: (folderId: string, name: string) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;
  moveResource: (resourceId: string, folderId: string | null) => Promise<boolean>;
  isMovingResource: boolean;
  // Inline folder create state
  inlineCreateParentId: string | null;
  setInlineCreateParentId: (id: string | null) => void;
  // Rename state
  renamingFolderId: string | null;
  setRenamingFolderId: (id: string | null) => void;
};

export const ResourceManagerContext = createContext<ResourceManagerContextValue | null>(null);

export function useResourceManager(): ResourceManagerContextValue {
  const ctx = useContext(ResourceManagerContext);
  if (!ctx) throw new Error("useResourceManager must be used within ResourceManager");
  return ctx;
}
