'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

// Client component because signOut needs browser context to clear
// the session cookie and trigger the redirect. Extracted from
// DashboardLayout to keep the layout as a server component.
export function LogoutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => signOut({ redirectTo: '/login' })}
    >
      Log out
    </Button>
  );
}
