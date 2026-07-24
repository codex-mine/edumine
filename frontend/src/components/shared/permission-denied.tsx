import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/lib/auth/roles";

export function PermissionDenied({
  userRole,
  requiredRole,
}: {
  userRole: Role;
  requiredRole?: string;
}) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
          <CardTitle>Access denied</CardTitle>
        </div>
        <CardDescription>
          {requiredRole
            ? `Your account (${userRole}) does not have permission to view the ${requiredRole} dashboard.`
            : "Your account does not have permission to view this page."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${userRole}`}>Go to your dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
