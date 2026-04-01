"use client";

import { useEffect } from "react";
import { Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SearchErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SearchError({ error, reset }: SearchErrorProps) {
  useEffect(() => {
    console.error("Search error:", error);
  }, [error]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Search</h1>
        <p className="mt-2 text-slate-500">Find learners, batches, trainers, and programs</p>
      </div>

      <Card className="border-rose-200 bg-rose-50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-rose-100 p-4">
            <Search className="h-8 w-8 text-rose-600" />
          </div>

          <h2 className="mt-6 text-2xl font-bold text-rose-900">Search error</h2>
          <p className="mt-2 max-w-md text-center text-sm text-rose-700">
            Something went wrong while searching. Please try again.
          </p>

          <Button onClick={reset} className="mt-8">
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
