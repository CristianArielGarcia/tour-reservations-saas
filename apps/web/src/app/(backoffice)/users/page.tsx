"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
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
import { agenciesApi } from "@/lib/api-client";
import { ROLE_LABELS, hasRole } from "@/lib/utils";
import type { AgencyUser } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function UsersPage() {
  const { role, selectedAgency } = useAuth();
  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AgencyUser | null>(null);

  const agencyId = selectedAgency?.id ?? "";

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const res = await agenciesApi.listUsers(agencyId);
      setUsers(res.data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  if (!hasRole(role ?? "", "OWNER")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Only owners can manage users.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage who has access to your agency"
        actions={
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="h-4 w-4" />
            Invite User
          </Button>
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No users yet.</div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "success" : "secondary"}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditingUser(user)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteUserModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        agencyId={agencyId}
        onInvited={load}
      />

      {editingUser && (
        <EditUserModal
          user={editingUser}
          agencyId={agencyId}
          onClose={() => setEditingUser(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function InviteUserModal({ open, onClose, agencyId, onInvited }: {
  open: boolean; onClose: () => void; agencyId: string; onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      await agenciesApi.inviteUser(agencyId, { email, role });
      toast.success("User invited successfully");
      onInvited();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to invite user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="STAFF_PRICING">Staff (Pricing)</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleInvite} disabled={loading}>{loading ? "Inviting..." : "Send Invite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserModal({ user, agencyId, onClose, onSaved }: {
  user: AgencyUser; agencyId: string; onClose: () => void; onSaved: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await agenciesApi.updateUser(agencyId, user.user_id, { role, status });
      toast.success("User updated");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error?.message ?? "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit User: {user.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="STAFF_PRICING">Staff (Pricing)</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
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
