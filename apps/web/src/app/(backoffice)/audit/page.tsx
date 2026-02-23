"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auditApi } from "@/lib/api-client";
import { formatDateTime, hasRole, formatShortId } from "@/lib/utils";
import type { AuditEntry } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function AuditPage() {
  const { role } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entityType, setEntityType] = useState("all");
  const [entityId, setEntityId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        from: from || undefined,
        to: to || undefined,
        entity_type: entityType !== "all" ? entityType : undefined,
        entity_id: entityId || undefined,
        page,
        page_size: 50,
      });
      setEntries(res.data);
      setTotal(res.meta.total);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [from, to, entityType, entityId, page]);

  useEffect(() => { setPage(1); }, [from, to, entityType, entityId]);
  useEffect(() => { load(); }, [load]);

  if (!hasRole(role ?? "", "STAFF_PRICING")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You don&apos;t have permission to view the audit log.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Log" description="View all critical business events" />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-lg border bg-background">
        <div className="flex items-center gap-2">
          <Label className="text-sm">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="reservation">Reservation</SelectItem>
            <SelectItem value="departure">Departure</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Entity ID</Label>
          <Input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="UUID..."
            className="w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No audit entries found.</div>
      ) : (
        <>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === entry.id ? null : entry.id)
                      }
                    >
                      <TableCell>
                        {expanded === entry.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(entry.created_at)}</TableCell>
                      <TableCell className="capitalize">{entry.entity_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatShortId(entry.entity_id)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{entry.action}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatShortId(entry.created_by)}
                      </TableCell>
                    </TableRow>
                    {expanded === entry.id && entry.changes && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <pre className="text-xs overflow-auto max-h-48 p-3 rounded">
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Showing {entries.length} of {total} entries</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={entries.length < 50} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
