import { auth } from '@/lib/auth';

// Minimal protected dashboard page proving the auth flow works end-to-end.
// Phase 3 will replace this with the full portfolio dashboard.
export default async function DashboardPage() {
  const session = await auth();

  // Display name if provided, fall back to email.
  const displayName = session?.user?.name || session?.user?.email || 'User';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-24">
      <h2 className="text-3xl font-bold text-foreground">
        Welcome to AurumIQ, {displayName}
      </h2>
      <p className="mt-4 text-muted-foreground">
        Dashboard coming in Phase 3
      </p>
    </div>
  );
}
