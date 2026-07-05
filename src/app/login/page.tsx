import { LoginForm } from "@/components/auth/login-form";
import { LoginSlider } from "@/components/auth/login-slider";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">

      {/* ── LEFT PANEL — animated slider ───────────────────────────────── */}
      <LoginSlider />

      {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6 lg:p-16">

        {/* Mobile logo (hidden on desktop) */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Logo with Tagline.jpg"
            alt="Horizon Business Solutions"
            className="h-10 w-auto object-contain"
          />
          <div className="text-center">
            <div className="text-lg font-bold">HorizonMiyaar</div>
            <div className="text-xs text-muted-foreground">By Horizon Business Solutions Est.</div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-7">

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your HorizonMiyaar workspace
            </p>
          </div>

          {/* Auth form */}
          <LoginForm />

          {/* Footer */}
          <div className="space-y-3 text-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>Secure access</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <p className="text-xs text-muted-foreground">
              By signing in you agree to the organisation&apos;s<br />
              acceptable use and data governance policies.
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              © {new Date().getFullYear()} Horizon Business Solutions Est.
            </p>
          </div>
        </div>
      </div>

    </main>
  );
}
