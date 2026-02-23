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
import { categoryRulesApi, passengerCategoriesApi } from "@/lib/api-client";
import { hasRole } from "@/lib/utils";
import type { CategoryRule, PassengerCategory } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function CategoryRulesPage() {
  const params = useParams();
  const { role } = useAuth();
  const itemId = params.itemId as string;

  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<PassengerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, catsRes] = await Promise.all([
        categoryRulesApi.list(itemId),
        passengerCategoriesApi.list(),
      ]);
      setRules(rulesRes.data);
      setCategories(catsRes.data);
    } catch {
      toast.error("Failed to load category rules");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  if (!hasRole(role ?? "", "STAFF_PRICING")) {
    return <div className="text-muted-foreground">Insufficient permissions.</div>;
  }

  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.name ?? catId;
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/pricing" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to Pricing
        </Link>
      </div>

      <PageHeader
        title="Category Multiplier Rules"
        description="Override the base multiplier for specific passenger categories"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No category rules defined. Base multipliers from passenger categories are used.
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {rule.passenger_category?.name ?? getCategoryName(rule.passenger_category_id)}
                  </TableCell>
                  <TableCell>{rule.multiplier}x</TableCell>
                  <TableCell>
                    <Badge variant={rule.active ? "success" : "secondary"}>
                      {rule.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditingRule(rule)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryRuleModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        itemId={itemId}
        categories={categories}
        existingRules={rules}
        onSaved={load}
      />

      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function CategoryRuleModal({ open, onClose, itemId, categories, existingRules, onSaved }: {
  open: boolean; onClose: () => void; itemId: string;
  categories: PassengerCategory[]; existingRules: CategoryRule[]; onSaved: () => void;
}) {
  const existingCatIds = existingRules.map((r) => r.passenger_category_id);
  const availableCats = categories.filter((c) => !existingCatIds.includes(c.id));

  const [categoryId, setCategoryId] = useState(availableCats[0]?.id ?? "");
  const [multiplier, setMultiplier] = useState("0");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!categoryId) { toast.error("Category is required"); return; }
    setLoading(true);
    try {
      await categoryRulesApi.create(itemId, {
        passenger_category_id: categoryId,
        multiplier: Number(multiplier),
      });
      toast.success("Rule created");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to create rule");
    } finally {
      setLoading(false);
    }
  };

  if (availableCats.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category Rule</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All categories already have rules for this item.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Category Rule</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Passenger Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Multiplier * (0 = free, 1 = full price, 0.5 = half)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
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

function EditRuleModal({ rule, onClose, onSaved }: {
  rule: CategoryRule; onClose: () => void; onSaved: () => void;
}) {
  const [multiplier, setMultiplier] = useState(rule.multiplier.toString());
  const [active, setActive] = useState(rule.active);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await categoryRulesApi.update(rule.id, {
        multiplier: Number(multiplier),
        active,
      });
      toast.success("Rule updated");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to update rule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!rule} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Category Rule</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Multiplier</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rule-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="rule-active" className="cursor-pointer">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
