"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
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
import { passengerCategoriesApi } from "@/lib/api-client";
import { hasRole } from "@/lib/utils";
import type { PassengerCategory } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function PassengerCategoriesPage() {
  const { role } = useAuth();
  const [categories, setCategories] = useState<PassengerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PassengerCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await passengerCategoriesApi.list();
      setCategories(res.data);
    } catch {
      toast.error("Failed to load passenger categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canEdit = hasRole(role ?? "", "STAFF");

  return (
    <div>
      <PageHeader
        title="Passenger Categories"
        description="Define passenger types with age ranges and pricing multipliers"
        actions={
          canEdit && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          )
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No passenger categories yet.</div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age Range</TableHead>
                <TableHead>Base Multiplier</TableHead>
                <TableHead>Occupies Capacity</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-mono text-xs">{cat.code}</TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    {cat.min_age_years !== undefined && cat.max_age_years !== undefined
                      ? `${cat.min_age_years}–${cat.max_age_years}`
                      : cat.min_age_years !== undefined
                      ? `${cat.min_age_years}+`
                      : "Any"}
                  </TableCell>
                  <TableCell>{cat.base_price_multiplier}x</TableCell>
                  <TableCell>
                    <Badge variant={cat.occupies_capacity ? "info" : "secondary"}>
                      {cat.occupies_capacity ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cat.active ? "success" : "secondary"}>
                      {cat.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCategory(cat)}>
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

      <PassengerCategoryModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={load}
      />

      {editingCategory && (
        <PassengerCategoryModal
          open={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          category={editingCategory}
          onSaved={load}
        />
      )}
    </div>
  );
}

function PassengerCategoryModal({ open, onClose, category, onSaved }: {
  open: boolean; onClose: () => void; category?: PassengerCategory; onSaved: () => void;
}) {
  const isEdit = !!category;
  const [code, setCode] = useState(category?.code ?? "");
  const [name, setName] = useState(category?.name ?? "");
  const [minAge, setMinAge] = useState(category?.min_age_years?.toString() ?? "");
  const [maxAge, setMaxAge] = useState(category?.max_age_years?.toString() ?? "");
  const [multiplier, setMultiplier] = useState(category?.base_price_multiplier?.toString() ?? "1");
  const [occupiesCapacity, setOccupiesCapacity] = useState(category?.occupies_capacity ?? true);
  const [active, setActive] = useState(category?.active ?? true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) { toast.error("Code and name are required"); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await passengerCategoriesApi.update(category!.id, {
          name,
          base_price_multiplier: Number(multiplier),
          occupies_capacity: occupiesCapacity,
          active,
          min_age_years: minAge ? Number(minAge) : undefined,
          max_age_years: maxAge ? Number(maxAge) : undefined,
        });
      } else {
        await passengerCategoriesApi.create({
          code,
          name,
          base_price_multiplier: Number(multiplier),
          occupies_capacity: occupiesCapacity,
          min_age_years: minAge ? Number(minAge) : undefined,
          max_age_years: maxAge ? Number(maxAge) : undefined,
        });
      }
      toast.success(isEdit ? "Category updated" : "Category created");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "New Passenger Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Code * (unique)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="ADULT" />
          </div>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adult" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Age (years)</Label>
              <Input type="number" min={0} value={minAge} onChange={(e) => setMinAge(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Max Age (years)</Label>
              <Input type="number" min={0} value={maxAge} onChange={(e) => setMaxAge(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Base Price Multiplier (1 = full price)</Label>
            <Input
              type="number"
              min="0"
              max="10"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="occupies"
              checked={occupiesCapacity}
              onCheckedChange={(c) => setOccupiesCapacity(c === true)}
            />
            <Label htmlFor="occupies" className="cursor-pointer">Occupies capacity seat</Label>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="cat-active"
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
              />
              <Label htmlFor="cat-active" className="cursor-pointer">Active</Label>
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
