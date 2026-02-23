"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, subDays, addDays } from "date-fns";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { departuresApi, toursApi } from "@/lib/api-client";
import {
  formatDateTime,
  DEPARTURE_STATUS_COLORS,
  hasRole,
} from "@/lib/utils";
import type { Departure, Tour } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function CalendarPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters
  const [from, setFrom] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [tourFilter, setTourFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadDepartures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departuresApi.list({
        from,
        to,
        ...(tourFilter !== "all" ? { tour_id: tourFilter } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      setDepartures(res.data);
    } catch {
      toast.error("Failed to load departures");
    } finally {
      setLoading(false);
    }
  }, [from, to, tourFilter, statusFilter]);

  useEffect(() => {
    toursApi.list().then((r) => setTours(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadDepartures();
  }, [loadDepartures]);

  return (
    <div>
      <PageHeader
        title="Departures Calendar"
        actions={
          hasRole(role ?? "", "STAFF") && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              New Departure
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
          <Label htmlFor="from" className="text-sm">From</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="to" className="text-sm">To</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : departures.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No departures found for the selected filters.
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Tour</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departures.map((dep) => (
                <TableRow
                  key={dep.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/departures/${dep.id}`)}
                >
                  <TableCell className="font-medium">
                    {formatDateTime(dep.start_at)}
                  </TableCell>
                  <TableCell>{dep.tour?.name ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DEPARTURE_STATUS_COLORS[dep.status]}`}
                    >
                      {dep.status}
                    </span>
                  </TableCell>
                  <TableCell>{dep.capacity_total}</TableCell>
                  <TableCell>{dep.capacity_used}</TableCell>
                  <TableCell>{dep.capacity_remaining}</TableCell>
                  <TableCell>
                    {dep.is_overbooked && (
                      <Badge variant="destructive">Overbooked</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateDepartureModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tours={tours}
        onCreated={(id) => router.push(`/departures/${id}`)}
      />
    </div>
  );
}

function CreateDepartureModal({
  open,
  onClose,
  tours,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tours: Tour[];
  onCreated: (id: string) => void;
}) {
  const [tourId, setTourId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!tourId || !startAt) {
      toast.error("Tour and start date/time are required");
      return;
    }
    setLoading(true);
    try {
      const res = await departuresApi.create({
        tour_id: tourId,
        start_at: startAt,
        capacity_total: capacity,
        notes: notes || undefined,
      });
      toast.success("Departure created");
      onCreated(res.data.id);
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to create departure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Departure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tour *</Label>
            <Select value={tourId} onValueChange={setTourId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tour" />
              </SelectTrigger>
              <SelectContent>
                {tours.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date & Time *</Label>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Capacity *</Label>
            <Input
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
