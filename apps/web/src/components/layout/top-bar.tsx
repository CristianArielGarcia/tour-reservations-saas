"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/utils";

export function TopBar() {
  const { user, agencies, selectedAgency, selectAgency, signOut, role } =
    useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="h-16 border-b bg-background flex items-center px-6 gap-4 sticky top-0 z-40">
      {/* Agency switcher */}
      {agencies.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="max-w-[160px] truncate">
                {selectedAgency?.name ?? "Select Agency"}
              </span>
              {role && (
                <span className="text-xs text-muted-foreground">
                  ({ROLE_LABELS[role]})
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Your Agencies</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {agencies.map((agency) => (
              <DropdownMenuItem
                key={agency.id}
                onClick={() => selectAgency(agency)}
                className="flex items-center justify-between gap-4"
              >
                <span>{agency.name}</span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[agency.role]}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="max-w-[120px] truncate text-sm">
                {user?.email}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
