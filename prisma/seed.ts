import { PrismaClient, RoleName, ProjectStatus, Priority, LayerType, TaskStatus, MilestoneStatus, GapSeverity, GapStatus, GapActionStatus, NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { layerDefinitions } from "../src/lib/layers";

const prisma = new PrismaClient();

async function main() {
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: name.replace("_", " ").toLowerCase() },
      }),
    ),
  );

  const roleByName = Object.fromEntries(roles.map((role) => [role.name, role]));
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pegms.local" },
    update: {},
    create: {
      name: "PEGMS Admin",
      email: "admin@pegms.local",
      passwordHash,
      roleId: roleByName.ADMIN.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@pegms.local" },
    update: {},
    create: {
      name: "Aisha Khan",
      email: "manager@pegms.local",
      passwordHash,
      roleId: roleByName.PROJECT_MANAGER.id,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@pegms.local" },
    update: {},
    create: {
      name: "Omar Shareef",
      email: "member@pegms.local",
      passwordHash,
      roleId: roleByName.TEAM_MEMBER.id,
    },
  });

  const companies = await Promise.all([
    { code: "CO-A", name: "Group Company A", description: "Primary operating company" },
    { code: "CO-B", name: "Group Company B", description: "Shared-services beneficiary" },
    { code: "CO-C", name: "Group Company C", description: "Regional business unit" },
    { code: "CO-D", name: "Group Company D", description: "Support and services entity" },
  ].map((company) =>
    prisma.company.upsert({
      where: { code: company.code },
      update: company,
      create: { ...company, createdBy: admin.id },
    }),
  ));

  const project = await prisma.project.upsert({
    where: { projectId: "PEGMS-001" },
    update: {},
    create: {
      projectId: "PEGMS-001",
      name: "ERP Rollout Acceleration",
      description: "Enterprise rollout with strict delivery checkpoints and gap closure governance.",
      client: "Acme Manufacturing",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-09-30"),
      status: ProjectStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      budget: 380000,
      managerId: manager.id,
      createdBy: admin.id,
    },
  });

  await Promise.all(
    companies.slice(0, 2).map((company) =>
      prisma.projectCompany.upsert({
        where: { projectId_companyId: { projectId: project.id, companyId: company.id } },
        update: {},
        create: { projectId: project.id, companyId: company.id, createdBy: admin.id },
      }),
    ),
  );

  const layers = await Promise.all(
    (Object.keys(layerDefinitions) as LayerType[]).map((type) =>
      prisma.projectLayer.upsert({
        where: { projectId_type: { projectId: project.id, type } },
        update: {},
        create: {
          projectId: project.id,
          type,
          name: type.charAt(0) + type.slice(1).toLowerCase(),
          completion: type === LayerType.PLANNING ? 90 : type === LayerType.PREPARATION ? 70 : 42,
          createdBy: admin.id,
          subLayers: {
            create: layerDefinitions[type].map((name, order) => ({ name, order, createdBy: admin.id })),
          },
        },
        include: { subLayers: true },
      }),
    ),
  );

  const implementation = layers.find((layer) => layer.type === LayerType.IMPLEMENTATION)!;
  const testing = implementation.subLayers.find((sub) => sub.name === "Testing")!;
  const deployment = implementation.subLayers.find((sub) => sub.name === "Deployment")!;
  const planning = layers.find((layer) => layer.type === LayerType.PLANNING)!;
  const risk = planning.subLayers.find((sub) => sub.name === "Risk Assessment")!;

  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        title: "Finalize integration test plan",
        description: "Complete critical-path test coverage for payroll and inventory flows.",
        projectId: project.id,
        layerId: implementation.id,
        subLayerId: testing.id,
        priority: Priority.HIGH,
        assigneeId: member.id,
        dueDate: new Date("2026-06-12"),
        estimatedHours: 18,
        actualHours: 6,
        status: TaskStatus.IN_PROGRESS,
        createdBy: manager.id,
      },
      {
        title: "Deploy staging environment",
        description: "Provision staging and run smoke checks before client UAT.",
        projectId: project.id,
        layerId: implementation.id,
        subLayerId: deployment.id,
        priority: Priority.CRITICAL,
        assigneeId: member.id,
        dueDate: new Date("2026-06-07"),
        estimatedHours: 12,
        actualHours: 2,
        status: TaskStatus.BLOCKED,
        createdBy: manager.id,
      },
    ],
  });

  await prisma.milestone.createMany({
    data: [
      {
        name: "UAT Entry",
        description: "Client users can begin UAT with all priority workflows available.",
        dueDate: new Date("2026-06-20"),
        completion: 55,
        status: MilestoneStatus.ACTIVE,
        projectId: project.id,
        createdBy: manager.id,
      },
      {
        name: "Production Readiness",
        description: "Operational readiness approval for go-live.",
        dueDate: new Date("2026-07-15"),
        completion: 20,
        status: MilestoneStatus.UPCOMING,
        projectId: project.id,
        createdBy: manager.id,
      },
    ],
  });

  const gap = await prisma.gap.upsert({
    where: { gapId: "GAP-001" },
    update: {},
    create: {
      gapId: "GAP-001",
      title: "Missing payment gateway credentials",
      description: "Staging payment validation is blocked because client credentials are unavailable.",
      projectId: project.id,
      layerId: planning.id,
      subLayerId: risk.id,
      severity: GapSeverity.CRITICAL,
      impact: "Blocks end-to-end order-to-cash validation and UAT entry.",
      rootCause: "Procurement handoff did not include gateway onboarding ownership.",
      ownerId: manager.id,
      targetClosureDate: new Date("2026-06-10"),
      status: GapStatus.ACTION_PLANNED,
      createdBy: manager.id,
    },
  });

  await prisma.gapAction.upsert({
    where: { actionId: "ACT-001" },
    update: {},
    create: {
      actionId: "ACT-001",
      gapId: gap.id,
      correctiveAction: "Escalate credential request and assign named client approver.",
      responsibleId: manager.id,
      dueDate: new Date("2026-06-09"),
      status: GapActionStatus.IN_PROGRESS,
      progress: 65,
      createdBy: manager.id,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: manager.id,
        type: NotificationType.GAP_OVERDUE,
        title: "Critical gap approaching closure target",
        message: "GAP-001 must be closed before UAT entry readiness review.",
        createdBy: admin.id,
      },
      {
        userId: member.id,
        type: NotificationType.TASK_OVERDUE,
        title: "Blocked task requires update",
        message: "Deploy staging environment is past due and still blocked.",
        createdBy: manager.id,
      },
    ],
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
