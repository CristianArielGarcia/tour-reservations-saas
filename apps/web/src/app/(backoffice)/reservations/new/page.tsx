"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import {
  departuresApi,
  toursApi,
  tourItemsApi,
  passengerCategoriesApi,
  reservationsApi,
} from "@/lib/api-client";
import { formatCurrency, formatDateTime, hasRole } from "@/lib/utils";
import type {
  Departure,
  Tour,
  TourItem,
  PassengerCategory,
} from "@/types";
import { useAuth } from "@/lib/auth-context";
import { format, addDays } from "date-fns";

interface PassengerRow {
  id: string;
  first_name: string;
  last_name: string;
  document_id: string;
  birth_date: string;
  category_code: string;
  email: string;
  phone: string;
}

interface AddonRow {
  item_code: string;
  selected: boolean;
  quantity: number;
}

export default function NewReservationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuth();

  const presetDepartureId = searchParams.get("departure_id") ?? "";

  const [departures, setDepartures] = useState<Departure[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [tourItems, setTourItems] = useState<TourItem[]>([]);
  const [categories, setCategories] = useState<PassengerCategory[]>([]);

  const [departureId, setDepartureId] = useState(presetDepartureId);
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLodging, setCustomerLodging] = useState("");

  // Passengers
  const [passengers, setPassengers] = useState<PassengerRow[]>([
    {
      id: crypto.randomUUID(),
      first_name: "",
      last_name: "",
      document_id: "",
      birth_date: "",
      category_code: "",
      email: "",
      phone: "",
    },
  ]);

  // Addons
  const [addons, setAddons] = useState<AddonRow[]>([]);

  // Overbook
  const [capacityInfo, setCapacityInfo] = useState<{
    capacity_total: number;
    capacity_used: number;
    capacity_remaining: number;
  } | null>(null);
  const [overbookEnabled, setOverbookEnabled] = useState(false);
  const [overbookReason, setOverbookReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const future = format(addDays(new Date(), 90), "yyyy-MM-dd");
    Promise.all([
      departuresApi.list({ from: today, to: future }),
      toursApi.list(),
      passengerCategoriesApi.list(),
    ]).then(([deps, tours, cats]) => {
      setDepartures(deps.data.filter((d) => d.status === "ACTIVE"));
      setTours(tours.data);
      setCategories(cats.data.filter((c) => c.active));
    }).catch(() => {});
  }, []);

  const selectedDeparture = departures.find((d) => d.id === departureId);

  useEffect(() => {
    if (!departureId) {
      setTourItems([]);
      setAddons([]);
      setCapacityInfo(null);
      return;
    }

    const dep = departures.find((d) => d.id === departureId);
    if (!dep) return;

    setCapacityInfo({
      capacity_total: dep.capacity_total,
      capacity_used: dep.capacity_used,
      capacity_remaining: dep.capacity_remaining,
    });

    tourItemsApi.list(dep.tour_id).then((res) => {
      const items = res.data.filter((i) => i.active);
      setTourItems(items);
      const addonItems = items.filter((i) => i.kind === "ADDON" && i.is_optional);
      setAddons(addonItems.map((i) => ({
        item_code: i.code,
        selected: false,
        quantity: i.default_quantity,
      })));
    }).catch(() => {});
  }, [departureId, departures]);

  const addPassenger = () => {
    setPassengers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        first_name: "",
        last_name: "",
        document_id: "",
        birth_date: "",
        category_code: categories[0]?.code ?? "",
        email: "",
        phone: "",
      },
    ]);
  };

  const removePassenger = (id: string) => {
    setPassengers((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePassenger = (id: string, field: keyof PassengerRow, value: string) => {
    setPassengers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const occupiesCapacityCount = passengers.filter((p) => {
    const cat = categories.find((c) => c.code === p.category_code);
    return cat?.occupies_capacity !== false;
  }).length;

  const remainingAfter = capacityInfo
    ? capacityInfo.capacity_remaining - occupiesCapacityCount
    : null;

  const capacityExceeded = remainingAfter !== null && remainingAfter < 0;
  const canOverbook = hasRole(role ?? "", "STAFF_PRICING");

  const handleSubmit = async () => {
    if (!departureId) {
      toast.error("Please select a departure");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (passengers.length === 0) {
      toast.error("At least one passenger is required");
      return;
    }

    const docIds = passengers.map((p) => p.document_id);
    if (new Set(docIds).size !== docIds.length) {
      toast.error("Duplicate document IDs in passengers");
      return;
    }

    for (const p of passengers) {
      if (!p.first_name || !p.last_name || !p.document_id || !p.category_code) {
        toast.error("All passenger fields are required");
        return;
      }
    }

    if (capacityExceeded && !overbookEnabled) {
      toast.error("Capacity exceeded. Enable overbook override to proceed.");
      return;
    }

    if (capacityExceeded && overbookEnabled && !overbookReason.trim()) {
      toast.error("Overbook reason is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await reservationsApi.create({
        departure_id: departureId,
        currency,
        notes: notes || undefined,
        customer: {
          full_name: customerName,
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
          lodging_address: customerLodging || undefined,
        },
        passengers: passengers.map((p) => ({
          first_name: p.first_name,
          last_name: p.last_name,
          document_id: p.document_id,
          birth_date: p.birth_date || undefined,
          category_code: p.category_code,
          email: p.email || undefined,
          phone: p.phone || undefined,
        })),
        selected_addons: addons
          .filter((a) => a.selected)
          .map((a) => ({ tour_item_code: a.item_code, quantity: a.quantity })),
        capacity_override: {
          enabled: capacityExceeded && overbookEnabled,
          reason: overbookReason || undefined,
        },
      });

      toast.success("Reservation created successfully");
      router.push(`/reservations/${res.data.id}`);
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      if (error?.code === "capacity_exceeded") {
        toast.error("Capacity exceeded. Enable overbook override to proceed.");
      } else {
        toast.error(error?.message ?? "Failed to create reservation");
      }
    } finally {
      setSubmitting(false);
    }
  };

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

      <PageHeader title="New Reservation" />

      <div className="space-y-6 max-w-4xl">
        {/* A: Reservation Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A — Reservation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departure *</Label>
                <Select value={departureId} onValueChange={setDepartureId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select departure" />
                  </SelectTrigger>
                  <SelectContent>
                    {departures.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.tour?.name ?? "Tour"} — {formatDateTime(d.start_at)}
                        {d.is_overbooked ? " (OVERBOOKED)" : ` (${d.capacity_remaining} seats)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency *</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* B: Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">B — Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Lodging Address</Label>
                <Input
                  value={customerLodging}
                  onChange={(e) => setCustomerLodging(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* C: Passengers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              C — Passengers ({passengers.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addPassenger}>
              <Plus className="h-4 w-4" />
              Add Passenger
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {passengers.map((p, idx) => (
                <div key={p.id} className="border rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Passenger {idx + 1}
                    </span>
                    {passengers.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removePassenger(p.id)}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name *</Label>
                      <Input
                        value={p.first_name}
                        onChange={(e) =>
                          updatePassenger(p.id, "first_name", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name *</Label>
                      <Input
                        value={p.last_name}
                        onChange={(e) =>
                          updatePassenger(p.id, "last_name", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Document ID *</Label>
                      <Input
                        value={p.document_id}
                        onChange={(e) =>
                          updatePassenger(p.id, "document_id", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category *</Label>
                      <Select
                        value={p.category_code}
                        onValueChange={(v) =>
                          updatePassenger(p.id, "category_code", v)
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Birth Date</Label>
                      <Input
                        type="date"
                        value={p.birth_date}
                        onChange={(e) =>
                          updatePassenger(p.id, "birth_date", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* D: Addons */}
        {addons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">D — Optional Add-ons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {addons.map((addon) => {
                  const item = tourItems.find((i) => i.code === addon.item_code);
                  return (
                    <div
                      key={addon.item_code}
                      className="flex items-center gap-4"
                    >
                      <Checkbox
                        checked={addon.selected}
                        onCheckedChange={(c) =>
                          setAddons((prev) =>
                            prev.map((a) =>
                              a.item_code === addon.item_code
                                ? { ...a, selected: c === true }
                                : a
                            )
                          )
                        }
                      />
                      <span className="text-sm flex-1">
                        {item?.name ?? addon.item_code}
                      </span>
                      {addon.selected && (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            value={addon.quantity}
                            onChange={(e) =>
                              setAddons((prev) =>
                                prev.map((a) =>
                                  a.item_code === addon.item_code
                                    ? { ...a, quantity: Number(e.target.value) }
                                    : a
                                )
                              )
                            }
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* F: Capacity Preview */}
        {capacityInfo && departureId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">F — Capacity Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Capacity</p>
                  <p className="font-semibold">{capacityInfo.capacity_total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currently Used</p>
                  <p className="font-semibold">{capacityInfo.capacity_used}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">This Reservation</p>
                  <p className="font-semibold">{occupiesCapacityCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining After</p>
                  <p
                    className={`font-semibold ${remainingAfter !== null && remainingAfter < 0 ? "text-destructive" : ""}`}
                  >
                    {remainingAfter ?? "—"}
                  </p>
                </div>
              </div>

              {capacityExceeded && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Capacity exceeded</AlertTitle>
                  <AlertDescription>
                    This reservation exceeds the departure&apos;s capacity.
                    {canOverbook
                      ? " You can enable overbook override below."
                      : " Contact an authorized user to proceed."}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* G: Overbook override */}
        {capacityExceeded && canOverbook && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                G — Overbook Override
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="overbook-enable"
                  checked={overbookEnabled}
                  onCheckedChange={(c) => setOverbookEnabled(c === true)}
                />
                <Label htmlFor="overbook-enable" className="cursor-pointer">
                  Enable overbook override
                </Label>
              </div>
              {overbookEnabled && (
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={overbookReason}
                    onChange={(e) => setOverbookReason(e.target.value)}
                    placeholder="Reason for overbook authorization"
                    rows={2}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Pricing will be calculated automatically by the system based on the
            departure date, currency, and passenger categories.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="min-w-[120px]"
          >
            {submitting ? "Creating..." : "Create Reservation"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/reservations")}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
