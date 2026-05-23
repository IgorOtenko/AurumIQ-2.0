import Link from 'next/link';
import { auth } from '@/lib/auth';
import AddEarningsAlertForm from '@/components/alerts/AddEarningsAlertForm';
import AddPriceAlertForm from '@/components/alerts/AddPriceAlertForm';
import EarningsAlertsList from '@/components/alerts/EarningsAlertsList';
import PriceAlertsList from '@/components/alerts/PriceAlertsList';
import AddScheduleForm from '@/components/scheduling/AddScheduleForm';
import SchedulesList from '@/components/scheduling/SchedulesList';
import EmailUpdateForm from '@/components/settings/EmailUpdateForm';
import PasswordChangeForm from '@/components/settings/PasswordChangeForm';

export default async function SettingsPage() {
  const session = await auth();
  const currentEmail = session?.user?.email ?? '';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Settings</h1>
          <Link
            href="/dashboard"
            className="text-sm text-sky-400 hover:text-sky-300 underline underline-offset-2"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-12">
        <section>
          <h2 className="text-lg font-semibold mb-1">Account</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your sign-in credentials.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium uppercase text-muted-foreground mb-4">
                Change password
              </h3>
              <PasswordChangeForm />
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium uppercase text-muted-foreground mb-4">
                Update email
              </h3>
              <EmailUpdateForm currentEmail={currentEmail} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">Price Alerts</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Get an email when a stock crosses your threshold.
          </p>
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <AddPriceAlertForm />
          </div>
          <PriceAlertsList />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">Earnings Alerts</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Get an email before a stock&apos;s next earnings report.
          </p>
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <AddEarningsAlertForm />
          </div>
          <EarningsAlertsList />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">Scheduled Analysis</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Automatically refresh an AI section every day at a chosen time.
          </p>
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <AddScheduleForm />
          </div>
          <SchedulesList />
        </section>
      </main>
    </div>
  );
}
