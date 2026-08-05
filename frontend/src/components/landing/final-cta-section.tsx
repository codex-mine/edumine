import Link from "next/link"
import { ArrowRight, PhoneCall } from "lucide-react"

import { Button } from "@/components/ui/button"
import { institute } from "@/lib/landing-content"

import { Container } from "./section"

export function FinalCtaSection() {
  return (
    <section id="enroll" className="scroll-mt-32 py-32 md:py-48">
      <Container>
        <div className="reveal relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary via-primary to-info px-12 py-32 text-center text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:px-24 md:py-40">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -right-24 size-120 animate-drift rounded-full bg-white/12 blur-3xl" />
            <div className="absolute -bottom-32 -left-24 size-120 animate-drift-slow rounded-full bg-white/10 blur-3xl" />
            <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px]" />
          </div>

          <div className="relative flex flex-col items-center gap-10">
            <h2 className="font-heading text-3xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl">
              Start Your Learning Journey Today
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-pretty text-primary-foreground/85">
              Admission for the 2026 session is open. Reserve your seat now —
              batches are capped at 25 students and the popular ones fill early.
            </p>

            <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="secondary"
                className="h-24 bg-white px-12 text-base text-primary hover:bg-white/90"
              >
                <Link href="/signup">
                  Enroll Now
                  <ArrowRight className="size-8" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-24 border-white/40 bg-transparent px-12 text-base text-primary-foreground hover:bg-white/15 hover:text-primary-foreground dark:border-white/40 dark:bg-transparent dark:hover:bg-white/15"
              >
                <Link href="#contact">
                  <PhoneCall className="size-8" aria-hidden="true" />
                  Contact Us
                </Link>
              </Button>
            </div>

            <p className="text-sm text-primary-foreground/75">
              Or call us directly at{" "}
              <a
                href={`tel:${institute.phone.replace(/\s/g, "")}`}
                className="rounded font-semibold underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-white/50"
              >
                {institute.phone}
              </a>
            </p>
          </div>
        </div>
      </Container>
    </section>
  )
}
