"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Plus, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { departuresApi, reservationsApi } from "@/lib/api-client";
import {
  formatDateTime,
  formatCurrency,
  DEPARTURE_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  hasRole,
  formatShortId,
} from "@/lib/utils";
import type { Departure, ReservationListItem } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function DepartureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const departureId = params.departureId as string;

  const [departure, setDeparture] = useState<Departure | null>(null);
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depRes, resRes] = await Promise.all([
        departuresApi.get(departureId),
        reservationsApi.list({ departure_id: departureId }),
      ]);
      setDeparture(depRes.data);
      setReservations(resRes.data);
    } catch {
      toast.error("Failed to load departure");
    } finally {
      setLoading(false);
    }
  }, [departureId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClose = async (reason?: string) => {
    try {
      await departuresApi.close(departureId, { reason });
      toast.success("Departure closed");
      load();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to close departure");
    }
  };

  if (loading || !departure) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/calendar"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Calendar
        </Link>
      </div>

      <PageHeader
        title={`Departure: ${departure.tour?.name ?? "Tour"}`}
        actions={
          <div className="flex gap-2">
            {hasRole(role ?? "", "STAFF") && departure.status === "ACTIVE" && (
              <>
                <Button variant="outline" onClick={() => setShowEditModal(true)}>
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowCloseConfirm(true)}
                >
                  Close Departure
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Header Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Date & Time</p>
            <p className="font-medium">{formatDateTime(departure.start_at)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DEPARTURE_STATUS_COLORS[departure.status]}`}
            >
              {departure.status}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Capacity</p>
            <p className="font-medium">{departure.capacity_total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Used</p>
            <p className="font-medium">{departure.capacity_used}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="font-medium">{departure.capacity_remaining}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Overbooked</p>
            {departure.is_overbooked ? (
              <Badge variant="destructive">Yes</Badge>
            ) : (
              <Badge variant="secondary">No</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {departure.is_overbooked && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overbooked</AlertTitle>
          <AlertDescription>
            This departure has more passengers than available capacity.
          </AlertDescription>
        </Alert>
      )}

      {/* Reservations tab */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Reservations</CardTitle>
          {hasRole(role ?? "", "STAFF") && departure.status === "ACTIVE" && (
            <Button
              size="sm"
              onClick={() =>
                router.push(`/reservations/new?departure_id=${departureId}`)
              }
            >
              <Plus className="h-4 w-4" />
              New Reservation
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reservations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
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
                    <TableCell>{res.customer?.full_name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RESERVATION_STATUS_COLORS[res.status]}`}
                      >
                        {RESERVATION_STATUS_LABELS[res.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(res.total_final, res.currency)}
                    </TableCell>
                    <TableCell>
                      {res.balance_due > 0 ? (
                        <span className="text-destructive font-medium">
                          {formatCurrency(res.balance_due, res.currency)}
                        </span>
                      ) : (
                        <span className="text-green-600">Paid</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {res.capacity_override && (
                        <Badge variant="warning">Override</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditDepartureModal
        departure={departure}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdated={load}
        userRole={role ?? "VIEWER"}
      />

      <CloseConfirmModal
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleClose}
      />
    </div>
  );
}

function EditDepartureModal({
  departure,
  open,
  onClose,
  onUpdated,
  userRole,
}: {
  departure: Departure;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  userRole: string;
}) {
  const [startAt, setStartAt] = useState(
    departure.start_at.slice(0, 16)
  );
  const [capacity, setCapacity] = useState(departure.capacity_total);
  const [notes, setNotes] = useState(departure.notes ?? "");
  const [dateChangeReason, setDateChangeReason] = useState("");
  const [capacityReason, setCapacityReason] = useState("");
  const [loading, setLoading] = useState(false);

  const originalDate = departure.start_at.slice(0, 10);
  const newDate = startAt.slice(0, 10);
  const dateChanged = newDate !== originalDate;
  const capacityDecreased = capacity < departure.capacity_used;

  const needsPrivilege =
    (dateChanged || capacityDecreased) && !hasRole(userRole, "OWNER");

  const handleSave = async () => {
    if (dateChanged && !dateChangeReason) {
      toast.error("Reason required for date change");
      return;
    }
    if (capacityDecreased && !capacityReason) {
      toast.error("Reason required for capacity reduction below used");
      return;
    }
    setLoading(true);
    try {
      await departuresApi.update(departure.id, {
        start_at: startAt ? new Date(startAt).toISOString() : undefined,
        capacity_total: capacity,
        notes: notes || undefined,
        ...(dateChangeReason ? { date_change_reason: dateChangeReason } : {}),
        ...(capacityReason ? { capacity_change_reason: capacityReason } : {}),
      });
      toast.success("Departure updated");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to update departure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Departure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Start Date & Time</Label>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>

          {dateChanged && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Date change warning</AlertTitle>
              <AlertDescription>
                Changing the departure day triggers reservation repricing.
                All adjustments will be removed.
              </AlertDescription>
            </Alert>
          )}

          {dateChanged && (
            <div className="space-y-2">
              <Label>Reason for date change *</Label>
              <Input
                value={dateChangeReason}
                onChange={(e) => setDateChangeReason(e.target.value)}
                placeholder="Required"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Capacity</Label>
            <Input
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>

          {capacityDecreased && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Capacity warning</AlertTitle>
              <AlertDescription>
                New capacity is below currently used capacity ({departure.capacity_used}).
                Departure will be marked overbooked.
              </AlertDescription>
            </Alert>
          )}

          {capacityDecreased && (
            <div className="space-y-2">
              <Label>Reason for capacity reduction *</Label>
              <Input
                value={capacityReason}
                onChange={(e) => setCapacityReason(e.target.value)}
                placeholder="Required"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            disabled={loading || (needsPrivilege && (dateChanged || capacityDecreased))}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseConfirmModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Departure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to close this departure? No new reservations
            can be added after closing.
          </p>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm(reason || undefined);
              onClose();
            }}
          >
            Close Departure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
