"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { AlertTriangle, Clock, DollarSign, Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { departuresApi, reservationsApi } from "@/lib/api-client";
import {
  formatDateTime,
  formatCurrency,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
} from "@/lib/utils";
import type { Departure, ReservationListItem } from "@/types";

export default function DashboardPage() {
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");

      const [depsRes, resRes] = await Promise.all([
        departuresApi.list({ from: today, to: nextWeek }),
        reservationsApi.list({ page_size: 20 }),
      ]);

      setDepartures(depsRes.data);
      setReservations(resRes.data);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overbooked = departures.filter((d) => d.is_overbooked);
  const unpaid = reservations.filter((r) => r.balance_due > 0);

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your operations" />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Upcoming Departures (7d)
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departures.length}</div>
                {overbooked.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {overbooked.length} overbooked
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Payments
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unpaid.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  reservations with balance due
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Overbook Alerts
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {overbooked.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Recent Reservations
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reservations.length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming departures */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Upcoming Departures (next 7 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {departures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No departures in the next 7 days.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {departures.map((dep) => (
                      <Link
                        key={dep.id}
                        href={`/departures/${dep.id}`}
                        className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {dep.tour?.name ?? "Tour"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(dep.start_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {dep.capacity_used}/{dep.capacity_total}
                          </p>
                          {dep.is_overbooked && (
                            <Badge variant="destructive" className="text-xs">
                              Overbooked
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overbook alerts */}
            {overbooked.length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Overbook Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overbooked.map((dep) => (
                      <Link
                        key={dep.id}
                        href={`/departures/${dep.id}`}
                        className="flex items-center justify-between p-3 rounded-md border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {dep.tour?.name ?? "Tour"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(dep.start_at)}
                          </p>
                        </div>
                        <div className="text-right text-sm text-destructive font-medium">
                          {dep.capacity_used}/{dep.capacity_total}
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unpaid reservations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Reservations Needing Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unpaid.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All reservations are paid.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {unpaid.slice(0, 10).map((res) => (
                      <Link
                        key={res.id}
                        href={`/reservations/${res.id}`}
                        className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {res.customer?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {res.departure?.start_at
                              ? formatDateTime(res.departure.start_at)
                              : "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-destructive">
                            {formatCurrency(res.balance_due, res.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            due
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent reservations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                {reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent reservations.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reservations.slice(0, 10).map((res) => (
                      <Link
                        key={res.id}
                        href={`/reservations/${res.id}`}
                        className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {res.customer?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {res.departure?.tour?.name ?? "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RESERVATION_STATUS_COLORS[res.status]}`}
                          >
                            {RESERVATION_STATUS_LABELS[res.status]}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
