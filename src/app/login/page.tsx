import { LoginForm } from "@/components/auth/login-form";
import {
  Users,
  Monitor,
  FolderKanban,
  Shield,
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

// Brand palette
const NAVY   = "#2e5090";
const AMBER  = "#c87a1c";
const DARK   = "#0d1a2e";
const DARKER = "#091221";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden lg:flex lg:w-[58%]"
           style={{ background: `linear-gradient(135deg, ${DARKER} 0%, ${DARK} 50%, #112240 100%)` }}>

        {/* Grid pattern */}
        <div className="pointer-events-none absolute inset-0"
             style={{
               backgroundImage: `linear-gradient(rgba(46,80,144,0.09) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(46,80,144,0.09) 1px, transparent 1px)`,
               backgroundSize: "48px 48px",
             }} />

        {/* Radial glow — top left (navy) */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full"
             style={{ background: `radial-gradient(circle, rgba(46,80,144,0.18) 0%, transparent 70%)` }} />

        {/* Radial glow — bottom right (amber) */}
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[400px] w-[400px] rounded-full"
             style={{ background: `radial-gradient(circle, rgba(200,122,28,0.12) 0%, transparent 70%)` }} />

        {/* ── Top: logo ── */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo with Tagline.jpg"
              alt="Horizon Business Solutions"
              className="h-12 w-auto object-contain"
              style={{ filter: "brightness(1.1) drop-shadow(0 0 8px rgba(200,122,28,0.3))" }}
            />
            <div>
              <div className="text-lg font-bold tracking-tight text-white">HorizonMiyaar</div>
              <div className="text-xs" style={{ color: `rgba(200,160,80,0.65)` }}>By Horizon Business Solutions Est.</div>
            </div>
          </div>
        </div>

        {/* ── Middle: headline + features ── */}
        <div className="relative z-10 space-y-10 px-10">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                 style={{ background: `rgba(200,122,28,0.12)`, border: `1px solid rgba(200,122,28,0.30)`, color: `#f0a845` }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMBER }} />
              Secure Enterprise Platform
            </div>
            <h1 className="text-4xl font-bold leading-tight text-white xl:text-[42px]">
              Empowering Secure<br />
              <span style={{ background: `linear-gradient(90deg, ${AMBER}, #f0c060)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
                   style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                     style={{ background: `rgba(46,80,144,0.18)`, border: `1px solid rgba(46,80,144,0.30)` }}>
                  <Icon className="h-4 w-4" style={{ color: `#7ba3e0` }} />
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo with Tagline.jpg" alt="Horizon Business Solutions" className="h-10 w-auto object-contain" />
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
