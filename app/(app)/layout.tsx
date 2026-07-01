import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Providers } from "@/app/providers";
import { AppChrome } from "@/components/nav/AppChrome";
import { EstateStream } from "@/components/live/EstateStream";

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
      {/* Realtime: SSE push (Postgres LISTEN/NOTIFY) re-streams every RSC screen the
          instant a sync writes, with an interval + focus refresh as a safety net. */}
      <EstateStream />
      <AppChrome user={{ name: session.name, email: session.email, role: session.role }}>
        {children}
      </AppChrome>
    </Providers>
  );
}
