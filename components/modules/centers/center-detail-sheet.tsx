"use client";

import { useEffect, useState } from "react";
import { Building2, MapPin, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type CenterDetail = {
  id: string;
  name: string;
  addressSummary: string;
  cityName: string | null;
  stateName: string | null;
  countryName: string | null;
  totalCapacity: number;
  currentUtilization: number;
  complianceStatus: "pending" | "compliant" | "review_required";
  isActive: boolean;
  batchCount: number;
};

type CenterDetailSheetProps = {
  centerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (centerId: string) => void;
};

export function CenterDetailSheet({ centerId, open, onOpenChange, onEdit }: CenterDetailSheetProps) {
  const [center, setCenter] = useState<CenterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !centerId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setCenter(null);

    fetch(`/api/centers/${centerId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { data?: CenterDetail; error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load center details.");
        }

        if (active && payload?.data) {
          setCenter(payload.data);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load center details.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [centerId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCenter(null);
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
        ) : center ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <SheetTitle>{center.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {center.cityName ?? "Location pending"}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={center.isActive ? "success" : "danger"}>
                      {center.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                    <Badge variant="info">{center.complianceStatus}</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Address</p>
                <div className="mt-3 flex items-start gap-3 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-semibold text-slate-900">Full Address</p>
                    <p>{center.addressSummary || "Not specified"}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Capacity</p>
                  <div className="mt-3 flex items-start gap-3 text-sm text-slate-600">
                    <Users className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold text-slate-900">Current Utilization</p>
                      <p>{center.currentUtilization} / {center.totalCapacity}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Compliance</p>
                  <div className="mt-3 flex items-start gap-3 text-sm text-slate-600">
                    <Shield className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold text-slate-900">Status</p>
                      <p>{center.complianceStatus}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Operational Usage</p>
                <p className="mt-3 text-sm text-slate-600">
                  {center.batchCount} batch{center.batchCount === 1 ? "" : "es"} currently reference this center.
                </p>
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="centers.edit">
                <Button onClick={() => onEdit(center.id)}>
                  Edit Center
                </Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}