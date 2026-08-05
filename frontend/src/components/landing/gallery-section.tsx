import { gallery } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { MediaPlaceholder } from "./media-placeholder"
import { Section, SectionHeading } from "./section"

export function GallerySection() {
  return (
    <Section id="gallery" muted>
      <SectionHeading
        eyebrow="Gallery"
        title="A look inside our campus"
        description="Classrooms, laboratories and the events that make a coaching centre feel like a second home."
      />

      {/* Spans are chosen so the mosaic tiles exactly at every breakpoint:
          the hero tile is 2×2 and the closing tile runs full width. */}
      <ul className="mt-32 grid auto-rows-[11rem] grid-cols-1 gap-8 sm:grid-cols-2 sm:auto-rows-[12rem] lg:grid-cols-4 lg:gap-12">
        {gallery.map((item) => (
          <li
            key={item.title}
            className={cn("reveal group relative row-span-1", item.span)}
          >
            <MediaPlaceholder
              label={`${item.title} — ${item.caption}`}
              icon={item.icon}
              tone={item.tone}
              className="size-full rounded-lg border border-border/70 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
              iconClassName="transition-transform duration-300 group-hover:scale-110"
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-8 pt-16">
                <p className="font-heading text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">{item.caption}</p>
              </div>
            </MediaPlaceholder>
          </li>
        ))}
      </ul>
    </Section>
  )
}
