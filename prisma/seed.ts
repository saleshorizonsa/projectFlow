import { PrismaClient, RoleName, ProjectStatus, Priority, LayerType, TaskStatus, MilestoneStatus, GapSeverity, GapStatus, GapActionStatus, NotificationType, ControlStatus } from "@prisma/client";
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

async function seedCompliance() {
  const SACS210_DOMAINS: { code: string; name: string; description: string; order: number; controls: { controlId: string; title: string; description: string; objective: string }[] }[] = [
    {
      code: "GRC", name: "Governance, Risk & Compliance", order: 1,
      description: "Cybersecurity governance framework, risk management programme, and compliance monitoring processes.",
      controls: [
        { controlId: "GRC-01", title: "Cybersecurity Policy Framework", description: "Establish and maintain a hierarchy of cybersecurity policies, standards, and procedures.", objective: "Ensure cybersecurity requirements are formally documented, approved by management, and communicated to all personnel." },
        { controlId: "GRC-02", title: "Risk Assessment Process", description: "Conduct periodic cybersecurity risk assessments covering all critical assets and processes.", objective: "Identify, analyse, and evaluate cybersecurity risks to prioritise treatment efforts." },
        { controlId: "GRC-03", title: "Security Roles & Responsibilities", description: "Define and assign cybersecurity roles including CISO, security officers, and data owners.", objective: "Ensure accountability for cybersecurity is clearly assigned at all levels of the organisation." },
        { controlId: "GRC-04", title: "Compliance Monitoring Programme", description: "Implement an ongoing programme to monitor adherence to cybersecurity policies and regulatory requirements.", objective: "Detect and remediate compliance gaps before they result in security incidents or regulatory breaches." },
        { controlId: "GRC-05", title: "Management Review & Reporting", description: "Conduct quarterly management reviews of the cybersecurity programme with documented outcomes.", objective: "Provide senior management with timely visibility into cybersecurity posture and risk treatment status." },
      ],
    },
    {
      code: "AM", name: "Asset Management", order: 2,
      description: "Inventory, classification, ownership, and lifecycle management of all information assets.",
      controls: [
        { controlId: "AM-01", title: "Asset Inventory & Classification", description: "Maintain a complete, up-to-date inventory of all hardware, software, data, and cloud assets with classification labels.", objective: "Ensure all assets are known, classified by criticality/sensitivity, and managed throughout their lifecycle." },
        { controlId: "AM-02", title: "Asset Ownership Assignment", description: "Assign a designated owner responsible for protection and lifecycle decisions for each asset.", objective: "Establish clear accountability for every asset in the inventory." },
        { controlId: "AM-03", title: "Asset Lifecycle Management", description: "Define and enforce lifecycle stages from procurement through to secure decommissioning.", objective: "Prevent use of unmanaged, outdated, or unsupported assets that introduce security risk." },
        { controlId: "AM-04", title: "Removable Media Control", description: "Control and log the use of removable media (USB, external drives) on corporate systems.", objective: "Prevent unauthorised data exfiltration or introduction of malware via removable media." },
        { controlId: "AM-05", title: "Asset Return on Termination", description: "Ensure all organisational assets are returned and accounted for upon employee or contractor termination.", objective: "Prevent loss or misuse of assets after employment or engagement ends." },
      ],
    },
    {
      code: "IAM", name: "Identity & Access Management", order: 3,
      description: "Controls governing the provisioning, management, and review of user identities and access rights.",
      controls: [
        { controlId: "IAM-01", title: "User Access Provisioning", description: "Implement a formal process for granting access based on approved business need and least-privilege.", objective: "Ensure users have only the access required for their role, preventing excessive privilege." },
        { controlId: "IAM-02", title: "Privileged Access Management", description: "Control, monitor, and audit all privileged (admin) access to systems and infrastructure.", objective: "Reduce risk of insider threat and credential abuse by tightly managing high-privilege accounts." },
        { controlId: "IAM-03", title: "Multi-Factor Authentication", description: "Enforce MFA for all remote access, privileged accounts, and sensitive system access.", objective: "Prevent account compromise from stolen credentials by requiring a second authentication factor." },
        { controlId: "IAM-04", title: "Access Review & Recertification", description: "Conduct quarterly reviews of user access rights to validate continued business need.", objective: "Remove stale or excessive access rights before they can be exploited." },
        { controlId: "IAM-05", title: "Password Policy Enforcement", description: "Enforce strong password complexity, minimum length (12+ chars), and rotation policies.", objective: "Reduce risk of brute-force and credential-stuffing attacks through strong password controls." },
      ],
    },
    {
      code: "VM", name: "Vulnerability Management", order: 4,
      description: "Discovery, assessment, prioritisation, and remediation of technical vulnerabilities.",
      controls: [
        { controlId: "VM-01", title: "Vulnerability Scanning", description: "Perform authenticated vulnerability scans of all network-facing and internal systems at least monthly.", objective: "Identify known vulnerabilities before attackers can exploit them." },
        { controlId: "VM-02", title: "Vulnerability Remediation SLA", description: "Define and enforce remediation timeframes based on CVSS severity (Critical: 24h, High: 7d, Medium: 30d).", objective: "Ensure vulnerabilities are patched within risk-appropriate timeframes." },
        { controlId: "VM-03", title: "Penetration Testing", description: "Conduct annual penetration tests by qualified personnel or third-party testers.", objective: "Validate security controls by simulating real-world attack techniques." },
        { controlId: "VM-04", title: "Security Configuration Baseline", description: "Define and enforce hardening baselines (CIS Benchmarks) for all system types.", objective: "Reduce attack surface by eliminating unnecessary services, accounts, and default credentials." },
        { controlId: "VM-05", title: "Vulnerability Risk Rating", description: "Apply contextual risk ratings to vulnerabilities considering asset criticality and exploitability.", objective: "Prioritise remediation effort towards vulnerabilities posing the greatest actual risk." },
      ],
    },
    {
      code: "PM", name: "Patch Management", order: 5,
      description: "Timely assessment, testing, and deployment of security patches across all systems.",
      controls: [
        { controlId: "PM-01", title: "Patch Assessment & Prioritisation", description: "Assess and prioritise patches based on severity, asset criticality, and exploit availability.", objective: "Focus patching effort on changes that meaningfully reduce risk." },
        { controlId: "PM-02", title: "Patch Testing Procedure", description: "Test patches in a non-production environment before production deployment.", objective: "Prevent patch-induced outages while maintaining timely security updates." },
        { controlId: "PM-03", title: "Emergency Patch Process", description: "Define and exercise an expedited process for applying critical out-of-band patches within 24 hours.", objective: "Enable rapid response to actively exploited zero-day vulnerabilities." },
        { controlId: "PM-04", title: "Patch Compliance Reporting", description: "Generate and review monthly patch compliance reports covering all managed systems.", objective: "Provide management visibility into patching posture and outstanding remediation items." },
      ],
    },
    {
      code: "SO", name: "Security Operations", order: 6,
      description: "Continuous monitoring, threat detection, and alert management capabilities.",
      controls: [
        { controlId: "SO-01", title: "SIEM Deployment", description: "Deploy and maintain a Security Information and Event Management (SIEM) system ingesting logs from critical assets.", objective: "Centralise security event data to enable detection of threats that span multiple systems." },
        { controlId: "SO-02", title: "24/7 Security Monitoring", description: "Ensure continuous security monitoring coverage by SOC personnel or managed service provider.", objective: "Detect and respond to security events at any time, minimising dwell time." },
        { controlId: "SO-03", title: "Alert Triage & Escalation", description: "Define and follow documented alert triage procedures with clear escalation paths.", objective: "Ensure security alerts are processed consistently and critical events reach the right responders quickly." },
        { controlId: "SO-04", title: "Threat Intelligence Integration", description: "Subscribe to and operationalise relevant threat intelligence feeds.", objective: "Proactively detect known threat actor TTPs before they succeed." },
        { controlId: "SO-05", title: "Use Case & Detection Rule Management", description: "Maintain a library of detection rules aligned to the MITRE ATT&CK framework.", objective: "Ensure detection coverage maps to realistic attack scenarios relevant to the organisation." },
      ],
    },
    {
      code: "IM", name: "Incident Management", order: 7,
      description: "Preparation, detection, response, and recovery from cybersecurity incidents.",
      controls: [
        { controlId: "IM-01", title: "Incident Response Plan", description: "Maintain a documented and tested incident response plan covering classification, containment, eradication, and recovery.", objective: "Enable structured, effective response to cybersecurity incidents minimising impact." },
        { controlId: "IM-02", title: "Incident Classification", description: "Define severity levels (P1–P4) with corresponding response time objectives and escalation procedures.", objective: "Ensure the response effort is proportionate to incident severity." },
        { controlId: "IM-03", title: "Incident Communication", description: "Define communication protocols for internal stakeholders, regulators, and affected parties.", objective: "Ensure timely, accurate communication during incidents to manage reputational and regulatory risk." },
        { controlId: "IM-04", title: "Post-Incident Review (PIR)", description: "Conduct a PIR within 5 business days of every significant incident with documented lessons learned.", objective: "Drive continuous improvement in detection and response capabilities." },
        { controlId: "IM-05", title: "Incident Evidence Preservation", description: "Preserve forensic evidence from security incidents following documented chain-of-custody procedures.", objective: "Support legal, regulatory, and insurance proceedings following a significant incident." },
      ],
    },
    {
      code: "NS", name: "Network Security", order: 8,
      description: "Segmentation, perimeter controls, and monitoring of network infrastructure.",
      controls: [
        { controlId: "NS-01", title: "Network Segmentation", description: "Segment the network into security zones (e.g., DMZ, internal, OT) with enforced access controls between zones.", objective: "Limit lateral movement in the event of a breach by containing threats within a zone." },
        { controlId: "NS-02", title: "Firewall Rule Management", description: "Maintain a documented, reviewed, and approved firewall rule set with no default-permit rules.", objective: "Ensure only authorised traffic can traverse network boundaries." },
        { controlId: "NS-03", title: "Remote Access Security", description: "Secure all remote access via VPN or ZTNA with MFA and endpoint compliance checks.", objective: "Prevent unauthorised remote access to corporate resources." },
        { controlId: "NS-04", title: "Network Traffic Monitoring", description: "Monitor network traffic for anomalies and known attack patterns using IDS/IPS or NDR.", objective: "Detect network-based attacks in real time before significant damage occurs." },
        { controlId: "NS-05", title: "Wireless Network Security", description: "Secure wireless networks with WPA3, separate SSID for guests, and regular rogue AP scanning.", objective: "Prevent wireless-based attacks and unauthorised network access." },
      ],
    },
    {
      code: "ES", name: "Endpoint Security", order: 9,
      description: "Protection, monitoring, and compliance of end-user devices and servers.",
      controls: [
        { controlId: "ES-01", title: "Endpoint Protection Platform (EPP/EDR)", description: "Deploy and maintain endpoint protection with EDR capability on all managed devices.", objective: "Detect and respond to malware and attacker activity on endpoints." },
        { controlId: "ES-02", title: "Device Encryption", description: "Enforce full-disk encryption on all laptops, desktops, and mobile devices.", objective: "Protect sensitive data from disclosure in the event of device loss or theft." },
        { controlId: "ES-03", title: "Mobile Device Management", description: "Enrol all corporate mobile devices in MDM with remote wipe capability.", objective: "Maintain visibility and control over mobile endpoints." },
        { controlId: "ES-04", title: "USB & Peripheral Control", description: "Block or log the use of unauthorised USB and peripheral devices at the endpoint.", objective: "Prevent data exfiltration and malware introduction via removable media." },
        { controlId: "ES-05", title: "Endpoint Compliance Monitoring", description: "Continuously monitor endpoints for patch level, encryption status, and security agent health.", objective: "Identify non-compliant endpoints before they become the entry point for a breach." },
      ],
    },
    {
      code: "AS", name: "Application Security", order: 10,
      description: "Security controls throughout the software development lifecycle and for deployed applications.",
      controls: [
        { controlId: "AS-01", title: "Secure Development Lifecycle (SDL)", description: "Integrate security activities (threat modelling, code review, testing) into the SDLC.", objective: "Identify and remediate security flaws early when fixes are cheapest." },
        { controlId: "AS-02", title: "Static & Dynamic Code Analysis (SAST/DAST)", description: "Run automated SAST and DAST scans as part of the CI/CD pipeline.", objective: "Detect common vulnerabilities (OWASP Top 10) before deployment to production." },
        { controlId: "AS-03", title: "Web Application Firewall (WAF)", description: "Deploy a WAF in front of all internet-facing web applications.", objective: "Block common web attacks (SQLi, XSS, CSRF) at the network layer." },
        { controlId: "AS-04", title: "API Security", description: "Authenticate, authorise, and rate-limit all API endpoints; enforce input validation.", objective: "Prevent API abuse, data exposure, and injection attacks." },
        { controlId: "AS-05", title: "Application Security Testing Programme", description: "Conduct annual DAST and application penetration tests on critical applications.", objective: "Validate application security controls under realistic attack conditions." },
      ],
    },
    {
      code: "DP", name: "Data Protection", order: 11,
      description: "Classification, encryption, retention, and disposal of sensitive data.",
      controls: [
        { controlId: "DP-01", title: "Data Classification Policy", description: "Classify all data into sensitivity tiers (Public, Internal, Confidential, Restricted) with handling requirements.", objective: "Apply appropriate controls proportionate to the sensitivity of the data." },
        { controlId: "DP-02", title: "Encryption at Rest", description: "Encrypt all sensitive and confidential data at rest using AES-256 or equivalent.", objective: "Prevent data exposure from storage compromise or physical theft." },
        { controlId: "DP-03", title: "Encryption in Transit", description: "Enforce TLS 1.2+ for all data in transit; prohibit cleartext protocols.", objective: "Prevent interception of sensitive data on the network." },
        { controlId: "DP-04", title: "Data Loss Prevention (DLP)", description: "Deploy DLP controls to detect and prevent exfiltration of sensitive data.", objective: "Reduce risk of accidental or malicious data leakage." },
        { controlId: "DP-05", title: "Data Retention & Disposal", description: "Define retention periods per data type and securely dispose of data beyond its retention period.", objective: "Minimise the volume of sensitive data at risk and comply with data protection regulations." },
      ],
    },
    {
      code: "PES", name: "Physical & Environmental Security", order: 12,
      description: "Physical access controls and environmental protections for facilities and equipment.",
      controls: [
        { controlId: "PES-01", title: "Physical Access Control", description: "Control access to data centres, server rooms, and sensitive areas using badge, PIN, or biometrics.", objective: "Prevent unauthorised physical access to IT infrastructure." },
        { controlId: "PES-02", title: "Visitor Management", description: "Log, escort, and badge all visitors to secure areas; maintain visitor register.", objective: "Maintain accountability for all persons accessing secure facilities." },
        { controlId: "PES-03", title: "CCTV & Surveillance", description: "Install and maintain CCTV coverage of all facility entry/exit points and server rooms with 90-day retention.", objective: "Deter physical intrusion and support forensic investigation of physical security incidents." },
        { controlId: "PES-04", title: "Environmental Controls", description: "Maintain UPS, cooling, fire suppression, and flood detection in data centre facilities.", objective: "Protect IT equipment from environmental damage that could cause data loss or system failure." },
        { controlId: "PES-05", title: "Clean Desk & Screen Policy", description: "Enforce a clean desk policy and auto-lock screen policy (max 10 minutes inactivity).", objective: "Prevent visual and physical access to sensitive information by unauthorised persons." },
      ],
    },
    {
      code: "TPM", name: "Third Party Management", order: 13,
      description: "Risk assessment and ongoing management of vendors, suppliers, and service providers.",
      controls: [
        { controlId: "TPM-01", title: "Vendor Security Assessment", description: "Conduct security assessments of all vendors handling sensitive data or providing critical services before onboarding.", objective: "Prevent introduction of supply chain risk from inadequately secured vendors." },
        { controlId: "TPM-02", title: "Contractual Security Requirements", description: "Include cybersecurity clauses (data protection, incident notification, audit rights) in all vendor contracts.", objective: "Ensure vendors are contractually obligated to maintain appropriate security standards." },
        { controlId: "TPM-03", title: "Third Party Access Control", description: "Provide vendors with least-privilege, time-limited, monitored access to systems.", objective: "Limit exposure from compromised vendor credentials or insider threat from third parties." },
        { controlId: "TPM-04", title: "Vendor Performance Review", description: "Conduct annual security performance reviews of all critical vendors.", objective: "Ensure vendors maintain their security posture over the lifecycle of the relationship." },
        { controlId: "TPM-05", title: "Supply Chain Risk Management", description: "Assess and manage cybersecurity risk in the software and hardware supply chain.", objective: "Prevent compromise via malicious or tampered components in the supply chain." },
      ],
    },
    {
      code: "BCM", name: "Business Continuity Management", order: 14,
      description: "Plans and controls to maintain and recover critical operations following a disruptive event.",
      controls: [
        { controlId: "BCM-01", title: "Business Impact Analysis (BIA)", description: "Conduct a BIA to identify critical processes, dependencies, and recovery priorities.", objective: "Understand what needs to be protected and recovered first in a disaster scenario." },
        { controlId: "BCM-02", title: "Recovery Objectives (RTO/RPO)", description: "Define RTO and RPO for all critical systems based on BIA results.", objective: "Set measurable targets to guide backup, replication, and recovery capabilities." },
        { controlId: "BCM-03", title: "Disaster Recovery Plan (DRP)", description: "Maintain a documented, tested DRP covering failover and recovery procedures for all critical systems.", objective: "Enable structured recovery from major outages within defined RTO/RPO targets." },
        { controlId: "BCM-04", title: "BCM Testing & Exercises", description: "Conduct at least annual tabletop and technical DR exercises with documented results.", objective: "Validate that recovery plans work as designed and that personnel know their roles." },
        { controlId: "BCM-05", title: "Backup & Recovery Management", description: "Perform regular automated backups, store copies off-site, and test restoration periodically.", objective: "Ensure data can be recovered from backup within RPO following data loss or ransomware." },
      ],
    },
    {
      code: "ALM", name: "Audit, Logging & Monitoring", order: 15,
      description: "Generation, protection, retention, and review of security audit logs.",
      controls: [
        { controlId: "ALM-01", title: "Audit Log Generation", description: "Enable and centralise audit logging on all critical systems covering authentication, privilege use, and data access.", objective: "Ensure a complete audit trail is available to support incident investigation and compliance." },
        { controlId: "ALM-02", title: "Log Retention Policy", description: "Retain security logs for a minimum of 12 months with 3 months immediately accessible.", objective: "Meet regulatory requirements and support retrospective forensic investigations." },
        { controlId: "ALM-03", title: "Privileged Activity Logging", description: "Log all administrative actions on critical systems with tamper-proof storage.", objective: "Detect and investigate privileged account abuse or insider threat." },
        { controlId: "ALM-04", title: "Log Integrity Protection", description: "Protect log files from unauthorised modification using write-once storage or cryptographic signing.", objective: "Ensure log evidence remains admissible and trustworthy for investigations." },
        { controlId: "ALM-05", title: "Compliance Audit Programme", description: "Conduct internal compliance audits against this framework at least annually with documented findings.", objective: "Provide assurance that controls are operating effectively and identify gaps for remediation." },
      ],
    },
    {
      code: "MEM", name: "Media & Equipment Management", order: 16,
      description: "Secure sanitisation, disposal, and chain-of-custody controls for media and equipment.",
      controls: [
        { controlId: "MEM-01", title: "Sanitisation Procedure", description: "Define and follow documented sanitisation procedures (overwrite, degauss, or destroy) before asset disposal.", objective: "Prevent sensitive data recovery from decommissioned media and equipment." },
        { controlId: "MEM-02", title: "Secure Media Disposal", description: "Physically destroy or use certified third-party disposal for media containing sensitive or classified data.", objective: "Ensure data cannot be recovered from disposed media under any circumstance." },
        { controlId: "MEM-03", title: "Chain of Custody", description: "Maintain documented chain-of-custody records for all media from decommission to final disposal.", objective: "Provide audit evidence that sensitive media was handled appropriately throughout disposal." },
        { controlId: "MEM-04", title: "Media Inventory Register", description: "Maintain an inventory of all removable and portable media with current custodian.", objective: "Prevent loss of sensitive data stored on untracked media." },
        { controlId: "MEM-05", title: "Disposal Certificates", description: "Obtain and retain certificates of destruction from approved disposal vendors.", objective: "Provide audit evidence for regulatory and internal compliance requirements." },
      ],
    },
  ];

  const ISO27001_DOMAINS: typeof SACS210_DOMAINS = [
    {
      code: "A5", name: "Organizational Controls", order: 1,
      description: "Policies, roles, threat intelligence, information security in projects, and supplier relations.",
      controls: [
        { controlId: "A5.1", title: "Policies for Information Security", description: "Define, approve, publish, and review information security policies.", objective: "Provide management direction and support for information security." },
        { controlId: "A5.2", title: "Information Security Roles & Responsibilities", description: "Assign and communicate responsibilities for information security.", objective: "Ensure all security responsibilities are assigned and understood." },
        { controlId: "A5.7", title: "Threat Intelligence", description: "Collect and analyse information about information security threats.", objective: "Enable informed risk decisions based on current threat landscape." },
        { controlId: "A5.23", title: "Information Security for Cloud Services", description: "Establish processes for acquisition, use, management, and exit from cloud services.", objective: "Manage risks associated with cloud service adoption." },
        { controlId: "A5.35", title: "Independent Review of Information Security", description: "Review the organisation's approach to information security management independently.", objective: "Provide assurance that security management is effective and compliant." },
      ],
    },
    {
      code: "A6", name: "People Controls", order: 2,
      description: "Screening, terms of employment, awareness, training, and offboarding.",
      controls: [
        { controlId: "A6.1", title: "Screening", description: "Background verification checks on all candidates prior to employment.", objective: "Prevent recruitment of persons who may compromise information security." },
        { controlId: "A6.3", title: "Information Security Awareness & Training", description: "Ensure all personnel receive appropriate security awareness education and training.", objective: "Reduce human-factor security risks through knowledge and awareness." },
        { controlId: "A6.5", title: "Responsibilities After Termination", description: "Enforce post-employment information security responsibilities and asset return.", objective: "Protect information after employment or contract ends." },
      ],
    },
    {
      code: "A7", name: "Physical Controls", order: 3,
      description: "Secure areas, physical entry controls, equipment security, and clear desk.",
      controls: [
        { controlId: "A7.1", title: "Physical Security Perimeters", description: "Define and implement physical security perimeters to protect sensitive areas.", objective: "Prevent unauthorised physical access to information processing facilities." },
        { controlId: "A7.4", title: "Physical Security Monitoring", description: "Premises shall be continuously monitored for unauthorised physical access.", objective: "Detect and deter physical intrusion into secure areas." },
        { controlId: "A7.7", title: "Clear Desk and Clear Screen", description: "Enforce rules for clear desk and clear screen to prevent unauthorised access to information.", objective: "Protect sensitive information from unintended disclosure." },
        { controlId: "A7.9", title: "Security of Assets Off-Premises", description: "Apply appropriate security to assets taken off organisational premises.", objective: "Protect assets from risk when outside controlled environments." },
      ],
    },
    {
      code: "A8", name: "Technological Controls", order: 4,
      description: "Access control, cryptography, malware protection, logging, and vulnerability management.",
      controls: [
        { controlId: "A8.2", title: "Privileged Access Rights", description: "Restrict and manage the allocation and use of privileged access rights.", objective: "Prevent unauthorised use of administrative capabilities." },
        { controlId: "A8.5", title: "Secure Authentication", description: "Implement secure authentication technologies and procedures.", objective: "Verify the identity of users, devices, and services." },
        { controlId: "A8.7", title: "Protection Against Malware", description: "Implement protection against malware, supported by user awareness.", objective: "Prevent malware attacks from compromising information security." },
        { controlId: "A8.8", title: "Management of Technical Vulnerabilities", description: "Obtain timely information about technical vulnerabilities and take appropriate measures.", objective: "Prevent exploitation of known vulnerabilities." },
        { controlId: "A8.12", title: "Data Leakage Prevention", description: "Apply data leakage prevention measures to systems and networks handling sensitive information.", objective: "Prevent unauthorised disclosure of sensitive information." },
        { controlId: "A8.15", title: "Logging", description: "Produce, store, protect, and analyse logs that record activities, exceptions, faults, and events.", objective: "Enable detection of anomalous behaviour and support investigations." },
        { controlId: "A8.24", title: "Use of Cryptography", description: "Define and implement rules for effective use of cryptography to protect information.", objective: "Ensure appropriate and effective use of cryptography to protect confidentiality, authenticity, and integrity." },
        { controlId: "A8.28", title: "Secure Coding", description: "Apply secure coding principles in software development.", objective: "Reduce the number of information security vulnerabilities in software." },
      ],
    },
  ];

  // Seed SACS-210
  const sacs210 = await prisma.complianceFramework.upsert({
    where: { code: "SACS-210" },
    update: {},
    create: {
      code: "SACS-210",
      name: "Saudi Aramco Cybersecurity Compliance Certification",
      version: "2024",
      description: "Saudi Aramco's cybersecurity standard for suppliers and service providers operating on or connected to Aramco systems and networks.",
    },
  });

  for (const d of SACS210_DOMAINS) {
    const domain = await prisma.complianceDomain.upsert({
      where: { frameworkId_code: { frameworkId: sacs210.id, code: d.code } },
      update: { name: d.name, description: d.description, order: d.order },
      create: { frameworkId: sacs210.id, code: d.code, name: d.name, description: d.description, order: d.order },
    });
    for (const c of d.controls) {
      await prisma.complianceControl.upsert({
        where: { controlId: c.controlId },
        update: { title: c.title, description: c.description, objective: c.objective, domainId: domain.id },
        create: { controlId: c.controlId, title: c.title, description: c.description, objective: c.objective, domainId: domain.id, status: ControlStatus.NOT_ASSESSED },
      });
    }
  }

  // Seed ISO 27001:2022
  const iso27001 = await prisma.complianceFramework.upsert({
    where: { code: "ISO-27001" },
    update: {},
    create: {
      code: "ISO-27001",
      name: "ISO/IEC 27001:2022 Information Security",
      version: "2022",
      description: "International standard for information security management systems (ISMS), specifying requirements for establishing, implementing, maintaining, and continually improving security controls.",
    },
  });

  for (const d of ISO27001_DOMAINS) {
    const domain = await prisma.complianceDomain.upsert({
      where: { frameworkId_code: { frameworkId: iso27001.id, code: d.code } },
      update: { name: d.name, description: d.description, order: d.order },
      create: { frameworkId: iso27001.id, code: d.code, name: d.name, description: d.description, order: d.order },
    });
    for (const c of d.controls) {
      await prisma.complianceControl.upsert({
        where: { controlId: c.controlId },
        update: { title: c.title, description: c.description, objective: c.objective, domainId: domain.id },
        create: { controlId: c.controlId, title: c.title, description: c.description, objective: c.objective, domainId: domain.id, status: ControlStatus.NOT_ASSESSED },
      });
    }
  }

  console.log(`Seeded SACS-210 (${SACS210_DOMAINS.length} domains, ${SACS210_DOMAINS.reduce((n, d) => n + d.controls.length, 0)} controls) and ISO 27001:2022 (${ISO27001_DOMAINS.length} domains, ${ISO27001_DOMAINS.reduce((n, d) => n + d.controls.length, 0)} controls)`);
}

main()
  .then(async () => {
    await seedCompliance();
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
