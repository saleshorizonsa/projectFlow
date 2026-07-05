import { LoginForm } from "@/components/auth/login-form";
import {
  Shield,
  Users,
  Monitor,
  FolderKanban,
  Headphones,
  Lock,
  BarChart3,
} from "lucide-react";

const features = [
  { icon: Monitor,       label: "Asset & IT Maintenance",   desc: "Track hardware, software, and full asset lifecycle" },
  { icon: Users,         label: "Employee Management",       desc: "Profiles, clearances, leave workflows & QR records" },
  { icon: FolderKanban,  label: "Project Governance",        desc: "Milestones, gap tracking, and deliverable control" },
  { icon: Shield,        label: "Security Operations",       desc: "Vulnerabilities, risk register, and incident response" },
  { icon: Headphones,    label: "IT Support Desk",           desc: "Ticket management, SLAs, and escalation paths" },
  { icon: BarChart3,     label: "Analytics & Reporting",     desc: "Live dashboards, audit logs, and compliance reports" },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden lg:flex lg:w-[58%]"
           style={{ background: "linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #0d1f3c 100%)" }}>

        {/* Grid pattern */}
        <div className="pointer-events-none absolute inset-0"
             style={{
               backgroundImage: `linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px)`,
               backgroundSize: "48px 48px",
             }} />

        {/* Radial glow — top left */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />

        {/* Radial glow — bottom right */}
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[400px] w-[400px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)" }} />

        {/* ── Top: logo ── */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl"
                 style={{ background: "rgba(59,130,246,0.15)", boxShadow: "0 0 0 1px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.1)" }}>
              <Shield className="h-5 w-5" style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">HorizonMiyaar</div>
              <div className="text-xs" style={{ color: "rgba(147,197,253,0.55)" }}>By Horizon Business Solutions Est.</div>
            </div>
          </div>
        </div>

        {/* ── Middle: headline + features ── */}
        <div className="relative z-10 space-y-10 px-10">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                 style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", color: "#93c5fd" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              Secure Enterprise Platform
            </div>
            <h1 className="text-4xl font-bold leading-tight text-white xl:text-[42px]">
              Empowering Secure<br />
              <span style={{ background: "linear-gradient(90deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Digital Governance.
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: "rgba(148,163,184,0.8)" }}>
              A unified command centre for IT operations, employee lifecycle, project management, and enterprise security.
            </p>
          </div>

          {/* Feature list */}
          <div className="grid gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl p-3 transition-colors"
                   style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                     style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <Icon className="h-4 w-4" style={{ color: "#60a5fa" }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs" style={{ color: "rgba(148,163,184,0.7)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom: security badge ── */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3" style={{ color: "rgba(100,116,139,0.8)" }} />
            <span className="text-xs" style={{ color: "rgba(100,116,139,0.8)" }}>
              ISO 27001-aligned · Role-based access control · End-to-end encrypted
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6 lg:p-16">

        {/* Mobile logo (hidden on desktop) */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
            <Shield className="h-6 w-6 text-primary" />
          </div>
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

          {/* The existing auth form — untouched */}
          <LoginForm />

          {/* Footer note */}
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
