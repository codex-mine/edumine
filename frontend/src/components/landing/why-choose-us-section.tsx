import { Card, CardContent } from "@/components/ui/card"
import { features } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { Section, SectionHeading } from "./section"
import { TONE_HOVER_BORDER, TONE_TILE } from "./tone-styles"

export function WhyChooseUsSection() {
  return (
    <Section id="why-choose-us">
      <SectionHeading
        eyebrow="Why Choose Us"
        title="Built around how students actually learn"
        description="Every part of our programme exists to solve a problem students told us about — from batches too large to ask a question in, to guardians left guessing about progress."
      />

      <div className="mt-32 grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className={cn(
              "reveal group h-full rounded-lg border-border/70 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
              TONE_HOVER_BORDER[feature.tone]
            )}
          >
            <CardContent className="flex h-full flex-col gap-6 py-4">
              <span
                className={cn(
                  "flex size-22 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                  TONE_TILE[feature.tone]
                )}
              >
                <feature.icon className="size-11" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}
