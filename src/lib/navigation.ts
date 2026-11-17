import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  BellRing,
  BookOpen,
  Bot,
  Building2,
  Bug,
  Calendar,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  DatabaseBackup,
  FileText,
  Flag,
  FolderKanban,
  Gauge,
  GitBranch,
  HardDrive,
  Home,
  IdCard,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  Plug,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Target,
  Ticket,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";

// ── Roles ─────────────────────────────────────────────────────────────────────

export type RoleName = "VIEWER" | "TEAM_MEMBER" | "PROJECT_MANAGER" | "ADMIN";

const ROLE_RANK: Record<RoleName, number> = {
  VIEWER: 0,
  TEAM_MEMBER: 1,
  PROJECT_MANAGER: 2,
  ADMIN: 3,
};

export function hasRole(role: string | undefined, minRole?: RoleName) {
  if (!minRole) return true;
  return (ROLE_RANK[role as RoleName] ?? 0) >= ROLE_RANK[minRole];
}

// ── Modules (switchable per client deployment) ───────────────────────────────

export const MODULES = [
  { key: "projects", label: "Projects", description: "Projects, process workflow, milestones and tasks." },
  { key: "execution", label: "Execution Control", description: "Gap analysis, execution deadlines and the escalation matrix." },
  { key: "people", label: "People", description: "Employee directory and resource allocation." },
  { key: "itops", label: "IT Operations", description: "IT assets, maintenance windows, licenses and automation." },
  { key: "servicedesk", label: "Service Desk", description: "IT support tickets, including WhatsApp intake." },
  { key: "governance", label: "Governance & Compliance", description: "Compliance frameworks, risk register, policies and audit log." },
  { key: "secops", label: "Security Operations", description: "Vulnerabilities, security events, incidents, playbooks, alert rules and backups." },
  { key: "reports", label: "Reports", description: "Reports and analytics." },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const MODULE_KEYS: ModuleKey[] = MODULES.map((module) => module.key);

// ── Navigation ────────────────────────────────────────────────────────────────

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: RoleName;
};

export type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  module?: ModuleKey;
  minRole?: RoleName;
  items: NavItem[];
};

export type NavAccess = {
  role: string;
  disabledModules: string[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Gauge },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    icon: FolderKanban,
    module: "projects",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/workflow", label: "Process Workflow", icon: GitBranch },
      { href: "/milestones", label: "Milestones", icon: Flag },
      { href: "/tasks", label: "Tasks", icon: ClipboardList },
    ],
  },
  {
    key: "execution",
    label: "Execution Control",
    icon: Target,
    module: "execution",
    items: [
      { href: "/gaps", label: "Gap Analysis", icon: TriangleAlert },
      { href: "/deadlines", label: "Execution Deadlines", icon: CalendarClock },
      { href: "/escalations", label: "Escalation Matrix", icon: ShieldAlert },
    ],
  },
  {
    key: "people",
    label: "People",
    icon: Users,
    module: "people",
    items: [
      { href: "/employees", label: "Employees", icon: IdCard, minRole: "PROJECT_MANAGER" },
      { href: "/resources", label: "Resource Allocation", icon: Users },
    ],
  },
  {
    key: "itops",
    label: "IT Operations",
    icon: HardDrive,
    module: "itops",
    items: [
      { href: "/it-maintenance", label: "IT Overview", icon: LayoutGrid },
      { href: "/it-maintenance/assets", label: "Assets & Apps", icon: HardDrive },
      { href: "/it-maintenance/maintenance", label: "Maintenance Windows", icon: CalendarClock },
      { href: "/it-maintenance/licenses", label: "Licenses & Renewals", icon: KeyRound },
      { href: "/automation", label: "Automation Center", icon: Bot, minRole: "PROJECT_MANAGER" },
    ],
  },
  {
    key: "servicedesk",
    label: "Service Desk",
    icon: LifeBuoy,
    module: "servicedesk",
    items: [
      { href: "/support", label: "Support Overview", icon: LifeBuoy },
      { href: "/support/tickets", label: "Tickets", icon: Ticket },
    ],
  },
  {
    key: "governance",
    label: "Governance & Compliance",
    icon: ShieldCheck,
    module: "governance",
    items: [
      { href: "/compliance", label: "Compliance Dashboard", icon: CheckSquare },
      { href: "/risk-register", label: "Risk Register", icon: AlertTriangle },
      { href: "/policy-management", label: "Policy Management", icon: FileText },
      { href: "/audit", label: "Audit Log & Evidence", icon: ScrollText },
    ],
  },
  {
    key: "secops",
    label: "Security Operations",
    icon: Shield,
    module: "secops",
    items: [
      { href: "/vulnerability-management", label: "Vulnerabilities", icon: Bug },
      { href: "/security-events", label: "Security Events", icon: Activity },
      { href: "/incident-response", label: "Incident Response", icon: Siren },
      { href: "/playbooks", label: "IR Playbooks", icon: BookOpen },
      { href: "/alert-rules", label: "Alert Rules", icon: BellRing, minRole: "PROJECT_MANAGER" },
      { href: "/backup-monitoring", label: "Backup Monitoring", icon: DatabaseBackup },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart2,
    module: "reports",
    items: [{ href: "/reports", label: "Reports & Analytics", icon: BarChart2 }],
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    minRole: "ADMIN",
    items: [
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/team", label: "Team & Roles", icon: Users },
      { href: "/admin/users", label: "User Management", icon: UserCog },
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/settings/modules", label: "Modules", icon: LayoutGrid },
    ],
  },
];

// Pages reachable outside the menu (avatar menu etc.), used for breadcrumbs.
const EXTRA_PAGES: { href: string; label: string; group: string }[] = [
  { href: "/profile", label: "My Profile & Security", group: "Account" },
];

// Quick-create actions for the top bar "+ Create" menu.
export const CREATE_ACTIONS: (NavItem & { module?: ModuleKey })[] = [
  { href: "/projects/new", label: "New Project", icon: FolderKanban, module: "projects", minRole: "TEAM_MEMBER" },
  { href: "/tasks/new", label: "New Task", icon: ClipboardList, module: "projects", minRole: "TEAM_MEMBER" },
  { href: "/gaps/new", label: "New Gap", icon: TriangleAlert, module: "execution", minRole: "TEAM_MEMBER" },
  { href: "/support/new", label: "Log Support Ticket", icon: LifeBuoy, module: "servicedesk", minRole: "TEAM_MEMBER" },
  { href: "/it-maintenance/licenses/new", label: "Add License", icon: KeyRound, module: "itops", minRole: "TEAM_MEMBER" },
  { href: "/companies/new", label: "Add Company", icon: Building2, minRole: "ADMIN" },
  { href: "/team/new", label: "Add Team Member", icon: Users, minRole: "ADMIN" },
];

// Phone bottom bar; everything else lives behind "More".
export const MOBILE_TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: Gauge },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/support/tickets", label: "Tickets", icon: Ticket },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupAllowed(group: NavGroup, { role, disabledModules }: NavAccess) {
  return hasRole(role, group.minRole) && !(group.module && disabledModules.includes(group.module));
}

export function visibleNavGroups(access: NavAccess): NavGroup[] {
  return NAV_GROUPS.filter((group) => groupAllowed(group, access))
    .map((group) => ({ ...group, items: group.items.filter((item) => hasRole(access.role, item.minRole)) }))
    .filter((group) => group.items.length > 0);
}

export function visibleCreateActions({ role, disabledModules }: NavAccess) {
  return CREATE_ACTIONS.filter(
    (action) => hasRole(role, action.minRole) && !(action.module && disabledModules.includes(action.module)),
  );
}

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Longest menu href that the pathname falls under, e.g. /support/new → /support. */
export function activeHref(pathname: string, hrefs: string[]) {
  return hrefs.filter((href) => matches(pathname, href)).sort((a, b) => b.length - a.length)[0];
}

/** Finds the menu group and item that own a pathname, ignoring access rules. */
export function findNavMatch(pathname: string) {
  const href = activeHref(pathname, NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)));
  if (!href) return undefined;
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.href === href);
    if (item) return { group, item };
  }
  return undefined;
}

export function isPathAllowed(pathname: string, access: NavAccess) {
  const match = findNavMatch(pathname);
  if (!match) return true;
  return groupAllowed(match.group, access) && hasRole(access.role, match.item.minRole);
}

const SUB_PAGE_LABELS: Record<string, string> = {
  new: "New",
  renewals: "Renewal Risks",
  "asset-report": "Asset Report",
  "leave-form": "Leave Form",
};

export function breadcrumbFor(pathname: string) {
  const extra = EXTRA_PAGES.find((page) => matches(pathname, page.href));
  if (extra) return { group: extra.group, title: extra.label, href: extra.href, sub: undefined };

  const match = findNavMatch(pathname);
  if (!match) return undefined;

  const rest = pathname.slice(match.item.href.length).split("/").filter(Boolean);
  const last = rest.at(-1);
  const sub = last ? (SUB_PAGE_LABELS[last] ?? "Details") : undefined;
  return { group: match.group.label, title: match.item.label, href: match.item.href, sub };
}
