import { learningProcess } from "@/lib/landing-content"

import { Section, SectionHeading } from "./section"

export function LearningProcessSection() {
  return (
    <Section id="process">
      <SectionHeading
        eyebrow="Learning Process"
        title="Four steps from admission to result day"
        description="A predictable path every student follows, so you always know what comes next and what is expected of you."
      />

      <ol className="relative mt-36 grid gap-16 md:grid-cols-4 md:gap-12">
        {/* Desktop rail connecting the four milestones. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-11 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
        />

        {learningProcess.map((step) => (
          <li
            key={step.step}
            className="reveal group relative flex gap-8 after:absolute after:top-22 after:bottom-[-2.5rem] after:left-11 after:w-px after:bg-border last:after:hidden md:flex-col md:items-center md:gap-6 md:text-center md:after:hidden"
          >
            <span className="relative z-10 flex size-22 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <step.icon className="size-11" aria-hidden="true" />
            </span>

            <div className="flex flex-col gap-3 pb-4 md:items-center md:pb-0">
              <span className="text-xs font-bold tracking-widest text-primary">
                STEP {step.step}
              </span>
              <h3 className="font-heading text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}
