export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-ink px-6 pt-safe pb-safe">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-30%] h-[70%] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(200,162,74,0.22),transparent_70%)]"
      />
      <div className="relative mx-auto w-full max-w-sm">{children}</div>
    </main>
  );
}
