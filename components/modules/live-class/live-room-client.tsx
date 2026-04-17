"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  HMSRoomProvider,
  useHMSActions,
  useHMSStore,
  useAVToggle,
  useVideo,
} from "@100mslive/react-sdk";
import {
  selectIsConnectedToRoom,
  selectPeers,
  selectLocalPeer,
} from "@100mslive/hms-video-store";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from "lucide-react";

export function LiveRoomClient() {
  return (
    <HMSRoomProvider>
      <LiveRoomInner />
    </HMSRoomProvider>
  );
}

function LiveRoomInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const eventId = searchParams.get("eventId");
  const roomId = searchParams.get("roomId");
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const localPeer = useHMSStore(selectLocalPeer);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!token || joinedRef.current) return;
    joinedRef.current = true;

    hmsActions.join({
      authToken: token,
      userName: "Host",
      settings: {
        isAudioMuted: false,
        isVideoMuted: false,
      },
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to join room.");
    });

    return () => {
      if (isConnected) {
        hmsActions.leave().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleEndRoom = useCallback(async () => {
    if (!eventId || ending) return;
    setEnding(true);

    try {
      await hmsActions.endRoom(false, "Host ended the class.");
    } catch {
      // Room may already be ended on 100ms side; continue with API call.
    }

    try {
      const response = await fetch("/api/live-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action: "end" }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to end live class.");
      }
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Failed to end live class.");
      setEnding(false);
      return;
    }

    window.close();
  }, [eventId, ending, hmsActions]);

  const handleLeave = useCallback(async () => {
    try {
      await hmsActions.leave();
    } catch {
      // ignore leave errors
    }
    window.close();
  }, [hmsActions]);

  if (!token || !eventId) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <p className="text-sm font-medium text-red-400">Missing room parameters. Please start from the schedule page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-950">
        <p className="text-sm font-medium text-red-400">{error}</p>
        <button
          onClick={() => window.close()}
          className="rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Close
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Joining room…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm font-bold text-white">Live Class</span>
          <span className="text-xs text-slate-400">Room: {roomId?.slice(0, 8) ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">{peers.length}</span>
          </div>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="grid h-full w-full gap-3"
          style={{
            gridTemplateColumns: peers.length <= 1 ? "1fr" : peers.length <= 4 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
            gridAutoRows: "1fr",
          }}
        >
          {peers.map((peer) => (
            <PeerVideoTile key={peer.id} trackId={peer.videoTrack} peerName={peer.name} isLocal={peer.id === localPeer?.id} />
          ))}
        </div>
      </div>

      {/* Controls bar */}
      <ControlBar onEndRoom={handleEndRoom} onLeave={handleLeave} ending={ending} />
    </div>
  );
}

function PeerVideoTile({ trackId, peerName, isLocal }: { trackId?: string; peerName: string; isLocal: boolean }) {
  const { videoRef } = useVideo({ trackId });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900">
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal}
        playsInline
        className="h-full w-full object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <span className="text-xs font-semibold text-white">
          {peerName}
          {isLocal ? " (You)" : ""}
        </span>
      </div>
    </div>
  );
}

function ControlBar({
  onEndRoom,
  onLeave,
  ending,
}: {
  onEndRoom: () => void;
  onLeave: () => void;
  ending: boolean;
}) {
  const { isLocalAudioEnabled, isLocalVideoEnabled, toggleAudio, toggleVideo } = useAVToggle();

  return (
    <div className="flex shrink-0 items-center justify-center gap-4 border-t border-slate-800 px-4 py-4">
      <button
        onClick={toggleAudio}
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          isLocalAudioEnabled
            ? "bg-slate-700 text-white hover:bg-slate-600"
            : "bg-red-600 text-white hover:bg-red-500"
        }`}
        title={isLocalAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isLocalAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>

      <button
        onClick={toggleVideo}
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          isLocalVideoEnabled
            ? "bg-slate-700 text-white hover:bg-slate-600"
            : "bg-red-600 text-white hover:bg-red-500"
        }`}
        title={isLocalVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isLocalVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </button>

      <button
        onClick={onLeave}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-600"
        title="Leave room (class continues)"
      >
        <PhoneOff className="h-5 w-5" />
      </button>

      <button
        onClick={onEndRoom}
        disabled={ending}
        className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        title="End room for all participants"
      >
        {ending ? "Ending…" : "End Class"}
      </button>
    </div>
  );
}
