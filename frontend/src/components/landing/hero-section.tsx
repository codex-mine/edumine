import Link from "next/link"
import { ArrowRight, BadgeCheck, CalendarDays, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { heroStats, institute } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { Container } from "./section"
import { TONE_TILE } from "./tone-styles"

const TRUST_POINTS = [
  "Admission open for the 2026 session",
  "Free trial class for new students",
] as const

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Decorative background: soft gradient wash plus two drifting blobs. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />
        <div className="absolute -top-40 -right-32 size-160 animate-drift rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 size-160 animate-drift-slow rounded-full bg-info/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,var(--foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--foreground)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>

      <Container className="py-40 md:py-56">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 text-center">
          <span className="inline-flex animate-in items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-6 py-3 text-xs font-semibold text-primary fade-in slide-in-from-bottom-4 duration-500">
            <Sparkles className="size-8" aria-hidden="true" />
            15 years of academic excellence in Dhaka
          </span>

          <h1 className="animate-in font-heading text-4xl leading-[1.08] font-bold tracking-tight text-balance text-foreground duration-700 fade-in slide-in-from-bottom-6 sm:text-5xl lg:text-6xl">
            Learn Today.{" "}
            <span className="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
              Lead Tomorrow.
            </span>
          </h1>

          <p className="max-w-2xl animate-in text-base leading-relaxed text-pretty text-muted-foreground delay-100 duration-700 fade-in slide-in-from-bottom-6 sm:text-lg">
            {institute.description}
          </p>

          <div className="flex animate-in flex-col items-stretch gap-6 delay-200 duration-700 fade-in slide-in-from-bottom-6 sm:flex-row sm:items-center">
            <Button asChild className="h-24 px-12 text-base">
              <Link href="#enroll">
                Enroll Now
                <ArrowRight className="size-8" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-24 px-12 text-base">
              <Link href="#courses">Explore Courses</Link>
            </Button>
          </div>

          <ul className="flex animate-in flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-muted-foreground delay-300 duration-700 fade-in">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <BadgeCheck className="size-8 text-success" aria-hidden="true" />
                {point}
              </li>
            ))}
            <li className="flex items-center gap-3">
              <CalendarDays className="size-8 text-primary" aria-hidden="true" />
              Classes start 1 September
            </li>
          </ul>
        </div>

        <div className="mt-32 grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-12">
          {heroStats.map((stat, index) => (
            <Card
              key={stat.label}
              className={cn(
                "animate-in rounded-lg border-border/70 bg-card/80 backdrop-blur-sm duration-700 fade-in slide-in-from-bottom-8",
                index === 1 && "delay-100",
                index === 2 && "delay-200",
                index === 3 && "delay-300"
              )}
            >
              <CardContent className="flex flex-col items-center gap-4 py-4 text-center sm:flex-row sm:text-left">
                <span
                  className={cn(
                    "flex size-20 shrink-0 items-center justify-center rounded-lg",
                    TONE_TILE[stat.tone]
                  )}
                >
                  <stat.icon className="size-10" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-heading text-2xl leading-none font-bold text-foreground">
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </span>
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  )
}
