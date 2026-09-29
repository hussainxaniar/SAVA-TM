import { redirect } from "next/navigation";
import { getOptionalSessionUser } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts only checks that a session cookie exists; this validates it.
  if (!(await getOptionalSessionUser())) redirect("/sign-in");

  // The space shell (sidebar, task panel host) is in s/[spaceId]/layout.tsx.
  return <main className="h-screen">{children}</main>;
}
