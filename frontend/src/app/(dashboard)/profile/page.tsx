import { MyProfileView } from "@/components/modules/profile/my-profile-view";

/** Shared by every role — the view assembles itself from whichever profile
 * record the signed-in user has, so there is no per-role copy of this page. */
export default function MyProfilePage() {
  return <MyProfileView />;
}
