"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/utils";

export default function SettingsPage() {
  const { selectedAgency, role } = useAuth();

  if (!hasRole(role ?? "", "OWNER")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Only owners can access settings.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Agency configuration" />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Agency Information</CardTitle>
          <CardDescription>Current agency details</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-sm font-medium text-muted-foreground">Agency Name</dt>
              <dd className="text-sm col-span-2">{selectedAgency?.name ?? "—"}</dd>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-sm font-medium text-muted-foreground">Your Role</dt>
              <dd className="text-sm col-span-2">{role ?? "—"}</dd>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-sm font-medium text-muted-foreground">Agency ID</dt>
              <dd className="text-sm font-mono col-span-2 break-all">{selectedAgency?.id ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
