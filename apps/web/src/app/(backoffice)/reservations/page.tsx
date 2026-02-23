"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { reservationsApi, toursApi } from "@/lib/api-client";
import {
  formatDateTime,
  formatCurrency,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  hasRole,
  formatShortId,
} from "@/lib/utils";
import type { ReservationListItem, Tour } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function ReservationsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [tourFilter, setTourFilter] = useState("all");
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reservationsApi.list({
        from: from || undefined,
        to: to || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        tour_id: tourFilter !== "all" ? tourFilter : undefined,
        page,
        page_size: 50,
      });
      let data = res.data;
      if (unpaidOnly) {
        data = data.filter((r) => r.balance_due > 0);
      }
      setReservations(data);
      setTotal(res.meta.total);
    } catch {
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [from, to, statusFilter, tourFilter, unpaidOnly, page]);

  useEffect(() => {
    toursApi.list().then((r) => setTours(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [from, to, statusFilter, tourFilter, unpaidOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Reservations"
        actions={
          hasRole(role ?? "", "STAFF") && (
            <Button onClick={() => router.push("/reservations/new")}>
              <Plus className="h-4 w-4" />
              New Reservation
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-lg border bg-background">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="res-from" className="text-sm">From</Label>
          <Input
            id="res-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="res-to" className="text-sm">To</Label>
          <Input
            id="res-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="RESERVED">Reserved</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tourFilter} onValueChange={setTourFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All tours" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tours</SelectItem>
            {tours.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="unpaid"
            checked={unpaidOnly}
            onCheckedChange={(c) => setUnpaidOnly(c === true)}
          />
          <Label htmlFor="unpaid" className="text-sm cursor-pointer">
            Unpaid only
          </Label>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No reservations found.
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Tour</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((res) => (
                  <TableRow
                    key={res.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/reservations/${res.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {formatShortId(res.id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(res.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {res.departure?.start_at
                        ? formatDateTime(res.departure.start_at)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {res.departure?.tour?.name ?? "—"}
                    </TableCell>
                    <TableCell>{res.customer?.full_name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RESERVATION_STATUS_COLORS[res.status]}`}
                      >
                        {RESERVATION_STATUS_LABELS[res.status]}
                      </span>
                    </TableCell>
                    <TableCell>{res.currency}</TableCell>
                    <TableCell>
                      {formatCurrency(res.total_final, res.currency)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(res.net_paid, res.currency)}
                    </TableCell>
                    <TableCell>
                      {res.balance_due > 0 ? (
                        <span className="text-destructive font-medium">
                          {formatCurrency(res.balance_due, res.currency)}
                        </span>
                      ) : (
                        <span className="text-green-600 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {res.capacity_override && (
                          <Badge variant="warning" className="text-xs">
                            Override
                          </Badge>
                        )}
                        {res.net_paid > res.total_final && (
                          <Badge variant="info" className="text-xs">
                            Overpaid
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Showing {reservations.length} of {total} reservations</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={reservations.length < 50}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
