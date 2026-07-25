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

import { useRegisterStudentMutation, loginErrorMessage } from "@/hooks/use-auth";

import {
  registerStudentSchema,
  type RegisterStudentFormValues,
} from "@/lib/validators/auth";

export function SignupForm() {
  const { mutateAsync, isPending, error, isSuccess } = useRegisterStudentMutation();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterStudentFormValues>({
    resolver: zodResolver(registerStudentSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterStudentFormValues) {
    try {
      await mutateAsync({
        full_name: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
    } catch {
      // error is surfaced via `error` below
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md border-none px-10 py-14 shadow">
        <CardHeader className="mb-4 px-0 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Registration submitted</CardTitle>
          <CardDescription>
            An administrator will review and activate your account. You&apos;ll be able to log in once it&apos;s
            approved.
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
        <CardTitle className="text-3xl font-bold">Create your account</CardTitle>
        <CardDescription>Student sign up — your account will be activated by an administrator.</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              placeholder="Jane Doe"
              autoComplete="name"
              disabled={isPending}
              aria-invalid={!!errors.fullName}
              {...register("fullName")}
            />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="01700000000"
              autoComplete="tel"
              disabled={isPending}
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
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
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
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
            {isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-10 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
