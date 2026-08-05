import { BriefcaseBusiness, GraduationCap, UserRound } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { teachers } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { MediaPlaceholder } from "./media-placeholder"
import { Section, SectionHeading } from "./section"
import { TONE_HOVER_BORDER } from "./tone-styles"

export function TeachersSection() {
  return (
    <Section id="teachers" muted>
      <SectionHeading
        eyebrow="Our Teachers"
        title="Learn from people who have been there"
        description="Our faculty come from Dhaka University, BUET, Dhaka Medical College and leading government colleges — and every one of them teaches their own subject, every day."
      />

      <ul className="mt-32 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
        {teachers.map((teacher) => (
          <li key={teacher.name}>
            <Card
              className={cn(
                "reveal group h-full gap-0 rounded-lg border-border/70 pt-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
                TONE_HOVER_BORDER[teacher.tone]
              )}
            >
              <MediaPlaceholder
                label={`Portrait of ${teacher.name}`}
                icon={UserRound}
                tone={teacher.tone}
                className="h-96 w-full transition-transform duration-300 group-hover:scale-[1.03]"
                iconClassName="size-32"
              />

              <CardContent className="flex flex-col gap-5 py-8">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    {teacher.name}
                  </h3>
                  <Badge>{teacher.subject}</Badge>
                </div>

                <dl className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <dt className="sr-only">Experience</dt>
                    <BriefcaseBusiness
                      className="size-8 shrink-0"
                      aria-hidden="true"
                    />
                    <dd>{teacher.experience}</dd>
                  </div>
                  <div className="flex items-start gap-4">
                    <dt className="sr-only">Qualification</dt>
                    <GraduationCap
                      className="mt-0.5 size-8 shrink-0"
                      aria-hidden="true"
                    />
                    <dd>{teacher.qualification}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}
