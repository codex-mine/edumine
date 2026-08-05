"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Quote, Star, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { testimonials } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { MediaPlaceholder } from "./media-placeholder"
import { Section, SectionHeading } from "./section"

const MAX_RATING = 5

function Rating({ value, name }: { value: number; name: string }) {
  return (
    <p className="flex items-center gap-1">
      <span className="sr-only">{`${name} rated us ${value} out of ${MAX_RATING} stars`}</span>
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(
            "size-8",
            index < value
              ? "fill-warning text-warning"
              : "fill-transparent text-border"
          )}
        />
      ))}
    </p>
  )
}

export function TestimonialsSection() {
  const trackRef = useRef<HTMLUListElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current
    const slide = track?.children[index] as HTMLElement | undefined
    if (!track || !slide) return
    track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" })
  }, [])

  // Keep the indicator in sync with native scrolling (touch swipe, trackpad,
  // keyboard) rather than only with the buttons.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const handleScroll = () => {
      const slides = Array.from(track.children) as HTMLElement[]
      const nearest = slides.reduce(
        (best, slide, index) =>
          Math.abs(slide.offsetLeft - track.scrollLeft) < best.distance
            ? { index, distance: Math.abs(slide.offsetLeft - track.scrollLeft) }
            : best,
        { index: 0, distance: Number.POSITIVE_INFINITY }
      )
      setActiveIndex(nearest.index)
    }

    track.addEventListener("scroll", handleScroll, { passive: true })
    return () => track.removeEventListener("scroll", handleScroll)
  }, [])

  const atStart = activeIndex === 0
  const atEnd = activeIndex >= testimonials.length - 1

  return (
    <Section id="testimonials">
      <div className="flex flex-col gap-16 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          align="start"
          eyebrow="Student Success Stories"
          title="The results our students are proudest of"
          description="Every story below belongs to a student who sat in one of our batches — in their own words."
          className="mx-0 text-left"
        />

        <div className="flex shrink-0 gap-4">
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={atStart}
            aria-label="Previous success story"
          >
            <ChevronLeft className="size-9" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={atEnd}
            aria-label="Next success story"
          >
            <ChevronRight className="size-9" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Student success stories"
        className="mt-24"
      >
        <ul
          ref={trackRef}
          tabIndex={0}
          aria-label="Success stories, scrollable"
          className="relative flex snap-x snap-mandatory gap-8 overflow-x-auto pb-8 outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/50 lg:gap-12 [&::-webkit-scrollbar]:hidden"
        >
          {testimonials.map((testimonial, index) => (
            <li
              key={testimonial.name}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${testimonials.length}`}
              className="w-full shrink-0 snap-start md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-1rem)]"
            >
              <Card className="h-full rounded-lg border-border/70">
                <CardContent className="flex h-full flex-col gap-8 py-4">
                  <Quote
                    className="size-12 text-primary/25"
                    aria-hidden="true"
                  />

                  <blockquote className="flex-1 text-sm leading-relaxed text-pretty text-foreground">
                    {testimonial.review}
                  </blockquote>

                  <Rating value={testimonial.rating} name={testimonial.name} />

                  <div className="flex items-center gap-6 border-t border-border pt-8">
                    <MediaPlaceholder
                      label={`Photograph of ${testimonial.name}`}
                      icon={UserRound}
                      tone={testimonial.tone}
                      className="size-24 shrink-0 rounded-full"
                      iconClassName="size-12"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <cite className="truncate text-sm font-semibold text-foreground not-italic">
                        {testimonial.name}
                      </cite>
                      <span className="truncate text-xs text-muted-foreground">
                        {testimonial.exam}
                      </span>
                      <Badge variant="success" className="mt-1">
                        {testimonial.achievement}
                      </Badge>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center gap-3">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.name}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to story ${index + 1}: ${testimonial.name}`}
              aria-current={index === activeIndex}
              className={cn(
                "h-3 rounded-full outline-none transition-all duration-200 focus-visible:ring-3 focus-visible:ring-ring/50",
                index === activeIndex
                  ? "w-12 bg-primary"
                  : "w-3 bg-border hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      </div>
    </Section>
  )
}
