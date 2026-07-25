"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckboxUi } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ErrorState } from "@/components/shared/error-state";

import { useAuth } from "@/providers/auth-provider";

import {
  loginSchema,
  type LoginFormValues,
} from "@/lib/validators/auth";

export function LoginForm() {
  const router = useRouter();

  const { login, isLoggingIn, loginError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const { rememberMe, ...credentials } = values;

      // You can use rememberMe later if needed.
      console.log("Remember Me:", rememberMe);

      const user = await login(credentials);

      router.replace(`/${user.role}`);
    } catch {
      // loginError is handled by AuthProvider
    }
  }

  return (
    <Card className="w-full max-w-md border-none px-10 py-14 shadow">
      <CardHeader className="mb-8 px-0 text-center">
        <CardTitle className="text-3xl font-bold">
          Welcome back
        </CardTitle>

        <CardDescription>
          Enter your details to access your institute dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
        >
          {/* Email */}
          <div className="space-y-2 mt-10">
            <Label htmlFor="identifier">
              Phone or Email
            </Label>

            <Input
              id="identifier"
              placeholder="name@institute.edu"
              autoComplete="username"
              disabled={isLoggingIn}
              aria-invalid={!!errors.identifier}
              {...register("identifier")}
            />

            {errors.identifier && (
              <p className="text-sm text-destructive">
                {errors.identifier.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2 mt-10">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                Password
              </Label>

              <Link
                href="/forgot-password"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoggingIn}
                aria-invalid={!!errors.password}
                className="pr-12"
                {...register("password")}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-10">
            <div className="flex items-center gap-3">
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }) => (
                  <CheckboxUi
                    id="remember-me"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    disabled={isLoggingIn}
                  />
                )}
              />

              <Label
                htmlFor="remember-me"
                className="cursor-pointer font-normal my-6"
              >
                Remember me
              </Label>
            </div>
          </div>

          {/* Login Error */}
          {loginError && (
            <ErrorState message={loginError} />
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoggingIn}
            className=" w-full "
          >
            {isLoggingIn
              ? "Signing in..."
              : "Sign In"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-10 text-center">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="text-indigo-600 hover:text-indigo-700"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}