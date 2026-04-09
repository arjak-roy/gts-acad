import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableLoadingStateProps = {
  columnCount: number;
  rowCount?: number;
  className?: string;
};

export function DataTableLoadingState({ columnCount, rowCount = 5, className }: DataTableLoadingStateProps) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-100", className)}>
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            {Array.from({ length: columnCount }, (_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columnCount }, (_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className={cn("h-4", colIndex === 0 ? "w-32" : "w-20")} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
