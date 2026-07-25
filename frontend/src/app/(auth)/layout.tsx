import { AuthShowcase } from "@/components/auth/auth-showcase";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh ">
      <div className="w-1/2 hidden  lg:flex">
        <AuthShowcase />
      </div>
      <div className="w-1/2  flex items-center justify-center bg-background px-4 py-12  lg:px-10">
        {children}
      </div>
    </div>
  );
}
