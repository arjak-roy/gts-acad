"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";

type LoadingContextType = {
  isLoading: boolean;
  incrementLoadingCount: () => void;
  decrementLoadingCount: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0);

  const incrementLoadingCount = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const decrementLoadingCount = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const isLoading = loadingCount > 0;

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        incrementLoadingCount,
        decrementLoadingCount,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return context;
}
