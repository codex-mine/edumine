"use client";

import { ChevronRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NAV_GROUPS, containsActive, isNodeActive, resolveActiveHref, type NavNode } from "@/lib/auth/nav-config";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

/** Shared geometry for every row in the tree, so leaves and branch triggers
 * line up regardless of nesting depth. */
const ROW =
  "flex w-full items-center gap-4 rounded-md px-6 py-5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/60";
const ROW_IDLE =
  "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

function NavLeaf({
  node,
  depth,
  activeHref,
  onNavigate,
}: {
  node: NavNode & { href: string };
  depth: number;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const isActive = isNodeActive(node, activeHref);
  const Icon = node.icon;

  return (
    <Link
      href={node.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        ROW,
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_2px_6px_rgba(0,0,0,0.28)]"
          : ROW_IDLE
      )}
    >
      <Icon className={cn("shrink-0", depth === 0 ? "size-8" : "size-7")} aria-hidden="true" />
      <span className="truncate">{node.label}</span>
    </Link>
  );
}

function NavBranch({
  node,
  depth,
  pathname,
  activeHref,
  onNavigate,
}: {
  node: NavNode;
  depth: number;
  pathname: string;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const holdsActive = containsActive(node, activeHref);
  // A branch defaults to open while it holds the current route. A manual toggle
  // overrides that default, but only until the route changes — so navigating
  // never leaves the active item buried in a closed branch, and an unrelated
  // branch the user once peeked into does not spring back open on arrival
  // (e.g. Academics reopening every time you land on /admin/teachers).
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [toggledAt, setToggledAt] = useState(pathname);
  if (toggledAt !== pathname) {
    setToggledAt(pathname);
    setManualOpen(null);
  }
  const open = manualOpen ?? holdsActive;
  const Icon = node.icon;

  return (
    <Collapsible open={open} onOpenChange={setManualOpen} className="flex flex-col">
      <CollapsibleTrigger
        className={cn(
          ROW,
          "cursor-pointer",
          holdsActive && !open
            ? "bg-sidebar-accent/60 text-sidebar-foreground"
            : open
              ? "text-sidebar-foreground hover:bg-sidebar-accent"
              : ROW_IDLE
        )}
      >
        <Icon className={cn("shrink-0", depth === 0 ? "size-8" : "size-7")} aria-hidden="true" />
        <span className="flex-1 truncate">{node.label}</span>
        {holdsActive && !open ? (
          <span className="size-3 shrink-0 rounded-full bg-sidebar-primary" aria-hidden="true" />
        ) : null}
        <ChevronRight
          className={cn(
            "size-7 shrink-0 opacity-60 transition-transform duration-200",
            open && "rotate-90"
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div
          className={cn(
            "mt-1 ml-7 flex flex-col gap-1 border-l pl-3",
            holdsActive ? "border-sidebar-primary/40" : "border-sidebar-border"
          )}
        >
          {node.children?.map((child) => (
            <NavTreeNode
              key={child.href ?? child.label}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              activeHref={activeHref}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavTreeNode({
  node,
  depth,
  pathname,
  activeHref,
  onNavigate,
}: {
  node: NavNode;
  depth: number;
  pathname: string;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  if (node.children?.length) {
    return (
      <NavBranch node={node} depth={depth} pathname={pathname} activeHref={activeHref} onNavigate={onNavigate} />
    );
  }
  if (!node.href) return null;
  return (
    <NavLeaf
      node={node as NavNode & { href: string }}
      depth={depth}
      activeHref={activeHref}
      onNavigate={onNavigate}
    />
  );
}

function SidebarContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS[role];
  // Resolved once per render for the whole tree: highlighting a node is a
  // question about the tree as a whole (which href is the most specific match),
  // not one a node can answer on its own.
  const activeHref = resolveActiveHref(groups, pathname);

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-4 border-b border-sidebar-border px-6 text-base font-semibold whitespace-nowrap text-sidebar-foreground">
        <Image
          src="/logo.png"
          alt="Codex Edumine Logo"
          width={32}
          height={32}
          className="size-16 rounded-md"
        />
        <span className="truncate">Codex Edumine</span>
      </div>
      <nav className="scrollbar-slim [--scrollbar-thumb:var(--sidebar-accent)] [--scrollbar-thumb-hover:#4a516a] flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-6 pt-4 pb-1 text-[0.6875rem] font-semibold tracking-[0.09em] text-sidebar-foreground/40 uppercase">
              {group.label}
            </span>
            {group.items.map((item) => (
              <NavTreeNode
                key={item.href ?? item.label}
                node={item}
                depth={0}
                pathname={pathname}
                activeHref={activeHref}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

export function DashboardSidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden h-dvh w-[16rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex">
      <SidebarContent role={role} />
    </aside>
  );
}

export function MobileSidebarDrawer({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-transform",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent role={role} onNavigate={() => onOpenChange(false)} />
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2.5 right-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => onOpenChange(false)}
          aria-label="Close navigation menu"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </aside>
    </div>
  );
}
