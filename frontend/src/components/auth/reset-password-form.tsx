"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ErrorState } from "@/components/shared/error-state";

import { useResetPasswordMutation, loginErrorMessage } from "@/hooks/use-auth";

import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/lib/validators/auth";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const { mutateAsync, isPending, error, isSuccess } = useResetPasswordMutation();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) return;
    try {
      await mutateAsync({ token, newPassword: values.password });
    } catch {
      // error is surfaced via `error` below
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md border-none px-10 py-14 shadow">
        <CardHeader className="mb-4 px-0 text-center">
          <CardTitle className="text-2xl font-bold">Invalid reset link</CardTitle>
          <CardDescription>
            This password reset link is missing its token. Please request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 text-center">
          <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md border-none px-10 py-14 shadow">
        <CardHeader className="mb-4 px-0 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Password reset</CardTitle>
          <CardDescription>Your password has been updated. You can now log in with it.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 text-center">
          <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Go to login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none px-10 py-14 shadow">
      <CardHeader className="mb-8 px-0 text-center">
        <CardTitle className="text-3xl font-bold">Reset your password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a new password"
                autoComplete="new-password"
                disabled={isPending}
                aria-invalid={!!errors.password}
                className="pr-12"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                disabled={isPending}
                aria-invalid={!!errors.confirmPassword}
                className="pr-12"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 transition hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && <ErrorState message={loginErrorMessage(error)} />}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
