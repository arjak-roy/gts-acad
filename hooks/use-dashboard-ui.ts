"use client";

import { create } from "zustand";

type DashboardUIState = {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
};

export const useDashboardUI = create<DashboardUIState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  setMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
}));