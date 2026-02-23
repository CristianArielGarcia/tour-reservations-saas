"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toursApi } from "@/lib/api-client";
import { hasRole } from "@/lib/utils";
import type { Tour } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const tourId = params.tourId as string;

  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await toursApi.get(tourId);
      const t = res.data;
      setTour(t);
      setName(t.name);
      setDescription(t.description ?? "");
      setDuration(t.duration_minutes?.toString() ?? "");
      setActive(t.active);
    } catch {
      toast.error("Failed to load tour");
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await toursApi.update(tourId, {
        name,
        description: description || undefined,
        duration_minutes: duration ? Number(duration) : undefined,
        active,
      });
      toast.success("Tour updated");
      setEditing(false);
      load();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to update tour");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tour) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const canEdit = hasRole(role ?? "", "STAFF");

  return (
    <div>
      <div className="mb-4">
        <Link href="/tours" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to Tours
        </Link>
      </div>

      <PageHeader
        title={tour.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`/tours/${tourId}/items`)}>
              <Settings className="h-4 w-4" />
              Manage Items
            </Button>
            {canEdit && !editing && (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Tour Details
            <Badge variant={tour.active ? "success" : "secondary"}>
              {tour.active ? "Active" : "Inactive"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="active"
                  checked={active}
                  onCheckedChange={(c) => setActive(c === true)}
                />
                <Label htmlFor="active" className="cursor-pointer">Active</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => {
                  setEditing(false);
                  setName(tour.name);
                  setDescription(tour.description ?? "");
                  setDuration(tour.duration_minutes?.toString() ?? "");
                  setActive(tour.active);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              {[
                { label: "Code", value: tour.code ?? "—" },
                { label: "Name", value: tour.name },
                { label: "Description", value: tour.description ?? "—" },
                { label: "Duration", value: tour.duration_minutes ? `${tour.duration_minutes} minutes` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="grid grid-cols-3 gap-2">
                  <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                  <dd className="text-sm col-span-2">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
