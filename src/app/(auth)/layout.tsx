// Centered layout for authentication pages (login, signup, reset).
// No header or navigation — keeps the user focused on the auth form.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}
