"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type StatWidget = {
  label: string;
  value: string | number;
  helper?: string | null;
};

interface AnalyticsStatsGridProps {
  widgets: StatWidget[];
  loading?: boolean;
}

export function AnalyticsStatsGrid({ widgets, loading }: AnalyticsStatsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {widgets.map((widget) => (
        <Card key={widget.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {widget.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{widget.value}</div>
            {widget.helper && (
              <p className="mt-1 text-xs text-muted-foreground">{widget.helper}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
