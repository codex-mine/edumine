"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, KeyRound, Monitor, Moon, Palette, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/shared/error-state";
import { ProfileInfoCard } from "@/components/modules/profile/profile-shell";
import { loginErrorMessage, useChangePasswordMutation } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/lib/validators/auth";
import { useAuth } from "@/providers/auth-provider";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server render cannot know the stored preference, so the selection is
  // only read after mount — same reason as in ThemeToggle.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col gap-2">
      <Label>Theme</Label>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = mounted && theme === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={isSelected ? "default" : "outline"}
              onClick={() => setTheme(option.value)}
              aria-pressed={isSelected}
              className={cn(!mounted && "opacity-70")}
            >
              <Icon className="size-8" aria-hidden="true" />
              {option.label}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        &quot;System&quot; follows your device&apos;s appearance setting. The choice is remembered on this browser.
      </p>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  disabled,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: string;
  disabled: boolean;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<ChangePasswordFormValues>>["register"]>;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!error}
          className="pr-12"
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
          className="absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground transition hover:text-foreground"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="size-10" /> : <Eye className="size-10" />}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ChangePasswordForm() {
  const { mutateAsync, isPending, error, isSuccess } = useChangePasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    try {
      await mutateAsync({ currentPassword: values.currentPassword, newPassword: values.password });
    } catch {
      // surfaced through `error` below
    }
  }

  // The mutation drops the cached session on success, which sends the dashboard
  // layout to /login. This only shows during that hand-off.
  if (isSuccess) {
    return (
      <div className="flex items-center gap-3 rounded border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="size-10 shrink-0" aria-hidden="true" />
        Password changed. Signing you out — please log in with your new password.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
        disabled={isPending}
        error={errors.currentPassword?.message}
        registration={register("currentPassword")}
      />
      <PasswordField
        id="newPassword"
        label="New password"
        autoComplete="new-password"
        disabled={isPending}
        error={errors.password?.message}
        registration={register("password")}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        disabled={isPending}
        error={errors.confirmPassword?.message}
        registration={register("confirmPassword")}
      />

      {error && <ErrorState message={loginErrorMessage(error)} />}

      <p className="text-xs text-muted-foreground">
        Changing your password signs you out everywhere, including this device. You will need to log in again with the
        new password.
      </p>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  receptionist: "Receptionist",
  staff: "Staff",
  student: "Student",
  guardian: "Guardian",
};

export function AccountSettingsView() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage how you sign in and how Codex Edumine looks.</p>
      </div>

      <ProfileInfoCard
        title="Your account"
        icon={UserRound}
        description="Read-only — the institute maintains these records."
        fields={[
          { label: "Name", value: user.full_name },
          { label: "Role", value: ROLE_LABELS[user.role] ?? user.role },
          { label: "Phone", value: user.phone },
          { label: "Email", value: user.email },
        ]}
      >
        <Button variant="outline" size="sm" asChild className="w-fit">
          <Link href="/profile">View my profile</Link>
        </Button>
      </ProfileInfoCard>

      <ProfileInfoCard title="Password" icon={KeyRound} description="Choose a new password for your account.">
        <ChangePasswordForm />
      </ProfileInfoCard>

      <ProfileInfoCard title="Appearance" icon={Palette} description="Applies to this browser only.">
        <ThemeSetting />
      </ProfileInfoCard>
    </div>
  );
}
