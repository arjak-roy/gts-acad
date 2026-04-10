"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CurriculumReferencePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchPlaceholder: string;
  selectedCount: number;
  confirmLabel: string;
  isConfirmDisabled: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
  actions?: ReactNode;
  footerContent?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
};

export function CurriculumReferencePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  searchTerm,
  onSearchTermChange,
  searchPlaceholder,
  selectedCount,
  confirmLabel,
  isConfirmDisabled,
  isSubmitting,
  onConfirm,
  actions,
  footerContent,
  children,
  bodyClassName,
}: CurriculumReferencePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,72rem)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>

          <Badge variant="info">{selectedCount} selected</Badge>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>
          {children}
        </div>

        <DialogFooter className="items-center justify-between">
          <div className="mr-auto flex min-w-0 flex-1 items-center">
            {footerContent}
          </div>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isConfirmDisabled}>
            {isSubmitting ? "Saving..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}