import type { Metadata } from "next"

import { AchievementsSection } from "@/components/landing/achievements-section"
import { CoursesSection } from "@/components/landing/courses-section"
import { EventsSection } from "@/components/landing/events-section"
import { FaqSection } from "@/components/landing/faq-section"
import { FinalCtaSection } from "@/components/landing/final-cta-section"
import { GallerySection } from "@/components/landing/gallery-section"
import { HeroSection } from "@/components/landing/hero-section"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHeader } from "@/components/landing/landing-header"
import { LearningProcessSection } from "@/components/landing/learning-process-section"
import { TeachersSection } from "@/components/landing/teachers-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"
import { WhyChooseUsSection } from "@/components/landing/why-choose-us-section"
import { courses, faqs, institute } from "@/lib/landing-content"

export const metadata: Metadata = {
  title: `${institute.name} — ${institute.tagline}`,
  description: institute.description,
  keywords: [
    "coaching center Dhaka",
    "SSC coaching",
    "HSC coaching",
    "university admission coaching Bangladesh",
    "MyOne Coaching Center",
  ],
  openGraph: {
    type: "website",
    title: `${institute.name} — ${institute.tagline}`,
    description: institute.description,
    siteName: institute.name,
    locale: "en_BD",
  },
  twitter: {
    card: "summary_large_image",
    title: `${institute.name} — ${institute.tagline}`,
    description: institute.description,
  },
  alternates: { canonical: "/" },
}

/**
 * Structured data so search engines can surface the institute, its courses and
 * the FAQ answers directly in results.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      name: institute.name,
      description: institute.description,
      foundingDate: String(institute.established),
      telephone: institute.phone,
      email: institute.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "House 42, Road 7, Dhanmondi",
        addressLocality: "Dhaka",
        postalCode: "1205",
        addressCountry: "BD",
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Courses",
        itemListElement: courses.map((course) => ({
          "@type": "Course",
          name: course.title,
          description: course.description,
          provider: { "@type": "EducationalOrganization", name: institute.name },
        })),
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ],
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        // Content is authored in-repo, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <a
        href="#main"
        className="sr-only rounded bg-primary px-6 py-3 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100"
      >
        Skip to main content
      </a>

      <LandingHeader />

      {/* The root layout already provides the <main> landmark, so this is a
          plain wrapper that only serves as the skip-link target. */}
      <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <HeroSection />
        <AchievementsSection />
        <WhyChooseUsSection />
        <CoursesSection />
        <LearningProcessSection />
        <TeachersSection />
        <TestimonialsSection />
        <GallerySection />
        <EventsSection />
        <FaqSection />
        <FinalCtaSection />
      </div>

      <LandingFooter />
    </div>
  )
}
