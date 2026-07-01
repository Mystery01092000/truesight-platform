import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Providers } from "@/app/providers";
import { AppChrome } from "@/components/nav/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side session guard (middleware also enforces this — defense in depth).
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <Providers>
      <AppChrome user={{ name: session.name, email: session.email, role: session.role }}>
        {children}
      </AppChrome>
    </Providers>
  );
}
