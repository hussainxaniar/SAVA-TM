import { redirect } from "next/navigation";
import { getOptionalSessionUser } from "@/server/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts only checks that a session cookie exists; this validates it.
  if (!(await getOptionalSessionUser())) redirect("/sign-in");

  return (
    <div className="flex h-screen">
      {/* TODO (T-06): Sidebar */}
      <main className="flex-1 overflow-auto">{children}</main>
      {/* TODO (T-11): Task panel host */}
    </div>
  );
}
