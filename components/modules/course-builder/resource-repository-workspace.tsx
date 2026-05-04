"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, FolderPlus, Loader2, PencilLine, Search, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { AddContentSheet } from "@/components/modules/course-builder/add-content-sheet";
import { CourseContentDetailSheet } from "@/components/modules/course-builder/course-content-detail-sheet";
import {
  CourseContentTab,
  type CourseContentMoveTarget,
  type CourseContentItem,
  type LinkedRepositoryResourceSummary,
} from "@/components/modules/course-builder/course-content-tab";
import { EditContentSheet } from "@/components/modules/course-builder/edit-content-sheet";
import {
  type LearningResourceFolderSummary,
  type LearningResourceListItem,
  type LearningResourceListPage,
  type LearningResourceLookups,
} from "@/components/modules/course-builder/learning-resource-client";
import { LearningResourceAssignmentsSheet } from "@/components/modules/course-builder/learning-resource-assignments-sheet";
import { LearningResourceDetailSheet } from "@/components/modules/course-builder/learning-resource-detail-sheet";
import { LearningResourceFolderSheet } from "@/components/modules/course-builder/learning-resource-folder-sheet";
import { LearningResourceFormSheet } from "@/components/modules/course-builder/learning-resource-form-sheet";
import { LearningResourceHistorySheet } from "@/components/modules/course-builder/learning-resource-history-sheet";
import { ResourceRepositoryPageSkeleton } from "@/components/modules/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RESOURCE_REPOSITORY_ROUTE } from "@/lib/constants/resource-repository";
import { useRbac } from "@/lib/rbac-context";
import { cn } from "@/lib/utils";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type FolderOption = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  pathLabel: string;
};

type ContentFolderOption = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  contentCount: number;
  createdAt: string;
};

const REPOSITORY_ROOT_SELECTION_ID = "__repository_root__";

type RepositorySelection =
  | {
      kind: "root";
    }
  | {
      kind: "folder";
      folderId: string;
    };

type ExplorerFolderNode = {
  folder: FolderOption;
  rootContents: CourseContentItem[];
};

type ResourceSheetTarget = {
  id: string;
  title: string;
};

const explorerQueryKeys = {
  course: "course",
  folder: "folder",
};

function toggleId(current: string[], nextId: string) {
  return current.includes(nextId)
    ? current.filter((value) => value !== nextId)
    : [...current, nextId];
}

function sortFolders(left: FolderOption, right: FolderOption) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name);
}

function sortContentFolders(left: ContentFolderOption, right: ContentFolderOption) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name);
}

async function readApiData<T>(response: Response, errorMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || errorMessage);
  }

  return payload?.data as T;
}

function matchesSearch(value: string | null | undefined, search: string) {
  if (!search) {
    return true;
  }

  return (value ?? "").toLowerCase().includes(search);
}

function deriveCoursesFromContent(contents: CourseContentItem[]): CourseOption[] {
  return Array.from(
    contents.reduce((map, content) => {
      if (!map.has(content.courseId)) {
        map.set(content.courseId, {
          id: content.courseId,
          name: content.courseName,
          isActive: true,
        });
      }

      return map;
    }, new Map<string, CourseOption>()).values(),
  ).sort((left, right) => left.name.localeCompare(right.name));
}

export function ResourceRepositoryWorkspace({ lookups }: { lookups: LearningResourceLookups }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, isLoading: isLoadingPermissions } = useRbac();

  const canViewContent = can("course_content.view");
  const canCreateContent = can("course_content.create");
  const canEditContent = can("course_content.edit");
  const canDeleteContent = can("course_content.delete");
  const canCreateResources = can("learning_resources.create");
  const canViewResources = can("learning_resources.view");
  const canEditResources = can("learning_resources.edit");
  const canDeleteResources = can("learning_resources.delete");
  const canAssignResources = can("learning_resources.assign");
  const canBackfillResources = canCreateContent || canEditContent || canCreateResources || canEditResources;

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [contentFolders, setContentFolders] = useState<ContentFolderOption[]>([]);
  const [contents, setContents] = useState<CourseContentItem[]>([]);
  const [assignedContents, setAssignedContents] = useState<CourseContentItem[]>([]);
  const [resources, setResources] = useState<LearningResourceListItem[]>([]);
  const [selection, setSelection] = useState<RepositorySelection | null>(null);
  const [isRootExpanded, setIsRootExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(true);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);
  const [resourceRefreshToken, setResourceRefreshToken] = useState(0);
  const [syncSignature, setSyncSignature] = useState("");
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderOption | null>(null);
  const [folderPendingDelete, setFolderPendingDelete] = useState<FolderOption | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [viewingContentId, setViewingContentId] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentPendingDelete, setContentPendingDelete] = useState<CourseContentItem | null>(null);
  const [isDeletingContent, setIsDeletingContent] = useState(false);
  const [movingContentId, setMovingContentId] = useState<string | null>(null);
  const [draggingContentId, setDraggingContentId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [viewingRepositoryResourceId, setViewingRepositoryResourceId] = useState<string | null>(null);
  const [editingRepositoryResourceId, setEditingRepositoryResourceId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ResourceSheetTarget | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<ResourceSheetTarget | null>(null);

  const searchValue = searchParams.toString();
  const normalizedExplorerSearch = explorerSearch.trim().toLowerCase();
  const normalizedContentSearch = contentSearch.trim().toLowerCase();
  const isSearchActive = normalizedExplorerSearch.length > 0;
  const isContentSearchActive = normalizedContentSearch.length > 0;

  useEffect(() => {
    if (isLoadingPermissions) {
      return;
    }

    if (!canViewContent) {
      setCourses([]);
      setFolders([]);
      setContents([]);
      setAssignedContents([]);
      setResources([]);
      setIsLoadingExplorer(false);
      return;
    }

    let active = true;

    const loadExplorer = async () => {
      setIsLoadingExplorer(true);

      try {
        const [courseResponse, repositoryFolderResponse, contentFolderResponse, contentResponse, assignedContentResponse, resourceResponse] = await Promise.all([
          fetch("/api/courses", { cache: "no-store" }),
          canViewResources ? fetch("/api/learning-resources/folders", { cache: "no-store" }) : Promise.resolve(null),
          fetch("/api/course-content-folders", { cache: "no-store" }),
          fetch("/api/course-content", { cache: "no-store" }),
          fetch("/api/course-content/shared", { cache: "no-store" }),
          canViewResources ? fetch("/api/learning-resources?page=1&pageSize=200", { cache: "no-store" }) : Promise.resolve(null),
        ]);

        const nextContents = await readApiData<CourseContentItem[]>(contentResponse, "Failed to load repository content.");
        const nextAssignedContents = await readApiData<CourseContentItem[]>(assignedContentResponse, "Failed to load assigned course content.");
        let nextCourses = deriveCoursesFromContent([...nextContents, ...nextAssignedContents]);

        if (courseResponse.ok) {
          const fetchedCourses = await readApiData<CourseOption[]>(courseResponse, "Failed to load courses.");
          const merged = new Map(nextCourses.map((course) => [course.id, course]));

          for (const course of fetchedCourses) {
            merged.set(course.id, course);
          }

          nextCourses = Array.from(merged.values())
            .filter((course) => course.isActive)
            .sort((left, right) => left.name.localeCompare(right.name));
        }

        let nextFolders: FolderOption[] = [];
        if (repositoryFolderResponse) {
          nextFolders = await readApiData<LearningResourceFolderSummary[]>(repositoryFolderResponse, "Failed to load repository folders.");
        }

        let nextContentFolders: ContentFolderOption[] = [];
        if (contentFolderResponse.ok) {
          nextContentFolders = await readApiData<ContentFolderOption[]>(contentFolderResponse, "Failed to load content folders.");
        }

        let nextResources: LearningResourceListItem[] = [];
        if (resourceResponse) {
          const firstPage = await readApiData<LearningResourceListPage>(resourceResponse, "Failed to load repository resources.");
          nextResources = [...firstPage.items];

          if (firstPage.totalPages > 1) {
            const remainingPageResponses = await Promise.all(
              Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
                fetch(`/api/learning-resources?page=${index + 2}&pageSize=${firstPage.pageSize}`, { cache: "no-store" }),
              ),
            );

            const remainingPages = await Promise.all(
              remainingPageResponses.map((response) =>
                readApiData<LearningResourceListPage>(response, "Failed to load repository resources."),
              ),
            );

            for (const pageData of remainingPages) {
              nextResources.push(...pageData.items);
            }
          }
        }

        if (!active) {
          return;
        }

        setCourses(nextCourses);
        setFolders(nextFolders);
        setContentFolders(nextContentFolders);
        setContents(nextContents);
        setAssignedContents(nextAssignedContents);
        setResources(nextResources);
      } catch (error) {
        if (!active) {
          return;
        }

        toast.error(error instanceof Error ? error.message : "Failed to load the repository workspace.");
      } finally {
        if (active) {
          setIsLoadingExplorer(false);
        }
      }
    };

    void loadExplorer();

    return () => {
      active = false;
    };
  }, [canViewContent, canViewResources, isLoadingPermissions, resourceRefreshToken, workspaceRefreshToken]);

  useEffect(() => {
    if (isLoadingPermissions || isLoadingExplorer || selectionInitialized) {
      return;
    }

    if (canViewContent) {
      const params = new URLSearchParams(searchValue);
      const queryFolderId = params.get(explorerQueryKeys.folder) ?? "";
      const initialFolderId = folders.find((folder) => folder.id === queryFolderId)?.id ?? null;

      if (queryFolderId === REPOSITORY_ROOT_SELECTION_ID) {
        setSelection({ kind: "root" });
      } else if (initialFolderId) {
        setSelection({ kind: "folder", folderId: initialFolderId });
        setExpandedFolders((current) => (current.includes(initialFolderId) ? current : [...current, initialFolderId]));
      } else {
        setSelection({ kind: "root" });
      }
    } else {
      setSelection(null);
    }

    setSelectionInitialized(true);
  }, [canViewContent, courses, folders, isLoadingExplorer, isLoadingPermissions, searchValue, selectionInitialized]);

  useEffect(() => {
    if (!selectionInitialized || !selection) {
      return;
    }

    if (selection.kind === "folder" && !folders.some((folder) => folder.id === selection.folderId)) {
      setSelection({ kind: "root" });
    }
  }, [courses, folders, selection, selectionInitialized]);

  useEffect(() => {
    if (!selectionInitialized) {
      return;
    }

    const params = new URLSearchParams(searchValue);
    params.delete(explorerQueryKeys.course);
    params.delete(explorerQueryKeys.folder);

    if (selection?.kind === "root") {
      params.set(explorerQueryKeys.folder, REPOSITORY_ROOT_SELECTION_ID);
    } else if (selection?.kind === "folder") {
      params.set(explorerQueryKeys.folder, selection.folderId);
    }

    const nextQuery = params.toString();
    if (nextQuery === searchValue) {
      return;
    }

    router.replace(nextQuery ? `${pathname || RESOURCE_REPOSITORY_ROUTE}?${nextQuery}` : (pathname || RESOURCE_REPOSITORY_ROUTE), { scroll: false });
  }, [pathname, router, searchValue, selection, selectionInitialized]);

  const isRootSelected = selection?.kind === "root";
  const selectedFolderId = selection?.kind === "folder" ? selection.folderId : "";
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const selectedFolderName = selectedFolder?.pathLabel ?? selectedFolder?.name ?? null;
  const repositoryCourseId = contents[0]?.courseId
    ?? assignedContents[0]?.courseId
    ?? courses[0]?.id
    ?? "";
  const canCreateRepositoryFolder = canCreateResources;
  const canUploadToSelection = canCreateContent && Boolean(repositoryCourseId) && (Boolean(selectedFolder) || isRootSelected);
  const folderPendingDeleteContentCount = useMemo(
    () => folderPendingDelete
      ? resources.filter((resource) => resource.folderId === folderPendingDelete.id).length
      : 0,
    [folderPendingDelete, resources],
  );
  const folderPendingDeleteChildCount = useMemo(
    () => folderPendingDelete
      ? folders.filter((folder) => folder.parentId === folderPendingDelete.id).length
      : 0,
    [folderPendingDelete, folders],
  );
  const allContents = useMemo(() => [...contents, ...assignedContents], [assignedContents, contents]);
  const currentLookups = useMemo<LearningResourceLookups>(
    () => ({ ...lookups, folders }),
    [folders, lookups],
  );

  const linkedResourcesByContentId = useMemo<Record<string, LinkedRepositoryResourceSummary>>(() => {
    return resources.reduce<Record<string, LinkedRepositoryResourceSummary>>((map, resource) => {
      if (!resource.sourceContentId) {
        return map;
      }

      map[resource.sourceContentId] = {
        id: resource.id,
        sourceContentId: resource.sourceContentId,
        folderId: resource.folderId,
        status: resource.status,
        tagNames: resource.tagNames,
        currentVersionNumber: resource.currentVersionNumber,
        assignmentCount: resource.assignmentCount,
      };
      return map;
    }, {});
  }, [resources]);
  const moveTargets = useMemo<CourseContentMoveTarget[]>(
    () => folders.map((folder) => ({ id: folder.id, courseId: null, name: folder.pathLabel })),
    [folders],
  );

  useEffect(() => {
    if (isLoadingPermissions || isLoadingExplorer || !canViewContent || !canBackfillResources) {
      return;
    }

    const missingIds = contents
      .filter((content) => !linkedResourcesByContentId[content.id])
      .map((content) => content.id)
      .sort();

    if (missingIds.length === 0) {
      if (syncSignature) {
        setSyncSignature("");
      }
      return;
    }

    const nextSignature = missingIds.join(",");
    if (nextSignature === syncSignature) {
      return;
    }

    let active = true;
    setSyncSignature(nextSignature);

    const backfill = async () => {
      try {
        const response = await fetch("/api/learning-resources/sync-content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contentIds: missingIds }),
        });

        await readApiData<{ count: number }>(response, "Failed to sync repository items.");
        if (active) {
          setResourceRefreshToken((current) => current + 1);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        toast.error(error instanceof Error ? error.message : "Failed to sync repository items.");
      }
    };

    void backfill();

    return () => {
      active = false;
    };
  }, [canBackfillResources, canViewContent, contents, isLoadingExplorer, isLoadingPermissions, linkedResourcesByContentId, syncSignature]);

  const explorerFolders = useMemo<ExplorerFolderNode[]>(() => {
    return [...folders]
      .sort(sortFolders)
      .map((folder) => ({
        folder,
        rootContents: allContents.filter((content) => linkedResourcesByContentId[content.id]?.folderId === folder.id),
      }));
  }, [allContents, folders, linkedResourcesByContentId]);

  const repositoryRootContents = useMemo(() => {
    return allContents
      .filter((content) => !linkedResourcesByContentId[content.id]?.folderId)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [allContents, linkedResourcesByContentId]);

  const visibleContents = useMemo(() => {
    let base: CourseContentItem[];
    if (selectedFolderId) {
      base = allContents.filter((content) => linkedResourcesByContentId[content.id]?.folderId === selectedFolderId);
    } else if (isRootSelected) {
      base = repositoryRootContents;
    } else {
      return [];
    }

    if (!normalizedContentSearch) return base;

    return base.filter((content) =>
      content.title.toLowerCase().includes(normalizedContentSearch)
      || (content.fileName ?? "").toLowerCase().includes(normalizedContentSearch)
      || (content.contentType ?? "").toLowerCase().includes(normalizedContentSearch)
      || (content.excerpt ?? "").toLowerCase().includes(normalizedContentSearch)
      || (content.description ?? "").toLowerCase().includes(normalizedContentSearch)
    );
  }, [allContents, isRootSelected, linkedResourcesByContentId, normalizedContentSearch, repositoryRootContents, selectedFolderId]);
  const selectedLocationLabel = selectedFolder?.pathLabel ?? "Repository Root";
  const selectedLocationPath = selectedFolder
    ? `Repository / ${selectedFolder.pathLabel}`
    : "Repository / Root";
  const selectedChildFolderCount = useMemo(
    () => folders.filter((folder) => folder.parentId === (selectedFolderId || null)).length,
    [folders, selectedFolderId],
  );
  const explorerStats = [
    { label: "Folders", value: folders.length },
    { label: "Root Files", value: repositoryRootContents.length },
    { label: "Reusable", value: resources.length },
  ];

  const editingContent = useMemo(
    () => contents.find((content) => content.id === editingContentId) ?? null,
    [contents, editingContentId],
  );
  const editingContentCourseId = editingContent?.courseId ?? repositoryCourseId;
  const editingContentFolders = useMemo(
    () => contentFolders.filter((folder) => folder.courseId === editingContentCourseId).sort(sortContentFolders),
    [contentFolders, editingContentCourseId],
  );
  const draggingContent = useMemo(
    () => contents.find((content) => content.id === draggingContentId) ?? null,
    [contents, draggingContentId],
  );

  const filteredExplorerFolders = useMemo(() => {
    return explorerFolders
      .filter((entry) => {
        if (!normalizedExplorerSearch) {
          return true;
        }

        return matchesSearch(entry.folder.name, normalizedExplorerSearch)
          || entry.rootContents.some((content) => matchesSearch(content.title, normalizedExplorerSearch) || matchesSearch(content.fileName, normalizedExplorerSearch));
      })
      .map((entry) => {
        if (!normalizedExplorerSearch || matchesSearch(entry.folder.name, normalizedExplorerSearch)) {
          return entry;
        }

        return {
          ...entry,
          rootContents: entry.rootContents.filter((content) => matchesSearch(content.title, normalizedExplorerSearch) || matchesSearch(content.fileName, normalizedExplorerSearch)),
        };
      });
  }, [explorerFolders, normalizedExplorerSearch]);

  const filteredRepositoryRootContents = useMemo(() => {
    if (!normalizedExplorerSearch) {
      return repositoryRootContents;
    }

    return repositoryRootContents.filter((content) => matchesSearch(content.title, normalizedExplorerSearch) || matchesSearch(content.fileName, normalizedExplorerSearch));
  }, [normalizedExplorerSearch, repositoryRootContents]);

  const handleSelectFolder = (folderId: string) => {
    setSelection({ kind: "folder", folderId });
    setExpandedFolders((current) => (current.includes(folderId) ? current : [...current, folderId]));
    setContentSearch("");
  };

  const handleSelectRoot = () => {
    setSelection({ kind: "root" });
    setContentSearch("");
  };

  const handleRepositoryResourcesChanged = () => {
    setResourceRefreshToken((current) => current + 1);
    setWorkspaceRefreshToken((current) => current + 1);
  };

  const handleMoveContent = async (content: CourseContentItem, targetFolderId: string | null) => {
    if (movingContentId) {
      return;
    }

    if (content.isSharedAssignment) {
      toast.error("Assigned repository items cannot be moved from this workspace.");
      return;
    }

    const linkedResource = linkedResourcesByContentId[content.id] ?? null;
    const resourceId = linkedResource?.id ?? content.resourceId ?? null;

    if (!resourceId) {
      toast.error("This repository item is still syncing. Try again in a moment.");
      return;
    }

    if ((linkedResource?.folderId ?? null) === targetFolderId) {
      return;
    }

    const targetFolder = targetFolderId ? folders.find((folder) => folder.id === targetFolderId) ?? null : null;

    if (targetFolderId && !targetFolder) {
      toast.error("The target folder could not be found.");
      return;
    }

    setMovingContentId(content.id);

    try {
      const response = await fetch(`/api/learning-resources/${resourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId: targetFolderId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to move repository item.");
      }

      if (targetFolder) {
        setExpandedFolders((current) => (current.includes(targetFolder.id) ? current : [...current, targetFolder.id]));
      }

      setDragOverFolderId(null);
      toast.success(targetFolder ? `Moved to ${targetFolder.name}.` : "Moved to Repository Root.");
      handleRepositoryResourcesChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move repository item.");
    } finally {
      setMovingContentId(null);
    }
  };

  const handleDeleteContent = async () => {
    if (!contentPendingDelete) {
      return;
    }

    setIsDeletingContent(true);
    const linkedResourceId = linkedResourcesByContentId[contentPendingDelete.id]?.id ?? null;

    try {
      const response = await fetch(`/api/course-content/${contentPendingDelete.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete content.");
      }

      toast.success("Repository item deleted.");
      setViewingContentId((current) => (current === contentPendingDelete.id ? null : current));
      setEditingContentId((current) => (current === contentPendingDelete.id ? null : current));
      setViewingRepositoryResourceId((current) => (linkedResourceId && current === linkedResourceId ? null : current));
      setEditingRepositoryResourceId((current) => (linkedResourceId && current === linkedResourceId ? null : current));
      setHistoryTarget((current) => (linkedResourceId && current?.id === linkedResourceId ? null : current));
      setAssignmentTarget((current) => (linkedResourceId && current?.id === linkedResourceId ? null : current));
      setContentPendingDelete(null);
      handleRepositoryResourcesChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete repository item.");
    } finally {
      setIsDeletingContent(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderPendingDelete) {
      return;
    }

    if (folderPendingDeleteContentCount > 0) {
      toast.error("Move or delete the folder contents before deleting the folder.");
      return;
    }

    if (folderPendingDeleteChildCount > 0) {
      toast.error("Move or delete child folders before deleting this folder.");
      return;
    }

    const deletedFolderId = folderPendingDelete.id;
    const wasEditingDeletedFolder = editingFolder?.id === deletedFolderId;

    setIsDeletingFolder(true);

    try {
      const response = await fetch(`/api/learning-resources/folders/${deletedFolderId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete folder.");
      }

      toast.success("Folder deleted.");
      setSelection((current) => (current?.kind === "folder" && current.folderId === deletedFolderId ? { kind: "root" } : current));
      setExpandedFolders((current) => current.filter((folderId) => folderId !== deletedFolderId));
      setEditingFolder((current) => (current?.id === deletedFolderId ? null : current));
      if (wasEditingDeletedFolder) {
        setAddFolderOpen(false);
      }
      setFolderPendingDelete(null);
      setWorkspaceRefreshToken((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder.");
    } finally {
      setIsDeletingFolder(false);
    }
  };

  if (isLoadingExplorer || isLoadingPermissions || (canViewContent && !selectionInitialized)) {
    return <ResourceRepositoryPageSkeleton />;
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Repository Explorer</CardTitle>
                  <CardDescription>
                    Browse repository root items and your global repository folders. Course names stay hidden here so the repository stays canonical and reusable.
                  </CardDescription>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleSelectRoot} className="shrink-0">
                  Open Root
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {explorerStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{stat.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Search explorer</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={explorerSearch}
                    onChange={(event) => setExplorerSearch(event.target.value)}
                    className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 pl-9 text-sm text-slate-900"
                    placeholder="Search folders or files"
                  />
                </div>
                {isSearchActive ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExplorerSearch("")}>Clear</Button>
                ) : null}
              </div>
            </div>

            {!canViewContent ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500">
                The repository explorer is hidden for the current role.
              </div>
            ) : (
              <div className="space-y-3">
                {!isSearchActive || filteredRepositoryRootContents.length > 0 || isRootSelected ? (
                  <div className={cn(
                    "rounded-2xl border border-slate-200 bg-white",
                    isRootSelected ? "border-primary/40 bg-primary/[0.05]" : null,
                  )}>
                    <div className="flex items-center gap-1 px-1 py-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        onClick={() => setIsRootExpanded((current) => !current)}
                        aria-label={isSearchActive || isRootExpanded ? "Collapse repository root" : "Expand repository root"}
                      >
                        {isSearchActive || isRootExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50"
                        onClick={handleSelectRoot}
                      >
                        <Folder className="h-4 w-4 text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">Repository Root</p>
                          <p className="truncate text-[11px] text-slate-500">Unfiled repository items live here until they are moved into global folders.</p>
                        </div>
                        <Badge variant="accent" className="ml-auto shrink-0">{filteredRepositoryRootContents.length}</Badge>
                      </button>
                    </div>

                    {isSearchActive || isRootExpanded ? (
                      <div className="space-y-1 pb-2 pl-10 pr-2">
                        {filteredRepositoryRootContents.map((content) => (
                          <button
                            key={content.isSharedAssignment ? `${content.id}-shared` : content.id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50"
                            onClick={() => {
                              handleSelectRoot();
                              const linkedResourceId = linkedResourcesByContentId[content.id]?.id;
                              if (linkedResourceId && canViewResources) {
                                setViewingRepositoryResourceId(linkedResourceId);
                              } else {
                                setViewingContentId(content.id);
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="truncate">{content.title}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {filteredExplorerFolders.map((entry) => {
                  const folderExpanded = isSearchActive || expandedFolders.includes(entry.folder.id);
                  const isFolderSelected = selection?.kind === "folder" && selection.folderId === entry.folder.id;
                  const canAcceptDraggedContent = Boolean(
                    draggingContent
                    && !draggingContent.isSharedAssignment
                    && linkedResourcesByContentId[draggingContent.id]?.folderId !== entry.folder.id,
                  );
                  const isDropTargetActive = dragOverFolderId === entry.folder.id;

                  return (
                    <div key={entry.folder.id} className={cn(
                      "rounded-2xl border border-slate-200 bg-white",
                      draggingContent && canAcceptDraggedContent ? "border-dashed border-primary/30" : null,
                      isDropTargetActive ? "border-primary bg-primary/[0.08] shadow-sm" : null,
                      isFolderSelected ? "border-primary/40 bg-primary/[0.05]" : null,
                    )}
                    onDragOver={(event) => {
                      if (!canAcceptDraggedContent) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dragOverFolderId !== entry.folder.id) {
                        setDragOverFolderId(entry.folder.id);
                      }
                    }}
                    onDragLeave={(event) => {
                      const nextTarget = event.relatedTarget;
                      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                        return;
                      }

                      setDragOverFolderId((current) => (current === entry.folder.id ? null : current));
                    }}
                    onDrop={(event) => {
                      if (!canAcceptDraggedContent || !draggingContent) {
                        return;
                      }

                      event.preventDefault();
                      setDragOverFolderId(null);
                      setDraggingContentId(null);
                      void handleMoveContent(draggingContent, entry.folder.id);
                    }}>
                      <div className="flex items-center gap-1 px-1 py-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          onClick={() => setExpandedFolders((current) => toggleId(current, entry.folder.id))}
                          aria-label={folderExpanded ? "Collapse folder" : "Expand folder"}
                        >
                          {folderExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50"
                          onClick={() => handleSelectFolder(entry.folder.id)}
                        >
                          <FolderOpen className="h-4 w-4 text-slate-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{entry.folder.pathLabel}</p>
                            <p className="truncate text-[11px] text-slate-500">{entry.folder.description?.trim() || "Global repository folder"}</p>
                          </div>
                          <Badge variant="accent" className="ml-auto shrink-0">{entry.rootContents.length}</Badge>
                        </button>
                      </div>

                      {folderExpanded ? (
                        <div className="space-y-1 pb-2 pl-10 pr-2">
                          {entry.rootContents.map((content) => (
                            <button
                              key={content.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50"
                              onClick={() => {
                                handleSelectFolder(entry.folder.id);
                                const linkedResourceId = linkedResourcesByContentId[content.id]?.id;
                                if (linkedResourceId && canViewResources) {
                                  setViewingRepositoryResourceId(linkedResourceId);
                                } else {
                                  setViewingContentId(content.id);
                                }
                              }}
                            >
                              <FileText className="h-4 w-4 text-slate-400" />
                              <span className="truncate">{content.title}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {filteredRepositoryRootContents.length === 0 && filteredExplorerFolders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
                    <p>No repository folders or files match the current search.</p>
                    {isSearchActive ? (
                      <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setExplorerSearch("")}>Clear Search</Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{selectedLocationPath}</p>
                  <CardTitle className="mt-2">{isRootSelected ? "Repository Root" : selectedFolderName ?? "Nothing Selected"}</CardTitle>
                  <CardDescription>
                    {selectedFolder
                      ? `Browse uploads inside ${selectedFolder.name}. Folders only organize repository files and do not control assignment or delivery.`
                      : isRootSelected
                        ? "Browse unfiled repository uploads. Root items can stay here or be moved into custom folders for organization."
                      : repositoryCourseId
                        ? "Start from the repository root, create a folder, or upload a first file. Repository folders organize the canonical record while delivery still happens through assignments."
                        : "Create or activate a course first before adding repository files and folders."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canUploadToSelection ? (
                    <Button
                      type="button"
                      onClick={() => setAddContentOpen(true)}
                    >
                      <UploadCloud className="h-4 w-4" />
                      Upload Files
                    </Button>
                  ) : null}
                  {canCreateRepositoryFolder ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingFolder(null);
                        setAddFolderOpen(true);
                      }}
                    >
                      <FolderPlus className="h-4 w-4" />
                      New Folder
                    </Button>
                  ) : null}
                  {selectedFolder && canEditResources ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingFolder(selectedFolder);
                        setAddFolderOpen(true);
                      }}
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit Folder
                    </Button>
                  ) : null}
                  {selectedFolder && canDeleteResources ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setFolderPendingDelete(selectedFolder)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Folder
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* ── Content search ─────────────────────────────── */}
              {(selectedFolder || isRootSelected) ? (
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={contentSearch}
                    onChange={(event) => setContentSearch(event.target.value)}
                    className="h-10 rounded-xl pl-9 pr-9"
                    placeholder="Search content by title, file name, or type…"
                  />
                  {isContentSearchActive ? (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setContentSearch("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Location</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedLocationLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Visible Files</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{visibleContents.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Child Folders</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedChildFolderCount}</p>
                </div>
              </div>

              {isContentSearchActive && visibleContents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center text-muted-foreground">
                  <Search className="mb-2 h-5 w-5 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-900">No items match &ldquo;{contentSearch}&rdquo;</p>
                  <p className="mt-1 text-xs text-slate-500">Try a different keyword or clear the search.</p>
                  <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setContentSearch("")}>Clear Search</Button>
                </div>
              ) : null}

              {selectedFolder || isRootSelected ? (
                <CourseContentTab
                  items={visibleContents}
                  folderName={selectedFolderName}
                  linkedResources={linkedResourcesByContentId}
                  availableMoveTargets={moveTargets}
                  onAddContent={() => setAddContentOpen(true)}
                  onViewContent={setViewingContentId}
                  onEditContent={setEditingContentId}
                  onDeleteContent={setContentPendingDelete}
                  onMoveContent={handleMoveContent}
                  onViewRepositoryResource={canViewResources ? setViewingRepositoryResourceId : undefined}
                  onEditRepositoryResource={canEditResources ? setEditingRepositoryResourceId : undefined}
                  onViewRepositoryHistory={canViewResources ? (resourceId, title) => setHistoryTarget({ id: resourceId, title }) : undefined}
                  onManageRepositoryAssignments={canAssignResources ? (resourceId, title) => setAssignmentTarget({ id: resourceId, title }) : undefined}
                  canCreateContent={canUploadToSelection}
                  canEditContent={canEditContent}
                  canDeleteContent={canDeleteContent}
                  showCourseName={isRootSelected}
                  movingContentId={movingContentId}
                  dragToFolderEnabled={folders.length > 0}
                  draggingContentId={draggingContentId}
                  onContentDragStart={(content) => {
                    setDraggingContentId(content.id);
                    setDragOverFolderId(null);
                  }}
                  onContentDragEnd={() => {
                    setDraggingContentId(null);
                    setDragOverFolderId(null);
                  }}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
                  Select a custom folder from the explorer to browse its uploads. Repository root files can still be opened directly from the explorer.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {selectedFolder || (isRootSelected && repositoryCourseId) ? (
        <AddContentSheet
          open={addContentOpen}
          onOpenChange={setAddContentOpen}
          courseId={repositoryCourseId}
          folders={[]}
          repositoryFolders={folders.map((folder) => ({ id: folder.id, pathLabel: folder.pathLabel }))}
          defaultFolderId={selectedFolderId || undefined}
          onCreated={handleRepositoryResourcesChanged}
        />
      ) : null}

      <LearningResourceFolderSheet
          open={addFolderOpen}
          onOpenChange={(open) => {
            setAddFolderOpen(open);
            if (!open) {
              setEditingFolder(null);
            }
          }}
          folders={folders}
          folder={editingFolder ? {
            id: editingFolder.id,
            parentId: editingFolder.parentId,
            name: editingFolder.name,
            description: editingFolder.description,
            sortOrder: editingFolder.sortOrder,
          } : null}
          onSaved={async (folderId) => {
            setSelection({ kind: "folder", folderId });
            setExpandedFolders((current) => (current.includes(folderId) ? current : [...current, folderId]));
            setWorkspaceRefreshToken((current) => current + 1);
            setEditingFolder(null);
          }}
        />

      <CourseContentDetailSheet
        open={Boolean(viewingContentId)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingContentId(null);
          }
        }}
        contentId={viewingContentId}
        refreshToken={workspaceRefreshToken}
      />

      <EditContentSheet
        open={Boolean(editingContentId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingContentId(null);
          }
        }}
        contentId={editingContentId}
        folders={editingContentFolders.map((folder) => ({ id: folder.id, name: folder.name, description: folder.description }))}
        onUpdated={() => {
          setEditingContentId(null);
          handleRepositoryResourcesChanged();
        }}
      />

      <LearningResourceDetailSheet
        open={Boolean(viewingRepositoryResourceId)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRepositoryResourceId(null);
          }
        }}
        resourceId={viewingRepositoryResourceId}
        refreshToken={resourceRefreshToken}
      />

      <LearningResourceFormSheet
        open={Boolean(editingRepositoryResourceId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRepositoryResourceId(null);
          }
        }}
        resourceId={editingRepositoryResourceId}
        lookups={currentLookups}
        onSaved={() => {
          setEditingRepositoryResourceId(null);
          handleRepositoryResourcesChanged();
        }}
      />

      <LearningResourceHistorySheet
        open={Boolean(historyTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryTarget(null);
          }
        }}
        resourceId={historyTarget?.id ?? null}
        resourceTitle={historyTarget?.title ?? null}
        refreshToken={resourceRefreshToken}
        onRestored={handleRepositoryResourcesChanged}
      />

      <LearningResourceAssignmentsSheet
        open={Boolean(assignmentTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentTarget(null);
          }
        }}
        resourceId={assignmentTarget?.id ?? null}
        resourceTitle={assignmentTarget?.title ?? null}
        lookups={currentLookups}
        refreshToken={resourceRefreshToken}
        onAssignmentsUpdated={handleRepositoryResourcesChanged}
      />

      {folderPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-950">Delete Folder</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Delete {folderPendingDelete.pathLabel}? Repository folders only organize canonical items, and only empty folders can be removed.
            </p>
            {folderPendingDeleteContentCount > 0 ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                This folder still contains {folderPendingDeleteContentCount} item{folderPendingDeleteContentCount === 1 ? "" : "s"}. Move or delete them first.
              </p>
            ) : null}
            {folderPendingDeleteChildCount > 0 ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                This folder still contains {folderPendingDeleteChildCount} child folder{folderPendingDeleteChildCount === 1 ? "" : "s"}. Re-home them first.
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setFolderPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => void handleDeleteFolder()}
                disabled={isDeletingFolder || folderPendingDeleteContentCount > 0 || folderPendingDeleteChildCount > 0}
              >
                {isDeletingFolder ? "Deleting..." : "Delete Folder"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {contentPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-950">Delete Repository Item</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Delete {contentPendingDelete.title}? The upload will be removed from the explorer and its linked repository history, assignments, and metadata will be deleted with it.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setContentPendingDelete(null)}>
                Cancel
              </Button>
              <Button type="button" className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => void handleDeleteContent()} disabled={isDeletingContent}>
                {isDeletingContent ? "Deleting..." : "Delete Item"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}