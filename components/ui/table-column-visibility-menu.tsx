"use client";

import { Columns3, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TableColumnVisibilityOption = {
  key: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
};

type TableColumnVisibilityMenuProps = {
  columns: TableColumnVisibilityOption[];
  onToggle: (columnKey: string) => void;
  onReset?: () => void;
  className?: string;
};

export function TableColumnVisibilityMenu({
  columns,
  onToggle,
  onReset,
  className,
}: TableColumnVisibilityMenuProps) {
  if (columns.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className={className}>
          <Columns3 className="mr-1.5 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        {onReset ? (
          <>
            <DropdownMenuItem onSelect={() => onReset()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset layout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={column.checked}
            disabled={column.disabled}
            onCheckedChange={() => onToggle(column.key)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}