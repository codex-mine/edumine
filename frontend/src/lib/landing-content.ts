import {
  Award,
  BookMarked,
  BookOpen,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  Laptop,
  MessageSquareText,
  MonitorPlay,
  PartyPopper,
  Trophy,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * Single source of truth for every piece of copy on the landing page.
 * Each export mirrors the shape a CMS/API endpoint would return, so swapping
 * these constants for fetched data requires no changes to the components.
 */

export type Tone = "primary" | "success" | "warning" | "info"

export const institute = {
  name: "MyOne Coaching Center",
  tagline: "Learn Today. Lead Tomorrow.",
  description:
    "MyOne Coaching Center helps students achieve academic excellence with experienced teachers, structured courses, and personalized learning.",
  established: 2011,
  address: "House 42, Road 7, Dhanmondi, Dhaka 1205, Bangladesh",
  phone: "+880 1711-000 111",
  altPhone: "+880 1811-000 222",
  email: "admission@myonecoaching.edu.bd",
  officeHours: "Saturday – Thursday, 9:00 AM – 8:00 PM",
} as const

export interface NavLink {
  label: string
  href: string
}

export const navLinks: readonly NavLink[] = [
  { label: "Why Us", href: "#why-choose-us" },
  { label: "Courses", href: "#courses" },
  { label: "Teachers", href: "#teachers" },
  { label: "Events", href: "#events" },
  { label: "FAQ", href: "#faq" },
]

export interface Stat {
  label: string
  value: string
  icon: LucideIcon
  tone: Tone
}

/** Compact stat strip rendered inside the hero. */
export const heroStats: readonly Stat[] = [
  { label: "Happy Students", value: "5,000+", icon: Users, tone: "primary" },
  { label: "Expert Teachers", value: "50+", icon: GraduationCap, tone: "info" },
  { label: "Success Rate", value: "95%", icon: Trophy, tone: "success" },
  { label: "Years of Excellence", value: "15", icon: Award, tone: "warning" },
]

export interface Achievement extends Stat {
  caption: string
}

export const achievements: readonly Achievement[] = [
  {
    label: "Students Taught",
    value: "5,000+",
    caption: "Enrolled across SSC, HSC and admission programmes since 2011.",
    icon: Users,
    tone: "primary",
  },
  {
    label: "Success Rate",
    value: "95%",
    caption: "Students securing A or A+ in their board examinations.",
    icon: Trophy,
    tone: "success",
  },
  {
    label: "Expert Teachers",
    value: "50+",
    caption: "Faculty from DU, BUET, DMC and leading government colleges.",
    icon: GraduationCap,
    tone: "info",
  },
  {
    label: "Years of Experience",
    value: "15",
    caption: "A decade and a half of consistent board and admission results.",
    icon: Award,
    tone: "warning",
  },
]

export interface Feature {
  title: string
  description: string
  icon: LucideIcon
  tone: Tone
}

export const features: readonly Feature[] = [
  {
    title: "Experienced Faculty",
    description:
      "Every subject is led by a specialist with 8+ years of board and admission coaching behind them.",
    icon: GraduationCap,
    tone: "primary",
  },
  {
    title: "Small Batch Size",
    description:
      "Batches are capped at 25 students so no question goes unanswered and every student is known by name.",
    icon: Users,
    tone: "info",
  },
  {
    title: "Weekly Exams",
    description:
      "Chapter-wise tests every week with same-day OMR evaluation and a detailed answer discussion class.",
    icon: ClipboardCheck,
    tone: "success",
  },
  {
    title: "Smart Classrooms",
    description:
      "Air-conditioned rooms with multimedia projectors that turn abstract concepts into visual explanations.",
    icon: MonitorPlay,
    tone: "warning",
  },
  {
    title: "Digital Learning Materials",
    description:
      "Printed lecture sheets plus a student portal with recorded classes, notes and question banks.",
    icon: Laptop,
    tone: "primary",
  },
  {
    title: "Parent Progress Tracking",
    description:
      "Guardians get SMS attendance alerts and a monthly progress report card through the parent portal.",
    icon: UserCheck,
    tone: "info",
  },
]

export interface Course {
  id: string
  title: string
  level: string
  description: string
  duration: string
  batchSize: string
  startingDate: string
  price: string
  priceNote: string
  icon: LucideIcon
  tone: Tone
  popular?: boolean
}

export const courses: readonly Course[] = [
  {
    id: "ssc-science",
    title: "SSC Science",
    level: "Class 9–10",
    description:
      "Full syllabus coverage for Physics, Chemistry, Biology and Higher Math with board-standard model tests.",
    duration: "12 months",
    batchSize: "25 students",
    startingDate: "1 Sep 2026",
    price: "৳2,500",
    priceNote: "per month",
    icon: FlaskConical,
    tone: "primary",
    popular: true,
  },
  {
    id: "hsc-science",
    title: "HSC Science",
    level: "Class 11–12",
    description:
      "Concept-first teaching for Physics, Chemistry, Biology and Math, aligned with university admission needs.",
    duration: "18 months",
    batchSize: "25 students",
    startingDate: "15 Sep 2026",
    price: "৳3,200",
    priceNote: "per month",
    icon: BookOpen,
    tone: "info",
    popular: true,
  },
  {
    id: "hsc-commerce",
    title: "HSC Commerce",
    level: "Class 11–12",
    description:
      "Accounting, Finance, Business Organisation and Economics taught with real ledger and case practice.",
    duration: "18 months",
    batchSize: "30 students",
    startingDate: "15 Sep 2026",
    price: "৳2,800",
    priceNote: "per month",
    icon: BookMarked,
    tone: "success",
  },
  {
    id: "admission-batch",
    title: "Admission Batch",
    level: "University Admission",
    description:
      "Intensive preparation for DU, BUET, Medical and GST unit tests with 40+ full-length mock exams.",
    duration: "6 months",
    batchSize: "40 students",
    startingDate: "1 Oct 2026",
    price: "৳12,000",
    priceNote: "full course",
    icon: Trophy,
    tone: "warning",
    popular: true,
  },
  {
    id: "english-spoken",
    title: "English Spoken",
    level: "All Levels",
    description:
      "Fluency-focused sessions on pronunciation, presentation and interview skills in small speaking circles.",
    duration: "3 months",
    batchSize: "20 students",
    startingDate: "10 Sep 2026",
    price: "৳4,500",
    priceNote: "full course",
    icon: MessageSquareText,
    tone: "primary",
  },
  {
    id: "ict-special",
    title: "ICT Special Batch",
    level: "Class 11–12",
    description:
      "Chapter 4 and 5 made simple — number systems, logic gates, HTML and C programming with lab practice.",
    duration: "4 months",
    batchSize: "25 students",
    startingDate: "20 Sep 2026",
    price: "৳3,000",
    priceNote: "full course",
    icon: Laptop,
    tone: "info",
  },
]

export interface ProcessStep {
  step: string
  title: string
  description: string
  icon: LucideIcon
}

export const learningProcess: readonly ProcessStep[] = [
  {
    step: "01",
    title: "Register",
    description:
      "Complete the admission form online or at our Dhanmondi office and sit for a short placement test.",
    icon: ClipboardCheck,
  },
  {
    step: "02",
    title: "Attend Classes",
    description:
      "Join your batch for structured classes six days a week in smart, air-conditioned classrooms.",
    icon: BookOpen,
  },
  {
    step: "03",
    title: "Weekly Assessments",
    description:
      "Sit for weekly exams, receive OMR-evaluated results within a day and review every mistake in class.",
    icon: CalendarCheck,
  },
  {
    step: "04",
    title: "Achieve Success",
    description:
      "Walk into your board or admission exam with model tests, revision sheets and confidence behind you.",
    icon: Trophy,
  },
]

export interface Teacher {
  name: string
  subject: string
  experience: string
  qualification: string
  tone: Tone
}

export const teachers: readonly Teacher[] = [
  {
    name: "Rezaul Karim",
    subject: "Physics",
    experience: "14 years of teaching",
    qualification: "M.Sc. in Physics, University of Dhaka",
    tone: "primary",
  },
  {
    name: "Nusrat Jahan",
    subject: "Chemistry",
    experience: "11 years of teaching",
    qualification: "M.Sc. in Chemistry, University of Dhaka",
    tone: "success",
  },
  {
    name: "Tanvir Ahmed",
    subject: "Higher Mathematics",
    experience: "12 years of teaching",
    qualification: "B.Sc. Engineering, BUET",
    tone: "info",
  },
  {
    name: "Sadia Islam",
    subject: "Biology",
    experience: "9 years of teaching",
    qualification: "MBBS, Dhaka Medical College",
    tone: "warning",
  },
  {
    name: "Mahmudul Hasan",
    subject: "English",
    experience: "10 years of teaching",
    qualification: "M.A. in English, Jahangirnagar University",
    tone: "primary",
  },
  {
    name: "Farhana Akter",
    subject: "Accounting",
    experience: "8 years of teaching",
    qualification: "M.B.A. in Accounting, University of Dhaka",
    tone: "success",
  },
]

export interface Testimonial {
  name: string
  exam: string
  rating: number
  review: string
  achievement: string
  tone: Tone
}

export const testimonials: readonly Testimonial[] = [
  {
    name: "Ayesha Siddika",
    exam: "HSC 2025 — Science",
    rating: 5,
    achievement: "GPA 5.00",
    review:
      "The weekly exams were the turning point for me. Getting my result the next day meant I always knew exactly which chapter to revise, and the teachers sat with me until the concept clicked.",
    tone: "primary",
  },
  {
    name: "Rifat Hossain",
    exam: "BUET Admission 2025",
    rating: 5,
    achievement: "Merit position 214",
    review:
      "Forty full-length mock tests before the real exam removed all the fear. By admission day the question paper felt like just another Friday model test at MyOne.",
    tone: "info",
  },
  {
    name: "Tasnim Rahman",
    exam: "SSC 2025 — Science",
    rating: 5,
    achievement: "GPA 5.00 with Golden",
    review:
      "I joined in Class 9 as an average student in Math. The small batch meant my teacher noticed exactly where I was slipping, and I finished with a Golden A+.",
    tone: "success",
  },
  {
    name: "Sabbir Ahmed",
    exam: "Medical Admission 2025",
    rating: 5,
    achievement: "Chattogram Medical College",
    review:
      "The Biology and Chemistry sheets were sharper than anything else I studied from. Everything I needed was in one place, so I never wasted time hunting for notes.",
    tone: "warning",
  },
  {
    name: "Maliha Chowdhury",
    exam: "HSC 2024 — Commerce",
    rating: 5,
    achievement: "GPA 5.00",
    review:
      "My parents could see my attendance and monthly report on their phone, so they stopped worrying and started encouraging. That support changed how I studied.",
    tone: "primary",
  },
]

export interface GalleryItem {
  title: string
  caption: string
  icon: LucideIcon
  tone: Tone
  /** Tailwind span classes controlling this tile's footprint in the mosaic. */
  span: string
}

export const gallery: readonly GalleryItem[] = [
  {
    title: "Smart Classroom",
    caption: "Multimedia-equipped classrooms",
    icon: MonitorPlay,
    tone: "primary",
    span: "sm:col-span-2 sm:row-span-2",
  },
  {
    title: "Our Campus",
    caption: "Dhanmondi main branch",
    icon: Building2,
    tone: "info",
    span: "",
  },
  {
    title: "Students at Work",
    caption: "Group study sessions",
    icon: Users,
    tone: "success",
    span: "",
  },
  {
    title: "Annual Event",
    caption: "Cultural programme 2025",
    icon: PartyPopper,
    tone: "warning",
    span: "",
  },
  {
    title: "Prize Giving",
    caption: "Celebrating our top achievers",
    icon: Award,
    tone: "primary",
    span: "",
  },
  {
    title: "Science Lab",
    caption: "Hands-on practical classes",
    icon: FlaskConical,
    tone: "success",
    span: "sm:col-span-2 lg:col-span-4",
  },
]

export interface InstituteEvent {
  title: string
  description: string
  /** `iso` drives the <time datetime> attribute; day/month drive the visual tile. */
  date: { day: string; month: string; iso: string }
  time: string
  location: string
  badge: string
  tone: Tone
}

export const events: readonly InstituteEvent[] = [
  {
    title: "Admission Seminar",
    description:
      "Meet our faculty, tour the campus and learn how the SSC and HSC batches are structured.",
    date: { day: "12", month: "Sep", iso: "2026-09-12" },
    time: "10:00 AM – 12:30 PM",
    location: "Main Campus Auditorium, Dhanmondi",
    badge: "Free entry",
    tone: "primary",
  },
  {
    title: "Career Guidance Session",
    description:
      "Engineers, doctors and chartered accountants share how they chose their path after HSC.",
    date: { day: "19", month: "Sep", iso: "2026-09-19" },
    time: "3:00 PM – 5:00 PM",
    location: "Seminar Hall 2, Dhanmondi",
    badge: "Guardians welcome",
    tone: "info",
  },
  {
    title: "Free Model Test",
    description:
      "A full-length OMR model test for admission candidates, with results published the same evening.",
    date: { day: "27", month: "Sep", iso: "2026-09-27" },
    time: "9:00 AM – 11:00 AM",
    location: "Exam Hall, Dhanmondi",
    badge: "Registration required",
    tone: "success",
  },
  {
    title: "Science Fair 2026",
    description:
      "Student-built projects across physics, chemistry and robotics, judged by university faculty.",
    date: { day: "05", month: "Oct", iso: "2026-10-05" },
    time: "9:00 AM – 4:00 PM",
    location: "Campus Ground, Dhanmondi",
    badge: "Open to all",
    tone: "warning",
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const faqs: readonly FaqItem[] = [
  {
    question: "How can I enroll at MyOne Coaching Center?",
    answer:
      "Submit the online admission form or visit our Dhanmondi office with your last exam transcript, two passport-size photographs and a copy of your birth certificate. New students sit for a short placement test so we can put them in the right batch, and admission is confirmed once the first month's fee is paid.",
  },
  {
    question: "Do you provide study materials?",
    answer:
      "Yes. Every enrolled student receives printed lecture sheets, chapter-wise question banks and board question analyses at no extra cost. The same material — plus recorded class videos — is available in the student portal, so nothing is lost if you miss a class.",
  },
  {
    question: "What are the class schedules?",
    answer:
      "Classes run six days a week, Saturday through Thursday. School students attend afternoon batches from 3:00 PM to 7:00 PM, while college and admission candidates can choose a morning batch from 8:00 AM to 12:00 PM. You pick your preferred slot at admission, and batch changes can be requested once per term.",
  },
  {
    question: "Is there a scholarship available?",
    answer:
      "We offer up to 100% waiver for students who achieved a Golden A+ in their previous board exam, and 25–50% waivers based on our scholarship test held each August. Need-based support is also available for students facing financial hardship — speak with our admission office in confidence.",
  },
  {
    question: "How are exams conducted and results shared?",
    answer:
      "Weekly chapter tests and monthly model tests follow the board format and are evaluated through our OMR system. Results are published in the student portal within 24 hours with a mark breakdown, class position and per-chapter weak points, and guardians receive the same report by SMS.",
  },
]

export interface FooterGroup {
  title: string
  links: readonly NavLink[]
}

export const footerGroups: readonly FooterGroup[] = [
  {
    title: "Courses",
    links: [
      { label: "SSC Science", href: "#courses" },
      { label: "HSC Science", href: "#courses" },
      { label: "HSC Commerce", href: "#courses" },
      { label: "Admission Batch", href: "#courses" },
      { label: "English Spoken", href: "#courses" },
      { label: "ICT Special Batch", href: "#courses" },
    ],
  },
  {
    title: "Quick Links",
    links: [
      { label: "Why Choose Us", href: "#why-choose-us" },
      { label: "Our Teachers", href: "#teachers" },
      { label: "Success Stories", href: "#testimonials" },
      { label: "Gallery", href: "#gallery" },
      { label: "Upcoming Events", href: "#events" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Admission",
    links: [
      { label: "Enroll Now", href: "#enroll" },
      { label: "Admission Process", href: "#process" },
      { label: "Scholarships", href: "#faq" },
      { label: "Fees & Payment", href: "#courses" },
      { label: "Student Portal", href: "/login" },
    ],
  },
]
