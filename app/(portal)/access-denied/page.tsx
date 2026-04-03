import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAuthSession } from "@/lib/auth/access";
import { getDefaultPortalPath } from "@/lib/auth/module-access";

export default async function AccessDeniedPage() {
  const session = await getCurrentAuthSession();
  const fallbackPath = getDefaultPortalPath(session);
  const targetHref = fallbackPath === "/login" ? "/login" : fallbackPath;

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Access Not Assigned</CardTitle>
          <CardDescription>Your account is authenticated, but no portal module is currently assigned for this route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Ask a Super Admin to grant the modules you need. Once access is assigned, sign out and sign back in so your session reflects the new permissions.
          </p>
          <Button asChild>
            <Link href={targetHref}>Go to Available Area</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}