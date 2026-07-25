"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props
  extends React.ComponentPropsWithoutRef<typeof Checkbox.Root> { }

export function CheckboxUi({
  className,
  ...props
}: Props) {
  return (
    <Checkbox.Root
      className={cn(
        "flex h-10 w-10 items-center justify-center ",
        "border-2 border-slate-300",
        "bg-white",
        "transition",
        "data-[state=checked]:border-indigo-600",
        "data-[state=checked]:bg-indigo-600",
        "focus:ring-4 focus:ring-indigo-100",
        className
      )}
      {...props}
    >
      <Checkbox.Indicator>
        <Check className="h-6 w-6 text-white" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}