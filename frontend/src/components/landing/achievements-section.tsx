import { Card, CardContent } from "@/components/ui/card"
import { achievements } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { Section, SectionHeading } from "./section"
import { TONE_TILE } from "./tone-styles"

export function AchievementsSection() {
  return (
    <Section id="achievements" muted>
      <SectionHeading
        eyebrow="Trusted by families across Dhaka"
        title="Results that speak for themselves"
        description="Fifteen years of steady board results, admission successes and guardians who send us their younger children too."
      />

      <div className="mt-32 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
        {achievements.map((item) => (
          <Card
            key={item.label}
            className="reveal rounded-lg border-border/70 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            <CardContent className="flex flex-col gap-6">
              <span
                className={cn(
                  "flex size-22 items-center justify-center rounded-lg",
                  TONE_TILE[item.tone]
                )}
              >
                <item.icon className="size-11" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-2">
                <span className="font-heading text-3xl leading-none font-bold text-foreground">
                  {item.value}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {item.label}
                </span>
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.caption}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}
