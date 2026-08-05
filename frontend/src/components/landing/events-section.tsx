import Link from "next/link"
import { Clock, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { events } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { Section, SectionHeading } from "./section"
import { TONE_HOVER_BORDER, TONE_TILE } from "./tone-styles"

export function EventsSection() {
  return (
    <Section id="events">
      <SectionHeading
        eyebrow="Upcoming Events"
        title="Come and see us before you decide"
        description="Seminars, guidance sessions and free model tests you can attend without enrolling — bring your guardians along."
      />

      <ul className="mt-32 grid gap-8 md:grid-cols-2 lg:gap-12">
        {events.map((event) => (
          <li key={event.title}>
            <Card
              className={cn(
                "reveal h-full rounded-lg border-border/70 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
                TONE_HOVER_BORDER[event.tone]
              )}
            >
              <CardContent className="flex gap-8 py-4">
                <time
                  dateTime={event.date.iso}
                  className={cn(
                    "flex size-32 shrink-0 flex-col items-center justify-center rounded-lg",
                    TONE_TILE[event.tone]
                  )}
                >
                  <span className="font-heading text-2xl leading-none font-bold">
                    {event.date.day}
                  </span>
                  <span className="mt-1 text-xs font-semibold tracking-wide uppercase">
                    {event.date.month}
                  </span>
                </time>

                <div className="flex min-w-0 flex-1 flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {event.title}
                    </h3>
                    <Badge variant="muted">{event.badge}</Badge>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>

                  <dl className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <dt className="sr-only">Time</dt>
                      <Clock className="size-7 shrink-0" aria-hidden="true" />
                      <dd>{event.time}</dd>
                    </div>
                    <div className="flex items-center gap-4">
                      <dt className="sr-only">Location</dt>
                      <MapPin className="size-7 shrink-0" aria-hidden="true" />
                      <dd>{event.location}</dd>
                    </div>
                  </dl>

                  <Button asChild size="sm" variant="outline" className="mt-2 w-fit">
                    <Link href="#enroll">
                      <span className="sr-only">Register for {event.title} — </span>
                      Register
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}
