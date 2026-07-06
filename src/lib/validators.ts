import { z } from "zod";

export const projectSchema = z.object({
  projectId: z.string().min(3),
  name: z.string().min(3),
  description: z.string().min(10),
  client: z.string().optional().default(""),
  companyIds: z.array(z.string().min(1)).min(1, "Select at least one company"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(["DRAFT", "PLANNING", "PREPARATION", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  budget: z.coerce.number().nonnegative(),
  managerId: z.string().min(1),
});

export const projectUpdateSchema = projectSchema.partial().omit({ managerId: true }).extend({
  managerId: z.string().min(1).optional(),
});

export const companySchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  description: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

export const companyUpdateSchema = companySchema.partial();

export const employeeSchema = z.object({
  employeeId: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  department: z.string().min(1),
  jobTitle: z.string().min(1),
  location: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "EXITED"]),
  companyIds: z.array(z.string().min(1)).min(1, "Select at least one company"),
  ipAddress: z.string().optional(),
  vpnUserId: z.string().optional(),
  vpnPassword: z.string().optional(),
  leaveStartDate: z.coerce.date().optional().nullable(),
  leaveReturnDate: z.coerce.date().optional().nullable(),
  leaveReason: z.string().optional().nullable(),
  exitDate: z.coerce.date().optional().nullable(),
  offboardingNotes: z.string().optional(),
});

export const employeeUpdateSchema = employeeSchema.partial();

export const projectCurrentStateSchema = z.object({
  summary: z.string().min(10),
  currentProcess: z.string().min(10),
  tools: z.string().min(1),
  resources: z.string().min(1),
  painPoints: z.string().min(5),
  risks: z.string().min(5),
  constraints: z.string().min(5),
  assessmentDate: z.coerce.date(),
  assessedById: z.string().min(1),
  confidenceLevel: z.coerce.number().int().min(1).max(5),
});

const taskBaseSchema = z.object({
  taskType: z.enum(["PROJECT", "GENERAL"]).default("PROJECT"),
  title: z.string().min(3),
  description: z.string().min(5),
  projectId: z.string().optional(),
  layerId: z.string().optional(),
  subLayerId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  assigneeId: z.string().min(1),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date(),
  estimatedHours: z.coerce.number().positive(),
  actualHours: z.coerce.number().nonnegative().default(0),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"]),
  parentTaskId: z.string().optional().nullable(),
});

export const taskSchema = taskBaseSchema.superRefine((value, context) => {
  if (value.taskType === "PROJECT") {
    if (!value.projectId) context.addIssue({ code: "custom", path: ["projectId"], message: "Select a project" });
    if (!value.layerId) context.addIssue({ code: "custom", path: ["layerId"], message: "Select a layer" });
    if (!value.subLayerId) context.addIssue({ code: "custom", path: ["subLayerId"], message: "Select a sub layer" });
  }
});

export const taskUpdateSchema = taskBaseSchema.partial();

export const gapSchema = z.object({
  gapId: z.string().min(3),
  title: z.string().min(3),
  description: z.string().min(10),
  projectId: z.string().min(1),
  layerId: z.string().min(1),
  subLayerId: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  impact: z.string().optional(),
  rootCause: z.string().min(5),
  ownerId: z.string().min(1),
  targetClosureDate: z.coerce.date(),
  status: z.enum(["OPEN", "INVESTIGATING", "ACTION_PLANNED", "IN_PROGRESS", "CLOSED"]),
});

export const gapUpdateSchema = gapSchema.partial();

export const gapActionSchema = z.object({
  actionId: z.string().min(3),
  gapId: z.string().min(1),
  correctiveAction: z.string().min(5),
  responsibleId: z.string().min(1),
  dueDate: z.coerce.date(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]),
  progress: z.coerce.number().int().min(0).max(100),
});

export const gapActionUpdateSchema = gapActionSchema.partial();

export const teamMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER", "VIEWER"]),
  companyIds: z.array(z.string().min(1)).default([]),
});

export const teamMemberUpdateSchema = teamMemberSchema.partial().extend({
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
    .optional()
    .or(z.literal("")),
});

export const itAssetSchema = z.object({
  assetTag: z.string().min(2),
  name: z.string().min(2),
  companyIds: z.array(z.string().min(1)).min(1, "Select at least one company"),
  type: z.enum(["SERVER", "ROUTER", "SWITCH", "FIREWALL", "STORAGE", "LAPTOP", "DESKTOP", "PRINTER", "APPLICATION", "DATABASE", "CLOUD_SERVICE", "OTHER"]),
  vendor: z.string().min(1),
  model: z.string().min(1),
  location: z.string().min(1),
  purchaseDate: z.coerce.date(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  lifecycleYears: z.coerce.number().int().min(1).max(20),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED", "PLANNED_REPLACEMENT"]),
  assignedToId: z.string().optional(),
  employeeId: z.string().optional(),
  notes: z.string().optional(),
});

export const itAssetUpdateSchema = itAssetSchema.partial().extend({
  companyIds: z.array(z.string().min(1)).min(1, "Select at least one company").optional(),
});

export const itMaintenanceSchema = z.object({
  maintenanceId: z.string().min(2),
  title: z.string().min(3),
  description: z.string().min(5),
  assetId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(15).max(10080),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  responsibleId: z.string().min(1),
  downtimeRequired: z.coerce.boolean().default(false),
});

export const itLicenseSchema = z.object({
  licenseId: z.string().min(2),
  name: z.string().min(2),
  vendor: z.string().min(1),
  assetId: z.string().optional(),
  seats: z.coerce.number().int().min(1),
  cost: z.coerce.number().nonnegative(),
  expiryDate: z.coerce.date(),
  owner: z.string().min(1),
  employeeId: z.string().optional(),
  notes: z.string().optional(),
});

export const supportTicketSchema = z.object({
  ticketNo: z.string().min(3).optional(),
  title: z.string().min(3),
  description: z.string().min(5),
  companyId: z.string().min(1),
  employeeId: z.string().optional(),
  assetId: z.string().optional(),
  licenseId: z.string().optional(),
  category: z.enum(["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "EMAIL", "ERP", "LICENSE", "MAINTENANCE", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPEN", "TRIAGED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).default("OPEN"),
  source: z.enum(["PORTAL", "WHATSAPP", "PHONE", "EMAIL"]).default("PORTAL"),
  requesterName: z.string().optional(),
  requesterPhone: z.string().optional(),
  assignedToId: z.string().optional(),
});

export const supportTicketUpdateSchema = supportTicketSchema.partial().extend({
  eventBody: z.string().min(1).optional(),
});

const resourceAllocationBaseSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(3),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  maintenanceId: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  allocationPercent: z.coerce.number().int().min(1).max(100).default(100),
  status: z.enum(["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED"]).default("PLANNED"),
  notes: z.string().optional(),
});

export const resourceAllocationSchema = resourceAllocationBaseSchema.refine((value) => value.endAt > value.startAt, {
  message: "End time must be after start time",
  path: ["endAt"],
}).refine((value) => Boolean(value.projectId || value.taskId || value.maintenanceId), {
  message: "Select a project, task, or maintenance window",
  path: ["projectId"],
});

export const resourceAllocationUpdateSchema = resourceAllocationBaseSchema.partial();

export const milestoneSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().min(5),
  dueDate: z.coerce.date(),
  completion: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "DELAYED"]),
});

export const milestoneUpdateSchema = milestoneSchema.partial().omit({ projectId: true });

export const commentSchema = z.object({
  body: z.string().min(1).max(2000),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  gapId: z.string().optional(),
  supportTicketId: z.string().optional(),
});
