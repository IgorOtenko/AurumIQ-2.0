import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LogoutButton } from './logout-button';

// Server component layout for all /dashboard/* routes.
// Defense-in-depth: middleware already blocks unauthenticated users,
// but this server-side check ensures protection even if middleware
// is bypassed (e.g., direct RSC fetch or middleware misconfiguration).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">AurumIQ</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
