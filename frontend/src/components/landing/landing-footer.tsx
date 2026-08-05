import Link from "next/link"
import { Clock, GraduationCap, Mail, MapPin, Phone } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { footerGroups, institute } from "@/lib/landing-content"

import { Container } from "./section"
import {
  FacebookIcon,
  LinkedinIcon,
  WhatsappIcon,
  YoutubeIcon,
  type BrandIcon,
} from "./social-icons"

const SOCIAL_LINKS: readonly { label: string; href: string; icon: BrandIcon }[] =
  [
    { label: "Facebook", href: "https://facebook.com", icon: FacebookIcon },
    { label: "YouTube", href: "https://youtube.com", icon: YoutubeIcon },
    { label: "WhatsApp", href: "https://wa.me/8801711000111", icon: WhatsappIcon },
    { label: "LinkedIn", href: "https://linkedin.com", icon: LinkedinIcon },
  ]

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Refund Policy", href: "#" },
] as const

export function LandingFooter() {
  return (
    <footer id="contact" className="scroll-mt-32 border-t border-border bg-card">
      <Container className="py-32">
        <div className="grid gap-24 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr] lg:gap-16">
          {/* About */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-5">
              <span className="flex size-18 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-10" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-heading text-base font-bold text-foreground">
                  MyOne
                </span>
                <span className="text-xs text-muted-foreground">
                  Coaching Center
                </span>
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Since {institute.established}, MyOne Coaching Center has guided
              students through SSC, HSC and university admission with structured
              teaching, weekly assessment and teachers who know every student by
              name.
            </p>
            <ul className="flex gap-4">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex size-18 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors outline-none hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <social.icon className="size-9" />
                    <span className="sr-only">
                      {institute.name} on {social.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link groups */}
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-heading text-sm font-semibold text-foreground">
                {group.title}
              </h2>
              <ul className="mt-8 flex flex-col gap-4">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="rounded text-sm text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Contact */}
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Contact
            </h2>
            <address className="mt-8 flex flex-col gap-5 text-sm not-italic text-muted-foreground">
              <p className="flex items-start gap-4">
                <MapPin className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
                <span>{institute.address}</span>
              </p>
              <p className="flex items-start gap-4">
                <Phone className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
                <span className="flex flex-col">
                  <a
                    href={`tel:${institute.phone.replace(/\s/g, "")}`}
                    className="rounded transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {institute.phone}
                  </a>
                  <a
                    href={`tel:${institute.altPhone.replace(/\s/g, "")}`}
                    className="rounded transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {institute.altPhone}
                  </a>
                </span>
              </p>
              <p className="flex items-start gap-4">
                <Mail className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${institute.email}`}
                  className="rounded break-all transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {institute.email}
                </a>
              </p>
              <p className="flex items-start gap-4">
                <Clock className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
                <span>{institute.officeHours}</span>
              </p>
            </address>
          </div>
        </div>

        <Separator className="my-16" />

        <div className="flex flex-col items-center justify-between gap-8 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {institute.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3">
            {LEGAL_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="rounded transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  )
}
