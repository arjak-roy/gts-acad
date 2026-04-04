"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useRbac } from "@/lib/rbac-context";
import { getRequiredPermission } from "@/lib/rbac-config";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, isLoading } = useRbac();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const requiredPermission = getRequiredPermission(pathname);

    if (requiredPermission && !can(requiredPermission)) {
      router.replace("/access-denied");
    }
  }, [pathname, can, isLoading, router]);

  if (isLoading) {
    return <>{children}</>;
  }

  const requiredPermission = getRequiredPermission(pathname);
  if (requiredPermission && !can(requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}
