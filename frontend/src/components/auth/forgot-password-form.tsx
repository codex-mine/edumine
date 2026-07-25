"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
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

import { useForgotPasswordMutation, loginErrorMessage } from "@/hooks/use-auth";

import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/lib/validators/auth";

export function ForgotPasswordForm() {
  const { mutateAsync, isPending, error, isSuccess } = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await mutateAsync(values.email);
    } catch {
      // error is surfaced via `error` below
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md border-none px-10 py-14 shadow">
        <CardHeader className="mb-4 px-0 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <MailCheck className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            If an account with that email exists, we&apos;ve sent a password reset link to it.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 text-center">
          <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Back to login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none px-10 py-14 shadow">
      <CardHeader className="mb-8 px-0 text-center">
        <CardTitle className="text-3xl font-bold">Forgot password?</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link.</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@institute.edu"
              autoComplete="email"
              disabled={isPending}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          {error && <ErrorState message={loginErrorMessage(error)} />}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-10 text-center">
          Remembered your password?{" "}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
