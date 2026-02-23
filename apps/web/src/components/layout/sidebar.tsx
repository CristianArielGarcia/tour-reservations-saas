"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Map,
  Tag,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredRole?: "VIEWER" | "STAFF" | "STAFF_PRICING" | "OWNER";
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Reservations", href: "/reservations", icon: BookOpen },
  { label: "Tours", href: "/tours", icon: Map },
  { label: "Pricing", href: "/pricing", icon: Tag, requiredRole: "STAFF_PRICING" },
  { label: "Passenger Categories", href: "/passenger-categories", icon: Users },
  { label: "Audit", href: "/audit", icon: FileText, requiredRole: "STAFF_PRICING" },
  { label: "Users", href: "/users", icon: UserCog, requiredRole: "OWNER" },
  { label: "Settings", href: "/settings", icon: Settings, requiredRole: "OWNER" },
];

const roleHierarchy: Record<string, number> = {
  VIEWER: 0,
  STAFF: 1,
  STAFF_PRICING: 2,
  OWNER: 3,
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { role } = useAuth();

  const canView = (requiredRole?: string) => {
    if (!requiredRole) return true;
    if (!role) return false;
    return (roleHierarchy[role] ?? -1) >= (roleHierarchy[requiredRole] ?? 99);
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-foreground truncate">
            TourReservations
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground",
            collapsed && "mx-auto"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            if (!canView(item.requiredRole)) return null;
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
