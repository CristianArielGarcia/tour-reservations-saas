"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag, Grid3X3 } from "lucide-react";
import { toursApi } from "@/lib/api-client";
import type { Tour } from "@/types";
import { hasRole } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function PricingPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);

  useEffect(() => {
    toursApi.list({ active: true }).then((r) => setTours(r.data)).catch(() => {});
  }, []);

  if (!hasRole(role ?? "", "STAFF_PRICING")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You don&apos;t have permission to access pricing settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Manage price books and item pricing for your tours"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => router.push("/pricing/price-books")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Price Books
            </CardTitle>
            <CardDescription>Manage price books by currency</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm">Manage Price Books</Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Tour Item Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tours.map((tour) => (
            <Card key={tour.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tour.name}</CardTitle>
                {tour.code && <CardDescription>{tour.code}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/tours/${tour.id}/items`)}
                >
                  <Grid3X3 className="h-4 w-4" />
                  View Items
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Select a tour item from the items list to manage its prices and category rules.
        </p>
      </div>
    </div>
  );
}
