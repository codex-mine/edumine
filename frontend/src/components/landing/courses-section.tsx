import Link from "next/link"
import { ArrowRight, CalendarDays, Clock, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { courses, type Course } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { MediaPlaceholder } from "./media-placeholder"
import { Section, SectionHeading } from "./section"
import { TONE_HOVER_BORDER } from "./tone-styles"

function CourseMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-4">
      <Icon className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs text-muted-foreground">
        <span className="sr-only">{label}: </span>
        {value}
      </span>
    </div>
  )
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Card
      className={cn(
        "reveal group h-full gap-0 rounded-lg border-border/70 pt-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
        TONE_HOVER_BORDER[course.tone]
      )}
    >
      <div className="relative">
        <MediaPlaceholder
          label={`${course.title} course photograph`}
          icon={course.icon}
          tone={course.tone}
          className="h-88 w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute top-6 left-6 flex gap-3">
          <Badge variant="muted" className="bg-background/85 backdrop-blur-sm">
            {course.level}
          </Badge>
          {course.popular && <Badge variant="warning">Popular</Badge>}
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-6 py-8">
        <h3 className="font-heading text-lg font-semibold text-foreground">
          {course.title}
        </h3>
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          {course.description}
        </p>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
          <CourseMeta icon={Clock} label="Duration" value={course.duration} />
          <CourseMeta icon={Users} label="Batch size" value={course.batchSize} />
          <CourseMeta
            icon={CalendarDays}
            label="Starting date"
            value={course.startingDate}
          />
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-6">
        <span className="flex flex-col">
          <span className="font-heading text-lg leading-none font-bold text-foreground">
            {course.price}
          </span>
          <span className="text-xs text-muted-foreground">
            {course.priceNote}
          </span>
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href="#enroll">
            <span className="sr-only">Enroll in {course.title} — </span>
            Enroll
            <ArrowRight className="size-7" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export function CoursesSection() {
  return (
    <Section id="courses" muted>
      <SectionHeading
        eyebrow="Popular Courses"
        title="Find the batch that fits your goal"
        description="From Class 9 foundations to university admission sprints — each course runs on a fixed syllabus calendar with weekly assessment built in."
      />

      <div className="mt-32 grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </Section>
  )
}
