export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-luma-surface relative flex min-h-dvh flex-col justify-center overflow-hidden px-6 pt-safe pb-safe">
      <div className="relative mx-auto w-full max-w-sm">{children}</div>
    </main>
  );
}
