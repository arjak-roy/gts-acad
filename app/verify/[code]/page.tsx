import Link from "next/link";
import { Award, BadgeCheck, CircleX, Clock3, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CertificatePreviewRenderer } from "@/components/modules/certifications/certificate-preview-renderer";
import { getCertificateByVerificationCodeService } from "@/services/certifications";

type VerifyPageProps = {
  params: Promise<{ code: string }>;
};

function getStatusBadge(status: string) {
  if (status === "ISSUED") return <Badge variant="success">Valid</Badge>;
  if (status === "REVOKED") return <Badge variant="danger">Revoked</Badge>;
  return <Badge variant="default">Expired</Badge>;
}

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
  const { code } = await params;
  const certificate = await getCertificateByVerificationCodeService(code);

  if (!certificate) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-700">
              <CircleX className="h-5 w-5" />
              Certificate Not Found
            </CardTitle>
            <CardDescription className="text-rose-700/90">
              The verification code is invalid or the certificate is no longer available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className="text-sm font-semibold text-rose-700 underline underline-offset-4">
              Return to homepage
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isActive = certificate.status === "ISSUED";

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-slate-200 bg-white/95">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
            <ShieldCheck className="h-5 w-5 text-[#0d3b84]" />
            Certificate Verification
          </CardTitle>
          <CardDescription>
            Verify the authenticity and current status of this certificate.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-800">Certificate Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {certificate.layoutJson && certificate.templateBranding ? (
              <CertificatePreviewRenderer
                layoutJson={certificate.layoutJson}
                orientation={certificate.templateBranding.orientation}
                paperSize={certificate.templateBranding.paperSize}
                backgroundColor={certificate.templateBranding.backgroundColor}
                backgroundImageUrl={certificate.templateBranding.backgroundImageUrl}
                logoUrl={certificate.templateBranding.logoUrl}
                renderedData={certificate.renderedDataJson}
                className="overflow-hidden rounded-xl border border-slate-200"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Certificate layout preview is unavailable for this record.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-800">Verification Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              {getStatusBadge(certificate.status)}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Certificate Number</span>
              <span className="font-mono text-xs text-slate-700">{certificate.certificateNumber ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Learner</span>
              <span className="text-right font-medium text-slate-800">{certificate.learnerName}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Course</span>
              <span className="text-right text-slate-700">{certificate.courseName ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Program</span>
              <span className="text-right text-slate-700">{certificate.programName}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Issued On</span>
              <span className="text-right text-slate-700">{new Date(certificate.issuedAt).toLocaleDateString()}</span>
            </div>
            {certificate.expiresAt && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Expires On</span>
                <span className="text-right text-slate-700">{new Date(certificate.expiresAt).toLocaleDateString()}</span>
              </div>
            )}

            <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {isActive ? <BadgeCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                {isActive ? "This certificate is currently valid." : "This certificate is not currently valid."}
              </div>
            </div>

            <div className="pt-1 text-xs text-slate-400">
              Verification code: <span className="font-mono">{code}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
          <Award className="h-4 w-4 text-slate-400" />
          This verification page is generated directly from the official issuance record.
        </CardContent>
      </Card>
    </main>
  );
}
