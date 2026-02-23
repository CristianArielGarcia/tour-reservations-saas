"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toursApi } from "@/lib/api-client";
import { hasRole } from "@/lib/utils";
import type { Tour } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function ToursPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await toursApi.list();
      setTours(res.data);
    } catch {
      toast.error("Failed to load tours");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Tours"
        actions={
          hasRole(role ?? "", "STAFF") && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              New Tour
            </Button>
          )
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : tours.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No tours found.</div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Duration (min)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tours.map((tour) => (
                <TableRow
                  key={tour.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/tours/${tour.id}`)}
                >
                  <TableCell className="font-mono text-xs">{tour.code ?? "—"}</TableCell>
                  <TableCell className="font-medium">{tour.name}</TableCell>
                  <TableCell>{tour.duration_minutes ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={tour.active ? "success" : "secondary"}>
                      {tour.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/tours/${tour.id}/items`);
                      }}
                    >
                      Manage Items
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateTourModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(id) => router.push(`/tours/${id}`)}
      />
    </div>
  );
}

function CreateTourModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setLoading(true);
    try {
      const res = await toursApi.create({
        name,
        code: code || undefined,
        description: description || undefined,
        duration_minutes: duration ? Number(duration) : undefined,
      });
      toast.success("Tour created");
      onCreated(res.data.id);
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to create tour");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Tour</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Code (optional, unique)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PENGUIN_WALK" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
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
