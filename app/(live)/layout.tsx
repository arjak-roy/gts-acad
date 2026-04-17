import { RouteGuard } from "@/components/layout/route-guard";

export const dynamic = "force-dynamic";

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard>{children}</RouteGuard>;
}
