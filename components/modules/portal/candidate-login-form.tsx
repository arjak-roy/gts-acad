"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { loginCandidate } from "@/app/learners/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const candidateLoginSchema = z.object({
  learnerCode: z.string().trim().min(2, "Learner code is required."),
  email: z.string().trim().email("Valid email is required."),
});

type CandidateLoginValues = z.infer<typeof candidateLoginSchema>;

export function CandidateLoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<CandidateLoginValues>({
    resolver: zodResolver(candidateLoginSchema),
    defaultValues: {
      learnerCode: "",
      email: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("learnerCode", values.learnerCode);
      formData.set("email", values.email);

      const result = await loginCandidate(formData);

      if (!result.ok) {
        form.setError("root", { message: result.error });
        return;
      }

      router.replace("/learners");
      router.refresh();
    });
  });

  return (
    <Card className="border-white/60 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <CardContent className="space-y-5 p-7">
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Learner Code</label>
          <Input placeholder="GTS-240901" {...form.register("learnerCode")} />
          <p className="text-xs text-rose-500">{form.formState.errors.learnerCode?.message}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Email</label>
          <Input type="email" placeholder="learner@example.com" {...form.register("email")} />
          <p className="text-xs text-rose-500">{form.formState.errors.email?.message}</p>
        </div>
        {form.formState.errors.root ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{form.formState.errors.root.message}</p> : null}
        <Button type="button" className="w-full" disabled={isPending} onClick={() => void onSubmit()}>
          {isPending ? "Signing in..." : "Access Learner Portal"}
        </Button>
      </CardContent>
    </Card>
  );
}