"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { priceBooksApi } from "@/lib/api-client";
import { hasRole } from "@/lib/utils";
import type { PriceBook } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function PriceBooksPage() {
  const { role } = useAuth();
  const [books, setBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await priceBooksApi.list();
      setBooks(res.data);
    } catch {
      toast.error("Failed to load price books");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
        title="Price Books"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New Price Book
          </Button>
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <Card key={book.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {book.name}
                  <Badge variant="outline">{book.currency}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={book.active ? "success" : "secondary"}>
                  {book.active ? "Active" : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePriceBookModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={load}
      />
    </div>
  );
}

function CreatePriceBookModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [currency, setCurrency] = useState("USD");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setLoading(true);
    try {
      await priceBooksApi.create({ currency, name });
      toast.success("Price book created");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to create price book");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Price Book</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Currency *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="ARS">ARS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. default" />
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
