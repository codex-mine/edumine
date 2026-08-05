import Link from "next/link"
import { LifeBuoy } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { faqs, institute } from "@/lib/landing-content"

import { Section, SectionHeading } from "./section"

export function FaqSection() {
  return (
    <Section id="faq" muted>
      <SectionHeading
        eyebrow="FAQ"
        title="Questions guardians ask us most"
        description="Still unsure about something? Our admission desk answers calls seven days a week."
      />

      <div className="mt-32 grid gap-12 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-16">
        <Card className="reveal rounded-lg border-border/70">
          <CardContent className="py-2">
            <Accordion type="single" collapsible defaultValue="faq-0">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`}>
                  <AccordionTrigger className="font-heading text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="reveal rounded-lg border-border/70 lg:w-140">
          <CardContent className="flex flex-col gap-6">
            <span className="flex size-22 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LifeBuoy className="size-11" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Still have a question?
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Call our admission desk or drop by the Dhanmondi campus — we will
              walk you through batches, fees and scholarships in person.
            </p>
            <dl className="flex flex-col gap-2 text-sm">
              <dt className="sr-only">Phone</dt>
              <dd>
                <a
                  href={`tel:${institute.phone.replace(/\s/g, "")}`}
                  className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {institute.phone}
                </a>
              </dd>
              <dt className="sr-only">Office hours</dt>
              <dd className="text-muted-foreground">{institute.officeHours}</dd>
            </dl>
            <Button asChild variant="outline" className="w-fit">
              <Link href="#contact">Contact Us</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Section>
  )
}
