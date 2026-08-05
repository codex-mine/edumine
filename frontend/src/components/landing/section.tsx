import { cn } from "@/lib/utils"

/** Consistent horizontal rhythm for every landing section. */
export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-8 sm:px-12 lg:px-16", className)}
      {...props}
    />
  )
}

interface SectionProps extends React.ComponentProps<"section"> {
  /** Anchor target for the in-page navigation. */
  id?: string
  /** Renders the section on the muted background instead of the page background. */
  muted?: boolean
}

export function Section({
  className,
  muted = false,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        "scroll-mt-32 py-32 md:py-48",
        muted && "bg-muted/40",
        className
      )}
      {...props}
    >
      <Container>{children}</Container>
    </section>
  )
}

interface SectionHeadingProps {
  /** Small label above the title, e.g. "Popular Courses". */
  eyebrow: string
  title: string
  description?: string
  /** `h2` everywhere except where the document outline needs otherwise. */
  as?: "h2" | "h3"
  align?: "center" | "start"
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Heading = "h2",
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "reveal flex max-w-3xl flex-col gap-6",
        align === "center" && "mx-auto items-center text-center",
        className
      )}
    >
      <span className="inline-flex items-center gap-3 rounded-lg bg-primary/10 px-6 py-2 text-xs font-semibold tracking-wide text-primary uppercase">
        {eyebrow}
      </span>
      <Heading className="font-heading text-3xl leading-tight font-bold text-balance text-foreground sm:text-4xl">
        {title}
      </Heading>
      {description && (
        <p className="text-base leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
