"use client";

import React from "react";
import { Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Agency } from "@/types";

interface AgencyPickerProps {
  onSelect: (agency: Agency) => void;
}

export function AgencyPicker({ onSelect }: AgencyPickerProps) {
  const { agencies, selectAgency, signOut } = useAuth();

  const handleSelect = (agency: Agency) => {
    selectAgency(agency);
    onSelect(agency);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">Select Agency</CardTitle>
          <CardDescription>
            Choose which agency you want to work with
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agencies.map((agency) => (
            <button
              key={agency.id}
              onClick={() => handleSelect(agency)}
              className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors text-left"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{agency.name}</p>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABELS[agency.role]}
                </p>
              </div>
            </button>
          ))}

          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
