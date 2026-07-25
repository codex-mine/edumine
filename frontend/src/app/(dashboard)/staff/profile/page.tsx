import { OwnAccountProfileCard } from "@/components/modules/people/own-account-profile-card";

export default function StaffProfilePage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">Your staff profile as recorded by the institute.</p>
      </div>
      <OwnAccountProfileCard />
    </div>
  );
}
