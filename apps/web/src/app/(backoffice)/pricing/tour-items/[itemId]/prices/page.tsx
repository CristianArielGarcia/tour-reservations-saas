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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { tourItemPricesApi, priceBooksApi } from "@/lib/api-client";
import { formatDate, formatCurrency, hasRole } from "@/lib/utils";
import type { TourItemPrice, PriceBook, CurrencyCode } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function ItemPricesPage() {
  const params = useParams();
  const { role } = useAuth();
  const itemId = params.itemId as string;

  const [prices, setPrices] = useState<TourItemPrice[]>([]);
  const [books, setBooks] = useState<PriceBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<TourItemPrice | null>(null);

  useEffect(() => {
    priceBooksApi.list().then((r) => {
      setBooks(r.data);
      if (r.data.length > 0) setSelectedBookId(r.data[0].id);
    }).catch(() => {});
  }, []);

  const loadPrices = useCallback(async () => {
    if (!selectedBookId) return;
    setLoading(true);
    try {
      const res = await tourItemPricesApi.list(itemId, selectedBookId);
      setPrices(res.data);
    } catch {
      toast.error("Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, [itemId, selectedBookId]);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  const selectedBook = books.find((b) => b.id === selectedBookId);

  if (!hasRole(role ?? "", "STAFF_PRICING")) {
    return <div className="text-muted-foreground">Insufficient permissions.</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/pricing" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to Pricing
        </Link>
      </div>

      <PageHeader
        title="Item Price Ranges"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New Price Range
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-4">
        <Label>Price Book</Label>
        <Select value={selectedBookId} onValueChange={setSelectedBookId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select price book" />
          </SelectTrigger>
          <SelectContent>
            {books.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} ({b.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : prices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No prices defined for this period.</div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid To</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((price) => (
                <TableRow key={price.id}>
                  <TableCell>{formatDate(price.valid_from)}</TableCell>
                  <TableCell>{price.valid_to ? formatDate(price.valid_to) : "∞"}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(price.unit_price, (selectedBook?.currency ?? "USD") as CurrencyCode)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={price.active ? "success" : "secondary"}>
                      {price.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {price.active && !price.valid_to && (
                        <Button size="sm" variant="outline" onClick={() => setShowCloseModal(price)}>
                          Close Range
                        </Button>
                      )}
                      {price.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await tourItemPricesApi.update(price.id, { active: false });
                              toast.success("Price disabled");
                              loadPrices();
                            } catch {
                              toast.error("Failed to disable price");
                            }
                          }}
                        >
                          Disable
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreatePriceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        itemId={itemId}
        priceBookId={selectedBookId}
        onCreated={loadPrices}
      />

      <ClosePriceModal
        price={showCloseModal}
        onClose={() => setShowCloseModal(null)}
        onClosed={loadPrices}
      />
    </div>
  );
}

function CreatePriceModal({ open, onClose, itemId, priceBookId, onCreated }: {
  open: boolean; onClose: () => void; itemId: string; priceBookId: string; onCreated: () => void;
}) {
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!validFrom || !unitPrice) { toast.error("Valid from and unit price are required"); return; }
    setLoading(true);
    setError("");
    try {
      await tourItemPricesApi.create(itemId, {
        price_book_id: priceBookId,
        valid_from: validFrom,
        valid_to: validTo || undefined,
        unit_price: Number(unitPrice),
      });
      toast.success("Price range created");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      if (error?.code === "pricing_overlap") {
        setError("This price overlaps an existing validity range.");
      } else {
        setError(error?.message ?? "Failed to create price range");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Price Range</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label>Valid From *</Label>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valid To (leave empty for open-ended)</Label>
            <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Unit Price *</Label>
            <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleCreate} disabled={loading}>{loading ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClosePriceModal({ price, onClose, onClosed }: {
  price: TourItemPrice | null; onClose: () => void; onClosed: () => void;
}) {
  const [validTo, setValidTo] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={!!price} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Close Price Range</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Valid To *</Label>
          <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            disabled={!validTo || loading}
            onClick={async () => {
              if (!price) return;
              setLoading(true);
              try {
                await tourItemPricesApi.close(price.id, { valid_to: validTo });
                toast.success("Price range closed");
                onClosed();
                onClose();
              } catch {
                toast.error("Failed to close price range");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Closing..." : "Close Range"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
