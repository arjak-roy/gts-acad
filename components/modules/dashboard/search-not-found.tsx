import { SearchX } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SearchNotFoundProps = {
  query: string;
};

export function SearchNotFound({ query }: SearchNotFoundProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-slate-100 p-4">
          <SearchX className="h-8 w-8 text-slate-400" />
        </div>

        <h2 className="mt-6 text-2xl font-bold text-slate-900">No results found</h2>
        <p className="mt-2 max-w-md text-center text-slate-500">
          No matches for <span className="font-semibold text-slate-700">&ldquo;{query}&rdquo;</span>
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link href="/learners">
            <Button variant="secondary" className="w-full sm:w-auto">
              Browse Learners
            </Button>
          </Link>
          <Link href="/batches">
            <Button variant="secondary" className="w-full sm:w-auto">
              Browse Batches
            </Button>
          </Link>
          <Link href="/programs">
            <Button variant="secondary" className="w-full sm:w-auto">
              Browse Programs
            </Button>
          </Link>
        </div>

        <p className="mt-8 max-w-md text-center text-sm text-slate-500">
          Try searching for a learner code, program name, trainer specialization, batch code, or campus name.
        </p>
      </CardContent>
    </Card>
  );
}
