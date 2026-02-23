"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgencyPicker } from "@/components/auth/agency-picker";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { session, agencies, selectedAgency, loading } = useAuth();
  const [showAgencyPicker, setShowAgencyPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!loading && session) {
      if (agencies.length === 0) {
        // still loading agencies
      } else if (agencies.length === 1 || selectedAgency) {
        router.push("/dashboard");
      } else if (agencies.length > 1) {
        setShowAgencyPicker(true);
      }
    }
  }, [session, agencies, selectedAgency, loading, router]);

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Auth context will handle agency loading and redirect
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset email sent. Check your inbox.");
        setResetMode(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showAgencyPicker) {
    return (
      <AgencyPicker
        onSelect={() => {
          setShowAgencyPicker(false);
          router.push("/dashboard");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">TourReservations</CardTitle>
          <CardDescription>
            {resetMode ? "Reset your password" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(resetMode ? onResetPassword : onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Please wait..."
                : resetMode
                ? "Send reset email"
                : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setResetMode(!resetMode)}
              className="text-sm text-primary hover:underline"
            >
              {resetMode ? "Back to sign in" : "Forgot password?"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
