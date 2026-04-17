import { Suspense } from "react";

import { LiveRoomClient } from "@/components/modules/live-class/live-room-client";

export default function LiveRoomPage() {
  return (
    <Suspense fallback={<LiveRoomLoadingFallback />}>
      <LiveRoomClient />
    </Suspense>
  );
}

function LiveRoomLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-sm font-medium text-slate-400">Preparing live room…</p>
      </div>
    </div>
  );
}
