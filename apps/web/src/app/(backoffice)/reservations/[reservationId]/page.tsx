"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { reservationsApi, auditApi } from "@/lib/api-client";
import {
  formatCurrency,
  formatDateTime,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  ADJUSTMENT_TYPE_LABELS,
  TOUR_ITEM_KIND_LABELS,
  CHARGE_TYPE_LABELS,
  hasRole,
  formatShortId,
} from "@/lib/utils";
import type {
  ReservationDetail,
  ReservationItem,
  AuditEntry,
  CurrencyCode,
} from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function ReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const reservationId = params.reservationId as string;

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reservationsApi.get(reservationId);
      setReservation(res.data);
    } catch {
      toast.error("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  const loadAudit = useCallback(async () => {
    if (!hasRole(role ?? "", "STAFF_PRICING")) return;
    try {
      const res = await auditApi.list({
        entity_type: "reservation",
        entity_id: reservationId,
        page_size: 50,
      });
      setAuditEntries(res.data);
    } catch {
      // silently fail
    }
  }, [reservationId, role]);

  useEffect(() => {
    load();
    loadAudit();
  }, [load, loadAudit]);

  if (loading || !reservation) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const { totals } = reservation;
  const isOverpaid = totals.net_paid > totals.total_final;
  const canCancelPaid = ["PAID", "CONFIRMED"].includes(reservation.status) && hasRole(role ?? "", "OWNER");
  const canCancelBasic = ["RESERVED", "PARTIALLY_PAID"].includes(reservation.status) && hasRole(role ?? "", "STAFF");
  const canReopen = reservation.status === "CANCELLED" && hasRole(role ?? "", "OWNER");
  const canConfirm = reservation.status === "PAID" && hasRole(role ?? "", "STAFF");
  const canRecordPayment = reservation.status !== "CANCELLED" && hasRole(role ?? "", "STAFF");
  const canAddAdjustment = reservation.status !== "CANCELLED" && hasRole(role ?? "", "STAFF_PRICING");

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/reservations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Reservations
        </Link>
      </div>

      <PageHeader
        title={`Reservation #${formatShortId(reservation.id)}`}
        actions={
          <div className="flex gap-2">
            {canConfirm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStatusModal(true)}
              >
                Confirm
              </Button>
            )}
            {canReopen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStatusModal(true)}
              >
                Reopen
              </Button>
            )}
            {(canCancelBasic || canCancelPaid) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowCancelModal(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        }
      />

      {/* Header Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Status", value: <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RESERVATION_STATUS_COLORS[reservation.status]}`}>{RESERVATION_STATUS_LABELS[reservation.status]}</span> },
          { label: "Customer", value: reservation.customer.full_name },
          { label: "Tour", value: reservation.departure?.tour?.name ?? "—" },
          { label: "Departure", value: reservation.departure?.start_at ? formatDateTime(reservation.departure.start_at) : "—" },
          { label: "Currency", value: reservation.currency },
          { label: "Override", value: reservation.capacity_override ? <Badge variant="warning">Yes</Badge> : <span className="text-muted-foreground text-sm">No</span> },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className="font-medium mt-1">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Totals */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            {[
              { label: "Snapshot Total", value: formatCurrency(totals.total_snapshot, reservation.currency as CurrencyCode) },
              { label: "Final Total", value: formatCurrency(totals.total_final, reservation.currency as CurrencyCode) },
              { label: "Total Paid", value: formatCurrency(totals.total_paid, reservation.currency as CurrencyCode) },
              { label: "Total Refunded", value: formatCurrency(totals.total_refunded, reservation.currency as CurrencyCode) },
              { label: "Net Paid", value: formatCurrency(totals.net_paid, reservation.currency as CurrencyCode) },
              { label: "Balance Due", value: <span className={totals.balance_due > 0 ? "text-destructive font-semibold" : "text-green-600 font-semibold"}>{formatCurrency(totals.balance_due, reservation.currency as CurrencyCode)}</span> },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-muted-foreground">{label}</p>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>
          {isOverpaid && (
            <Badge variant="info" className="mt-2">Overpaid</Badge>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="mb-4">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="passengers">Passengers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          {canAddAdjustment && <TabsTrigger value="adjustments">Adjustments</TabsTrigger>}
          {hasRole(role ?? "", "STAFF_PRICING") && <TabsTrigger value="audit">Audit</TabsTrigger>}
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Charge</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservation.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name_snapshot}</TableCell>
                      <TableCell>{TOUR_ITEM_KIND_LABELS[item.kind_snapshot]}</TableCell>
                      <TableCell>{CHARGE_TYPE_LABELS[item.charge_type_snapshot]}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price_snapshot, reservation.currency as CurrencyCode)}</TableCell>
                      <TableCell>{formatCurrency(item.total_price_snapshot, reservation.currency as CurrencyCode)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Passengers Tab */}
        <TabsContent value="passengers">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Birth Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservation.passengers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.first_name} {p.last_name}</TableCell>
                      <TableCell className="font-mono text-sm">{p.document_id}</TableCell>
                      <TableCell>{p.category_code}</TableCell>
                      <TableCell>{p.birth_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Payments</CardTitle>
              {canRecordPayment && (
                <Button size="sm" onClick={() => setShowPaymentModal(true)}>
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {reservation.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservation.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{formatCurrency(p.amount, p.currency as CurrencyCode)}</TableCell>
                        <TableCell>{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                        <TableCell>{p.reference ?? "—"}</TableCell>
                        <TableCell>{formatDateTime(p.received_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Refunds</CardTitle>
              {canRecordPayment && reservation.payments.length > 0 && (
                <Button size="sm" onClick={() => setShowRefundModal(true)}>
                  <Plus className="h-4 w-4" />
                  Add Refund
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {reservation.refunds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No refunds recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservation.refunds.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{formatCurrency(r.amount, reservation.currency as CurrencyCode)}</TableCell>
                        <TableCell>{r.reason}</TableCell>
                        <TableCell>{formatDateTime(r.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustments Tab */}
        {canAddAdjustment && (
          <TabsContent value="adjustments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Adjustments</CardTitle>
                <Button size="sm" onClick={() => setShowAdjustmentModal(true)}>
                  <Plus className="h-4 w-4" />
                  Add Adjustment
                </Button>
              </CardHeader>
              <CardContent>
                {reservation.adjustments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No adjustments applied.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservation.adjustments.map((adj) => (
                        <TableRow key={adj.id}>
                          <TableCell>{ADJUSTMENT_TYPE_LABELS[adj.type]}</TableCell>
                          <TableCell>{adj.amount}{adj.type === "DISCOUNT_PERCENT" ? "%" : ""}</TableCell>
                          <TableCell>{adj.reason}</TableCell>
                          <TableCell>{formatDateTime(adj.created_at)}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={async () => {
                                try {
                                  await reservationsApi.deleteAdjustment(adj.id);
                                  toast.success("Adjustment deleted");
                                  load();
                                } catch {
                                  toast.error("Failed to delete adjustment");
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Audit Tab */}
        {hasRole(role ?? "", "STAFF_PRICING") && (
          <TabsContent value="audit">
            <Card>
              <CardContent className="pt-4">
                {auditEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit entries.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDateTime(e.created_at)}</TableCell>
                          <TableCell>{e.action}</TableCell>
                          <TableCell className="font-mono text-xs">{formatShortId(e.created_by)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Modals */}
      <CancelModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={async (reason) => {
          try {
            await reservationsApi.changeStatus(reservationId, { status: "CANCELLED", reason });
            toast.success("Reservation cancelled");
            load();
          } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error?.message ?? "Failed to cancel");
          }
        }}
        isPaidCancel={canCancelPaid && !canCancelBasic}
      />

      <AddPaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        currency={reservation.currency}
        onAdded={async (data) => {
          try {
            await reservationsApi.addPayment(reservationId, data);
            toast.success("Payment recorded");
            load();
          } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error?.message ?? "Failed to record payment");
          }
        }}
      />

      <AddRefundModal
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        payments={reservation.payments}
        currency={reservation.currency}
        onAdded={async (paymentId, data) => {
          try {
            await reservationsApi.addRefund(paymentId, data);
            toast.success("Refund recorded");
            load();
          } catch (err: unknown) {
            const error = err as { message?: string; code?: string };
            if (error?.code === "refund_exceeds_payment") {
              toast.error("Refund exceeds payment amount");
            } else {
              toast.error(error?.message ?? "Failed to record refund");
            }
          }
        }}
      />

      <AddAdjustmentModal
        open={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        items={reservation.items}
        currency={reservation.currency}
        currentTotal={totals.total_final}
        onAdded={async (data) => {
          try {
            await reservationsApi.addAdjustment(reservationId, data);
            toast.success("Adjustment applied");
            load();
          } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error?.message ?? "Failed to add adjustment");
          }
        }}
      />

      <StatusChangeModal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        currentStatus={reservation.status}
        onConfirm={async (status, reason) => {
          try {
            await reservationsApi.changeStatus(reservationId, { status, reason });
            toast.success(`Status changed to ${status}`);
            load();
          } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error?.message ?? "Failed to change status");
          }
        }}
      />
    </div>
  );
}

function CancelModal({ open, onClose, onConfirm, isPaidCancel }: {
  open: boolean; onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isPaidCancel: boolean;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Reservation</DialogTitle>
        </DialogHeader>
        {isPaidCancel && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Paid reservation</AlertTitle>
            <AlertDescription>
              Payments remain recorded. Accounting consistency is maintained.
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label>Reason *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancellation"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            variant="destructive"
            disabled={!reason.trim() || loading}
            onClick={async () => {
              setLoading(true);
              await onConfirm(reason);
              setLoading(false);
              onClose();
            }}
          >
            {loading ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPaymentModal({ open, onClose, currency, onAdded }: {
  open: boolean; onClose: () => void; currency: string;
  onAdded: (data: { amount: number; currency: string; method: string; reference?: string; received_at: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input value={currency} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional reference" />
          </div>
          <div className="space-y-2">
            <Label>Received At</Label>
            <Input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={!amount || Number(amount) <= 0 || loading}
            onClick={async () => {
              setLoading(true);
              await onAdded({ amount: Number(amount), currency, method, reference: reference || undefined, received_at: new Date(receivedAt).toISOString() });
              setLoading(false);
              onClose();
            }}
          >
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRefundModal({ open, onClose, payments, currency, onAdded }: {
  open: boolean; onClose: () => void;
  payments: ReservationDetail["payments"];
  currency: string;
  onAdded: (paymentId: string, data: { amount: number; reason: string }) => Promise<void>;
}) {
  const [paymentId, setPaymentId] = useState(payments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPayment = payments.find((p) => p.id === paymentId);
  const alreadyRefunded = selectedPayment?.refunds?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const maxRefund = selectedPayment ? selectedPayment.amount - alreadyRefunded : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Refund</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Payment *</Label>
            <Select value={paymentId} onValueChange={setPaymentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {payments.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {formatCurrency(p.amount, currency as CurrencyCode)} — {PAYMENT_METHOD_LABELS[p.method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPayment && (
            <p className="text-sm text-muted-foreground">
              Refundable: {formatCurrency(maxRefund, currency as CurrencyCode)}
            </p>
          )}
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              min="0.01"
              max={maxRefund}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={!amount || Number(amount) <= 0 || Number(amount) > maxRefund || !reason.trim() || loading}
            onClick={async () => {
              setLoading(true);
              await onAdded(paymentId, { amount: Number(amount), reason });
              setLoading(false);
              onClose();
            }}
          >
            {loading ? "Recording..." : "Record Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAdjustmentModal({ open, onClose, items, currency, currentTotal, onAdded }: {
  open: boolean; onClose: () => void;
  items: ReservationItem[];
  currency: string;
  currentTotal: number;
  onAdded: (data: { reservation_item_id: string; type: string; amount: number; reason: string }) => Promise<void>;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [type, setType] = useState("DISCOUNT_AMOUNT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Adjustment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Item *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name_snapshot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DISCOUNT_AMOUNT">Discount (Amount)</SelectItem>
                <SelectItem value="DISCOUNT_PERCENT">Discount (%)</SelectItem>
                <SelectItem value="SURCHARGE_AMOUNT">Surcharge (Amount)</SelectItem>
                <SelectItem value="OVERRIDE_UNIT_PRICE">Override Unit Price</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount * {type === "DISCOUNT_PERCENT" ? "(0–100%)" : `(${currency})`}</Label>
            <Input
              type="number"
              min="0"
              max={type === "DISCOUNT_PERCENT" ? 100 : undefined}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
          </div>
          <p className="text-sm text-muted-foreground">
            Current total: {formatCurrency(currentTotal, currency as CurrencyCode)}
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={!amount || !reason.trim() || loading}
            onClick={async () => {
              setLoading(true);
              await onAdded({ reservation_item_id: itemId, type, amount: Number(amount), reason });
              setLoading(false);
              onClose();
            }}
          >
            {loading ? "Applying..." : "Apply Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusChangeModal({ open, onClose, currentStatus, onConfirm }: {
  open: boolean; onClose: () => void; currentStatus: string;
  onConfirm: (status: string, reason?: string) => Promise<void>;
}) {
  const newStatus = currentStatus === "PAID" ? "CONFIRMED" : "RESERVED";
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change Status to {newStatus}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {newStatus === "CONFIRMED"
            ? "This will mark the reservation as confirmed."
            : "This will reopen the cancelled reservation. Capacity will be re-validated."}
        </p>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onConfirm(newStatus);
              setLoading(false);
              onClose();
            }}
          >
            {loading ? "Updating..." : `Set to ${newStatus}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
