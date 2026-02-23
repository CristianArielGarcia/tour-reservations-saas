"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tourItemsApi, toursApi } from "@/lib/api-client";
import {
  TOUR_ITEM_KIND_LABELS,
  CHARGE_TYPE_LABELS,
  hasRole,
} from "@/lib/utils";
import type { TourItem, Tour } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function TourItemsPage() {
  const params = useParams();
  const { role } = useAuth();
  const tourId = params.tourId as string;

  const [tour, setTour] = useState<Tour | null>(null);
  const [items, setItems] = useState<TourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TourItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tourRes, itemsRes] = await Promise.all([
        toursApi.get(tourId),
        tourItemsApi.list(tourId),
      ]);
      setTour(tourRes.data);
      setItems(itemsRes.data);
    } catch {
      toast.error("Failed to load tour items");
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => { load(); }, [load]);

  const canEdit = hasRole(role ?? "", "STAFF");

  return (
    <div>
      <div className="mb-4">
        <Link href={`/tours/${tourId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to {tour?.name ?? "Tour"}
        </Link>
      </div>

      <PageHeader
        title={`Items — ${tour?.name ?? "Tour"}`}
        actions={
          canEdit && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              New Item
            </Button>
          )
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No items yet.</div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Charge Type</TableHead>
                <TableHead>Optional</TableHead>
                <TableHead>Default Qty</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{TOUR_ITEM_KIND_LABELS[item.kind]}</TableCell>
                  <TableCell>{CHARGE_TYPE_LABELS[item.charge_type]}</TableCell>
                  <TableCell>
                    {item.is_optional ? (
                      <Badge variant="secondary">Optional</Badge>
                    ) : (
                      <Badge variant="info">Required</Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.default_quantity}</TableCell>
                  <TableCell>
                    <Badge variant={item.active ? "success" : "secondary"}>
                      {item.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setEditingItem(item)}>
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TourItemModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tourId={tourId}
        onSaved={load}
      />

      {editingItem && (
        <TourItemModal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          tourId={tourId}
          item={editingItem}
          onSaved={load}
        />
      )}
    </div>
  );
}

function TourItemModal({ open, onClose, tourId, item, onSaved }: {
  open: boolean; onClose: () => void; tourId: string;
  item?: TourItem; onSaved: () => void;
}) {
  const isEdit = !!item;
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState(item?.kind ?? "BASE");
  const [chargeType, setChargeType] = useState(item?.charge_type ?? "PER_PERSON");
  const [isOptional, setIsOptional] = useState(item?.is_optional ?? false);
  const [defaultQty, setDefaultQty] = useState(item?.default_quantity?.toString() ?? "1");
  const [active, setActive] = useState(item?.active ?? true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) { toast.error("Code and name are required"); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await tourItemsApi.update(item!.id, {
          name,
          is_optional: isOptional,
          active,
          default_quantity: Number(defaultQty),
        });
      } else {
        await tourItemsApi.create(tourId, {
          code,
          name,
          kind: kind as TourItem["kind"],
          charge_type: chargeType as TourItem["charge_type"],
          is_optional: isOptional,
          default_quantity: Number(defaultQty),
        });
      }
      toast.success(isEdit ? "Item updated" : "Item created");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "New Tour Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} />
          </div>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label>Kind *</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASE">Base</SelectItem>
                    <SelectItem value="FEE">Fee</SelectItem>
                    <SelectItem value="ADDON">Add-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Charge Type *</Label>
                <Select value={chargeType} onValueChange={setChargeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_PERSON">Per Person</SelectItem>
                    <SelectItem value="PER_BOOKING">Per Booking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Default Quantity</Label>
            <Input type="number" min={1} value={defaultQty} onChange={(e) => setDefaultQty(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="optional" checked={isOptional} onCheckedChange={(c) => setIsOptional(c === true)} />
            <Label htmlFor="optional" className="cursor-pointer">Optional (add-on type)</Label>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox id="item-active" checked={active} onCheckedChange={(c) => setActive(c === true)} />
              <Label htmlFor="item-active" className="cursor-pointer">Active</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
