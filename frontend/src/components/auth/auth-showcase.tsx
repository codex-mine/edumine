import Image from "next/image";
import { GraduationCap } from "lucide-react";

export function AuthShowcase() {
  return (
    <div className="relative flex h-full w-full flex-col bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-14 py-12 text-white overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col">
        {/* Logo */}
        <div className="mb-16">
          <div className="flex h-50 w-50 items-center justify-center rounded-xl bg-white shadow-lg p-2">
            <Image
              src="/logo.png"
              alt="Codex Edumine Logo"
              width={50}
              height={50}
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </div>

        {/* Heading */}
        <div className="max-w-md">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
            Master AI-First
            <br />
            Education
          </h1>

          <p className="mt-8 text-xl leading-9 text-white/80">
            Empowering the next generation of learners with personalized AI
            co-pilots and industry-leading research tools.
          </p>
        </div>

        {/* Image */}
        <div className="mt-16 max-w-xl">
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
            <Image
              src="/dashboard.png" // <-- replace with your image
              alt="AI Learning Hub"
              width={900}
              height={650}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}