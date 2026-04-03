import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperAdminAuditPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">Audit log views can be connected next to role and user mutations. The route is in place for SuperAdmin navigation and future event history wiring.</p>
      </CardContent>
    </Card>
  );
}