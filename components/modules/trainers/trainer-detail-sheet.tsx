"use client";

import { useEffect, useState } from "react";
import { BookOpen, Mail, Phone, Star, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type TrainerStatus = "ACTIVE" | "INACTIVE";

type TrainerDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  capacity: number;
  status: TrainerStatus;
  programs: string[];
  bio: string | null;
};

type TrainerDetailSheetProps = {
  trainerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (trainerId: string) => void;
};

export function TrainerDetailSheet({ trainerId, open, onOpenChange, onEdit }: TrainerDetailSheetProps) {
  const [trainer, setTrainer] = useState<TrainerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !trainerId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setTrainer(null);

    fetch(`/api/trainers/${trainerId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load trainer details.");
        const payload = (await res.json()) as { data?: TrainerDetail };
        if (active && payload.data) setTrainer(payload.data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load trainer details.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [trainerId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTrainer(null);
      setError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : trainer ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700">
                  {trainer.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <SheetTitle>{trainer.fullName}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {trainer.specialization}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={trainer.status === "ACTIVE" ? "success" : "danger"}>
                      {trainer.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Contact</p>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold text-slate-900">Email</p>
                      <p>{trainer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold text-slate-900">Phone</p>
                      <p>{trainer.phone ?? "Not provided"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Specialization</p>
                  <div className="mt-3 flex items-start gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-slate-900">{trainer.specialization}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Capacity</p>
                  <div className="mt-3 flex items-start gap-3">
                    <Star className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-slate-900">{trainer.capacity} learners</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Programs</p>
                {trainer.programs.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No programs assigned.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trainer.programs.map((program) => (
                      <span key={program} className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <BookOpen className="h-3 w-3" />
                        {program}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {trainer.bio ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Bio</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{trainer.bio}</p>
                </div>
              ) : null}
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="trainers.edit">
                <Button onClick={() => onEdit(trainer.id)}>
                  Edit Trainer
                </Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
