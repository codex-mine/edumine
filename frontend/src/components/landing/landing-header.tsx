"use client"

import Link from "next/link"
import { useState } from "react"
import { GraduationCap, Menu, X } from "lucide-react"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import { institute, navLinks } from "@/lib/landing-content"

import { Container } from "./section"

export function LandingHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-32 items-center justify-between gap-8">
        <Link
          href="#top"
          className="flex items-center gap-5 rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-18 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-10" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-base font-bold text-foreground">
              MyOne
            </span>
            <span className="text-xs text-muted-foreground">Coaching Center</span>
          </span>
          <span className="sr-only">{institute.name} — home</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-2">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="rounded px-6 py-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">Student Login</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="#enroll">Enroll Now</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X className="size-10" aria-hidden="true" />
            ) : (
              <Menu className="size-10" aria-hidden="true" />
            )}
          </Button>
        </div>
      </Container>

      {open && (
        <nav
          id="landing-mobile-nav"
          aria-label="Primary (mobile)"
          className="border-t border-border bg-card lg:hidden"
        >
          <Container className="flex flex-col gap-2 py-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded px-6 py-5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-4 sm:hidden">
              <Button asChild variant="outline">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Student Login
                </Link>
              </Button>
              <Button asChild>
                <Link href="#enroll" onClick={() => setOpen(false)}>
                  Enroll Now
                </Link>
              </Button>
            </div>
          </Container>
        </nav>
      )}
    </header>
  )
}
