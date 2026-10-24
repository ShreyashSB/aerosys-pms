/**
 * Realistic first-load demo data for Aerosys HVAC.
 *
 * Nothing on the dashboards is hardcoded: KPIs are derived from these
 * records. Each project is generated from a small "scenario" (target progress,
 * man-day efficiency, idle share, expense burn) so the demo shows contrasting
 * health states — healthy, efficient, over budget, high idle, low running PPI,
 * low projected margin, completed. Daily logs, BOQ execution and expenses are
 * generated from each other, so every screen tells the same story.
 *
 * All dates are relative to "today" so the demo always looks current.
 */
import type {
  AppNotification,
  AppSettings,
  AttendanceEntry,
  AttendanceStatus,
  BoqExecution,
  BoqItem,
  DailyLog,
  Employee,
  Expense,
  ExpenseCategory,
  IdleReason,
  Instrument,
  Project,
  ProjectAssignment,
  ProjectCost,
  ProjectDocument,
  ProjectInstrument,
  User,
} from "@/types/models";
import { addDays, daysBetween, parseISODate, todayISO } from "@/lib/dates";
import { DEFAULT_SETTINGS } from "@/domain/assumptions";
import { BOQ_TEMPLATES, DISCRETE_UOMS } from "./seedBoq";

export interface Database {
  version: number;
  users: User[];
  employees: Employee[];
  projects: Project[];
  assignments: ProjectAssignment[];
  expenses: Expense[];
  instruments: Instrument[];
  projectInstruments: ProjectInstrument[];
  projectCosts: ProjectCost[];
  boqItems: BoqItem[];
  boqExecutions: BoqExecution[];
  dailyLogs: DailyLog[];
  documents: ProjectDocument[];
  notifications: AppNotification[];
  settings: AppSettings;
}

export const DB_VERSION = 2;

/** Deterministic PRNG so the seed is identical on every fresh load. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, to = 100) => Math.round(n / to) * to;

interface Scenario {
  name: string;
  client: string;
  site: string;
  manager: number;
  value: number;
  ppi: number; // ₹ per allotted man-day
  start: number;
  end: number;
  status: Project["status"];
  /** Day offset on which site work stopped (on-hold projects). */
  stoppedAt?: number;
  boq: keyof typeof BOQ_TEMPLATES;
  progress: number;
  /** Consumed MD ÷ (allotted MD × progress). <1 efficient, >1 inefficient. */
  mdFactor: number;
  idleShare: number;
  idleReasons: IdleReason[];
  /** Consumed expenses ÷ (allotted expenses × progress). */
  expFactor: number;
  team: Array<[emp: number, role: ProjectAssignment["role"], startOffset?: number]>;
  instruments: number[];
  description: string;
}

export function buildSeed(): Database {
  const T = todayISO();
  const d = (offset: number) => addDays(T, offset);
  const now = new Date().toISOString();
  const rand = mulberry32(20260930);
  const pick = <V,>(arr: V[]) => arr[Math.floor(rand() * arr.length)]!;
  const between = (a: number, b: number) => a + rand() * (b - a);

  // ---------------------------------------------------------------- employees
  type E = [name: string, dept: Employee["department"], designation: string, dailyCost: number, joined: string, site: boolean, base: string, status?: Employee["status"]];
  const empRows: E[] = [
    ["Rajesh Kulkarni", "Management", "Managing Director", 12000, "2012-04-01", false, "Pune HO"],
    ["Meera Iyer", "Management", "Director – Operations", 9000, "2014-06-16", false, "Pune HO"],
    ["Anita Deshpande", "Projects", "Senior Project Manager", 5500, "2016-01-11", false, "Pune HO"],
    ["Sandeep Rao", "Projects", "Project Manager", 4800, "2018-08-06", false, "Pune HO"],
    ["Farhan Shaikh", "Projects", "Project Manager", 4500, "2019-03-18", false, "Mumbai Office"],
    ["Sneha Joshi", "Accounts", "Accounts Manager", 3500, "2017-07-03", false, "Pune HO"],
    ["Pooja Nair", "Accounts", "Accounts Executive", 2000, "2022-02-14", false, "Pune HO"],
    ["Rahul Menon", "Admin", "Admin Executive", 1700, "2021-09-01", false, "Pune HO"],
    ["Vikram Patil", "Engineering", "Senior Site Engineer", 3500, "2017-05-22", true, "Pune"],
    ["Amit Chavan", "Engineering", "Site Engineer", 2800, "2020-01-06", true, "Pune"],
    ["Priya Sharma", "Engineering", "Senior Site Engineer", 3400, "2019-11-04", true, "Mumbai"],
    ["Karan Mehta", "Engineering", "Site Engineer", 2700, "2021-06-14", true, "Pune"],
    ["Nikhil Jadhav", "Engineering", "Senior Site Engineer", 3500, "2016-10-10", true, "Nashik"],
    ["Suresh Yadav", "Service", "HVAC Technician", 1800, "2020-08-17", true, "Pune"],
    ["Arjun Reddy", "Engineering", "Site Engineer", 2600, "2022-07-11", true, "Mumbai"],
    ["Deepak Gupta", "Engineering", "Commissioning Engineer", 3200, "2018-12-03", true, "Pune"],
    ["Rohit Pawar", "Service", "HVAC Technician", 1700, "2023-01-09", true, "Pune"],
    ["Imran Khan", "Engineering", "Site Supervisor", 2200, "2019-04-15", true, "Mumbai"],
    ["Kavya Pillai", "Engineering", "Graduate Engineer Trainee", 1500, "2025-07-01", true, "Pune"],
    ["Manoj Bhosale", "Service", "Senior Technician", 2100, "2015-02-02", true, "Pune", "on_leave"],
    ["Sagar Kale", "Engineering", "Site Engineer", 2600, "2023-06-19", true, "Pune"],
    ["Neha Kulkarni", "Engineering", "Senior Site Engineer", 3300, "2021-03-08", true, "Pune"],
    ["Ganesh Shinde", "Service", "HVAC Technician", 1800, "2021-11-22", true, "Pune"],
    ["Sachin More", "Service", "HVAC Technician", 1700, "2022-04-04", true, "Pune"],
    ["Rakesh Jha", "Engineering", "Site Supervisor", 2200, "2018-09-10", true, "Mumbai"],
    ["Vinod Pawar", "Service", "Senior Technician", 2100, "2016-06-06", true, "Pune"],
    ["Tushar Gaikwad", "Engineering", "Site Engineer", 2700, "2022-08-01", true, "Pune"],
    ["Ajay Solanki", "Service", "HVAC Technician", 1700, "2023-03-13", true, "Pune"],
    ["Mahesh Kadam", "Service", "HVAC Technician", 1600, "2024-01-15", true, "Pune"],
    ["Pravin Deshmukh", "Engineering", "Site Engineer", 2800, "2020-10-19", true, "Pune"],
    ["Dinesh Patil", "Service", "HVAC Technician", 1700, "2022-12-05", true, "Pune"],
    ["Omkar Joshi", "Engineering", "Site Engineer", 2600, "2021-02-01", true, "Pune"],
    ["Tanvi Rao", "Engineering", "Site Engineer", 2700, "2024-06-03", true, "Pune"],
    ["Harish Nair", "Engineering", "Senior Site Engineer", 3500, "2015-08-24", true, "Mumbai"],
  ];
  const employees: Employee[] = empRows.map((e, i) => {
    const [first, last] = e[0].split(" ");
    return {
      id: `emp_${i + 1}`,
      code: `AHV-${101 + i}`,
      name: e[0],
      email: `${first!.toLowerCase()}.${last!.toLowerCase()}@aerosyshvac.in`,
      phone: `+91 98${String(22000000 + i * 104729).slice(0, 8)}`,
      department: e[1],
      designation: e[2],
      dailyCost: e[3],
      joiningDate: e[4],
      status: e[7] ?? "active",
      isSiteEngineer: e[5],
      baseLocation: e[6],
    };
  });
  const E = (n: number) => `emp_${n}`;

  const users: User[] = (
    [
      [1, "management"], [2, "management"],
      [3, "project_manager"], [4, "project_manager"], [5, "project_manager"],
      [6, "accounts"], [7, "accounts"],
      [9, "site_engineer"], [10, "site_engineer"], [11, "site_engineer"], [12, "site_engineer"],
      [13, "site_engineer"], [15, "site_engineer"], [16, "site_engineer"], [22, "site_engineer"],
    ] as Array<[number, User["role"]]>
  ).map(([n, role]) => ({ id: `usr_${n}`, employeeId: E(n), role, email: employees[n - 1]!.email }));

  // ------------------------------------------------------------- instruments
  type I = [name: string, category: Instrument["category"], value: number, prefix: string];
  const insRows: I[] = [
    ["Digital Manifold Gauge Set", "Refrigerant Handling", 68000, "TST"],
    ["Two-Stage Vacuum Pump 6 CFM", "Refrigerant Handling", 32000, "VPM"],
    ["Refrigerant Recovery Unit", "Refrigerant Handling", 85000, "RRU"],
    ["Electronic Refrigerant Leak Detector", "Refrigerant Handling", 24000, "LDT"],
    ["Vane Anemometer", "Air Balancing", 18500, "ANM"],
    ["Balometer / Air Flow Capture Hood", "Air Balancing", 245000, "BAL"],
    ["Differential Pressure Manometer", "Air Balancing", 22000, "MNM"],
    ["Thermal Imaging Camera", "Measurement", 310000, "TIC"],
    ["Digital Clamp Meter", "Electrical Testing", 38000, "CLM"],
    ["Insulation Resistance Tester (Megger)", "Electrical Testing", 52000, "IRT"],
    ["Digital Thermo-Hygrometer", "Measurement", 16000, "THG"],
    ["Sound Level Meter", "Measurement", 28000, "SLM"],
    ["Airborne Particle Counter", "Measurement", 380000, "APC"],
    ["Oxy-Acetylene Brazing Kit", "Power Tools", 26000, "BRZ"],
    ["Core Drilling Machine", "Power Tools", 72000, "CDM"],
    ["Duct Leakage Tester", "Air Balancing", 195000, "DLT"],
    ["Rotary Hammer Drill", "Power Tools", 18000, "RHD"],
    ["Full Body Harness Kit (set of 5)", "Safety", 12000, "SFH"],
  ];
  const instruments: Instrument[] = insRows.map((r, i) => ({
    id: `ins_${i + 1}`,
    code: `INS-${String(i + 1).padStart(3, "0")}`,
    name: r[0],
    serialNumber: `${r[3]}-${2019 + (i % 6)}${String(4471 + i * 137).padStart(5, "0")}`,
    category: r[1],
    purchaseValue: r[2],
    purchaseDate: d(-2600 + i * 110),
    status: "available",
    assignedEngineerId: null,
    assignedProjectId: null,
    notes: "",
  }));
  instruments[6]!.status = "maintenance";
  instruments[6]!.notes = "Sent for annual calibration";
  instruments[17]!.status = "retired";
  instruments[17]!.notes = "Damaged beyond repair";

  // ----------------------------------------------------------------- projects
  const scenarios: Scenario[] = [
    {
      name: "Phoenix Mall HVAC Retrofit", client: "Phoenix Marketcity Developers", site: "Viman Nagar, Pune", manager: 3,
      value: 4800000, ppi: 6500, start: -150, end: 90, status: "active", boq: "chillerRetrofit",
      progress: 0.64, mdFactor: 0.95, idleShare: 0.03, idleReasons: ["Material unavailable", "Approval pending"], expFactor: 0.9,
      team: [[9, "Lead Engineer"], [12, "Site Engineer", 10], [14, "Technician", 5], [23, "Technician", 30]],
      instruments: [1, 2, 14],
      description: "Installation, testing & commissioning of chiller plant retrofit and AHU/FCU replacement across 3 retail floors, with BMS integration.",
    },
    {
      name: "Orchid IT Park Chiller Upgrade", client: "Orchid Infospace Pvt Ltd", site: "Hinjewadi Phase 2, Pune", manager: 4,
      value: 3200000, ppi: 7000, start: -110, end: 60, status: "active", boq: "chillerRetrofit",
      progress: 0.74, mdFactor: 0.7, idleShare: 0.02, idleReasons: ["Approval pending"], expFactor: 0.8,
      team: [[10, "Lead Engineer"], [17, "Technician"], [28, "Technician", 15]],
      instruments: [4, 9],
      description: "Central chiller plant upgrade with VFD-driven pumps, cooling tower refurbishment and plant room automation.",
    },
    {
      name: "GreenTech Manufacturing Plant", client: "GreenTech Components Pvt Ltd", site: "Chakan MIDC, Pune", manager: 4,
      value: 5600000, ppi: 6500, start: -120, end: 150, status: "active", boq: "ventilation",
      progress: 0.42, mdFactor: 1.04, idleShare: 0.04, idleReasons: ["Material unavailable", "Equipment unavailable"], expFactor: 1.6,
      team: [[13, "Lead Engineer"], [24, "Technician"], [27, "Site Engineer", 20], [29, "Technician", 25]],
      instruments: [15, 10],
      description: "Complete ventilation for new auto-component plant: exhaust systems, spot cooling ducting, jet fans and kitchen exhaust.",
    },
    {
      name: "Sunrise Commercial Tower VRF", client: "Sunrise Realty LLP", site: "BKC, Mumbai", manager: 5,
      value: 4000000, ppi: 6500, start: -100, end: 140, status: "active", boq: "vrf",
      progress: 0.33, mdFactor: 1.12, idleShare: 0.25, idleReasons: ["Site not ready", "Site not ready", "Client dependency", "Material unavailable"], expFactor: 1.0,
      team: [[11, "Lead Engineer"], [15, "Site Engineer"], [18, "Supervisor", 10], [25, "Supervisor", 20]],
      instruments: [5, 3],
      description: "VRF system for 18-storey Grade-A office tower including fresh air units, ducting and energy recovery ventilators.",
    },
    {
      name: "Apex Pharma Cleanroom HVAC", client: "Apex Lifesciences Ltd", site: "Ranjangaon MIDC", manager: 3,
      value: 3600000, ppi: 7000, start: -90, end: 120, status: "active", boq: "cleanroom",
      progress: 0.36, mdFactor: 1.42, idleShare: 0.06, idleReasons: ["Design issue", "Approval pending"], expFactor: 1.1,
      team: [[16, "Lead Engineer"], [30, "Site Engineer"], [26, "Technician", 10]],
      instruments: [13, 11],
      description: "ISO Class 7/8 cleanroom HVAC with pressure cascades, AHUs with terminal HEPA and validation (DQ/IQ/OQ) support.",
    },
    {
      name: "Metro Hospital HVAC Installation", client: "Metro Healthcare Ltd", site: "Gangapur Road, Nashik", manager: 5,
      value: 2800000, ppi: 7000, start: -200, end: 12, status: "active", boq: "cleanroom",
      progress: 0.88, mdFactor: 1.12, idleShare: 0.07, idleReasons: ["Client dependency", "Design issue", "Weather"], expFactor: 1.15,
      team: [[22, "Lead Engineer"], [19, "Site Engineer"], [21, "Site Engineer", 30]],
      instruments: [6, 8],
      description: "HVAC for 150-bed hospital with modular OT air handling, HEPA filtration, ICU pressure zoning and isolation rooms.",
    },
    {
      name: "Cityscape Hotel Ventilation Revamp", client: "Cityscape Hospitality Pvt Ltd", site: "Koregaon Park, Pune", manager: 4,
      value: 2000000, ppi: 6500, start: -35, end: 95, status: "active", boq: "ventilation",
      progress: 0.24, mdFactor: 0.98, idleShare: 0.03, idleReasons: ["Client dependency"], expFactor: 0.9,
      team: [[31, "Technician"], [32, "Site Engineer"]],
      instruments: [12],
      description: "Kitchen exhaust & fresh air system revamp for 120-room hotel including toilet exhaust and car-park ventilation.",
    },
    {
      name: "Riverside School AHU Replacement", client: "Riverside Education Trust", site: "Kothrud, Pune", manager: 3,
      value: 1400000, ppi: 6500, start: -150, end: 10, status: "on_hold", stoppedAt: -40, boq: "ducting",
      progress: 0.55, mdFactor: 1.05, idleShare: 0.14, idleReasons: ["Approval pending", "Client dependency"], expFactor: 0.9,
      team: [[20, "Technician"], [33, "Site Engineer"]],
      instruments: [],
      description: "Replacement of 12 ageing AHUs across classrooms and auditorium. On hold pending client approval of revised auditorium layout.",
    },
    {
      name: "Blue Ridge Clubhouse VRF", client: "Blue Ridge Township", site: "Hinjewadi, Pune", manager: 5,
      value: 1800000, ppi: 7000, start: -300, end: -160, status: "completed", boq: "vrf",
      progress: 1, mdFactor: 0.92, idleShare: 0.03, idleReasons: ["Weather"], expFactor: 0.85,
      team: [[12, "Lead Engineer"], [14, "Technician"]],
      instruments: [1],
      description: "VRF air-conditioning for clubhouse, banquet hall, gymnasium and indoor pool dehumidification.",
    },
    {
      name: "Horizon Logistics Warehouse Ventilation", client: "Horizon Logistics Pvt Ltd", site: "Talegaon MIDC", manager: 4,
      value: 2200000, ppi: 6500, start: -420, end: -230, status: "completed", boq: "ventilation",
      progress: 1, mdFactor: 1.03, idleShare: 0.05, idleReasons: ["Material unavailable"], expFactor: 1.0,
      team: [[10, "Lead Engineer"], [17, "Technician"]],
      instruments: [16],
      description: "Roof-mounted ventilation and HVLS fans for 80,000 sq.ft. warehouse with dock-area spot cooling.",
    },
    {
      name: "Nova Data Centre Precision Cooling", client: "Nova Datacenters Pvt Ltd", site: "Mahape, Navi Mumbai", manager: 5,
      value: 6000000, ppi: 7500, start: 20, end: 260, status: "planning", boq: "precisionCooling",
      progress: 0, mdFactor: 1, idleShare: 0, idleReasons: [], expFactor: 0, team: [], instruments: [],
      description: "Precision cooling with in-row units, chilled water plant with free cooling and N+1 redundancy for 2 MW IT load.",
    },
    {
      name: "Sai Krupa Mall Ducting Works", client: "Sai Krupa Developers", site: "Jalna Road, Aurangabad", manager: 3,
      value: 1600000, ppi: 7000, start: 35, end: 150, status: "planning", boq: "ducting",
      progress: 0, mdFactor: 1, idleShare: 0, idleReasons: [], expFactor: 0, team: [], instruments: [],
      description: "GI ducting, diffusers and insulation package for 3-level shopping centre (installation & testing).",
    },
  ];

  const projects: Project[] = [];
  const assignments: ProjectAssignment[] = [];
  const boqItems: BoqItem[] = [];
  const boqExecutions: BoqExecution[] = [];
  const dailyLogs: DailyLog[] = [];
  const expenses: Expense[] = [];
  const projectInstruments: ProjectInstrument[] = [];
  const documents: ProjectDocument[] = [];
  /** employeeId → dates already logged on some project (no double booking). */
  const booked = new Map<string, Set<string>>();
  const isBooked = (emp: string, date: string) => booked.get(emp)?.has(date) ?? false;
  const book = (emp: string, date: string) => {
    if (!booked.has(emp)) booked.set(emp, new Set());
    booked.get(emp)!.add(date);
  };
  const HOLIDAYS = new Set(["01-26", "08-15", "10-02", "05-01"]);
  const periodStart = `${T.slice(0, 8)}01`;
  const seq = { asg: 1, boq: 1, exe: 1, log: 1, exp: 1, pi: 1, doc: 1 };

  scenarios.forEach((s, pi) => {
    const id = `prj_${pi + 1}`;
    const allottedManDays = Math.round(s.value / s.ppi / 5) * 5;
    const allottedExpenses = round(s.value * 0.3, 10000);
    const startDate = d(s.start);
    const endDate = d(s.end);
    projects.push({
      id,
      code: `PRJ-${parseISODate(startDate).getFullYear()}-${String(pi + 1).padStart(3, "0")}`,
      name: s.name,
      clientName: s.client,
      site: s.site,
      managerId: E(s.manager),
      contractValue: s.value,
      estimatedCost: round(s.value * 0.78, 10000),
      allottedManDays,
      allottedExpenses,
      startDate,
      endDate,
      periodStart: s.status === "completed" ? endDate : periodStart,
      description: s.description,
      status: s.status,
      createdAt: new Date(parseISODate(addDays(startDate, -20)).getTime() + 10 * 3600000).toISOString(),
      updatedAt: now,
    });

    // ---- BOQ: scale template quantities so items ≈ 90% of value, lump sum absorbs the rest
    const tpl = BOQ_TEMPLATES[s.boq]!;
    const rawTotal = tpl.items.reduce((acc, it) => acc + it.qty * it.rate, 0);
    const factor = (s.value * 0.9) / rawTotal;
    const items: BoqItem[] = tpl.items.map((it, i) => ({
      id: `boq_${seq.boq++}`,
      projectId: id,
      srNo: String(i + 1),
      description: it.description,
      uom: it.uom,
      contractQty: Math.max(1, Math.round(it.qty * factor)),
      rate: it.rate,
    }));
    const itemsTotal = items.reduce((acc, it) => acc + it.contractQty * it.rate, 0);
    items.push({ id: `boq_${seq.boq++}`, projectId: id, srNo: String(items.length + 1), description: tpl.lumpSum, uom: "Lot", contractQty: 1, rate: s.value - itemsTotal });
    boqItems.push(...items);

    // ---- documents
    const docs: Array<[string, ProjectDocument["type"], number]> = [
      [`Work Order – ${s.client}.pdf`, "Work Order", 412000],
      ["Annexure A – Bill of Quantities.xlsx", "Annexure / BOQ", 86000],
      ["HVAC layout drawings – Rev C.pdf", "Drawing", 3850000],
    ];
    if (s.status !== "planning") docs.push(["Measurement sheet – RA Bill 1.xlsx", "Measurement Sheet", 64000]);
    for (const [name, type, size] of docs)
      documents.push({
        id: `doc_${seq.doc++}`, projectId: id, name, type, size,
        mimeType: name.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: E(s.manager), uploadedAt: new Date(parseISODate(addDays(startDate, -5)).getTime() + 11 * 3600000).toISOString(),
      });

    if (s.status === "planning") return;

    // ---- team assignments
    const logEnd = s.status === "completed" ? endDate : s.stoppedAt !== undefined ? d(s.stoppedAt) : d(-1);
    for (const [emp, role, off] of s.team) {
      assignments.push({
        id: `asg_${seq.asg++}`,
        projectId: id,
        employeeId: E(emp),
        role,
        allocation: 100,
        startDate: addDays(startDate, off ?? 0),
        endDate: s.status === "active" ? null : logEnd,
      });
    }
    const team = assignments.filter((a) => a.projectId === id);

    // ---- working days
    const days: string[] = [];
    for (let x = startDate; x <= logEnd; x = addDays(x, 1)) {
      if (parseISODate(x).getDay() !== 0) days.push(x); // Sundays: weekly off, no log
    }
    const workDays = days.filter((x) => !HOLIDAYS.has(x.slice(5)));
    const allotted = allottedManDays;
    const targetMd = allotted * s.progress * s.mdFactor;
    const avgPeople = targetMd / Math.max(1, workDays.length);

    // ---- daily logs with attendance
    const logs: DailyLog[] = [];
    let disruptionReason: IdleReason | null = null;
    let disruptionLeft = 0;
    for (const date of days) {
      const available = team.filter((a) => a.startDate <= date && !isBooked(a.employeeId, date));
      if (!available.length) continue;
      const attendance: AttendanceEntry[] = [];
      if (HOLIDAYS.has(date.slice(5))) {
        for (const a of available) attendance.push({ employeeId: a.employeeId, status: "holiday", idleHours: 0, idleReason: null });
      } else {
        // idle disruptions come in short spells (site not ready for a few days…)
        if (disruptionLeft <= 0 && rand() < s.idleShare * 0.28) {
          disruptionReason = pick(s.idleReasons);
          disruptionLeft = 1 + Math.floor(rand() * 3);
        }
        const disrupted = disruptionLeft-- > 0;
        let k = Math.floor(avgPeople) + (rand() < avgPeople % 1 ? 1 : 0);
        k = Math.min(k, available.length);
        const shuffled = [...available].sort(() => rand() - 0.5);
        shuffled.slice(0, k).forEach((a) => {
          let status: AttendanceStatus = rand() < 0.06 ? "off_site" : "on_site";
          let idleHours = 0;
          let idleReason: IdleReason | null = null;
          if (disrupted && rand() < 0.8) {
            status = "idle";
            idleReason = disruptionReason;
          } else if (s.idleShare > 0 && rand() < 0.12) {
            idleHours = Math.max(1, Math.min(6, Math.round(s.idleShare * 20)));
            idleReason = pick(s.idleReasons);
          }
          attendance.push({ employeeId: a.employeeId, status, idleHours, idleReason });
          book(a.employeeId, date);
        });
        const rest = shuffled.slice(k);
        if (rest.length && rand() < 0.05) attendance.push({ employeeId: rest[0]!.employeeId, status: "leave", idleHours: 0, idleReason: null });
      }
      if (!attendance.length) continue;
      logs.push({
        id: `log_${seq.log++}`,
        projectId: id,
        date,
        attendance,
        activities: "",
        remarks: "",
        createdById: E(s.manager),
        createdAt: new Date(parseISODate(date).getTime() + 19 * 3600000).toISOString(),
        updatedAt: new Date(parseISODate(date).getTime() + 19 * 3600000).toISOString(),
      });
    }

    // ---- BOQ execution: value-weighted target, earlier items further along
    const n = items.length;
    let pct = items.map((_, i) => Math.min(1, s.progress * (1.35 - (0.7 * i) / Math.max(1, n - 1))));
    for (let iter = 0; iter < 8 && s.progress < 1; iter++) {
      const val = items.reduce((acc, it, i) => acc + it.contractQty * it.rate * pct[i]!, 0);
      const f = (s.progress * s.value) / val;
      pct = pct.map((x) => Math.min(1, x * f));
    }
    if (s.progress >= 1) pct = items.map(() => 1);
    const workLogs = logs.filter((l) => l.attendance.some((a) => a.status === "on_site" || a.status === "off_site"));
    items.forEach((it, i) => {
      const discrete = DISCRETE_UOMS.has(it.uom);
      let qty = it.contractQty * pct[i]!;
      qty = it.uom === "Lot" ? Math.round(qty * 100) / 100 : discrete ? Math.round(qty) : Math.round(qty);
      if (qty <= 0 || !workLogs.length) return;
      const from = Math.floor(workLogs.length * Math.min(0.85, (0.55 * i) / n));
      const window = workLogs.slice(from);
      const chunkSize = it.uom === "Lot" ? qty / 4 : discrete ? Math.max(1, Math.ceil(it.contractQty / 25)) : Math.max(5, it.contractQty / 30);
      const chunks = Math.max(1, Math.min(window.length, Math.ceil(qty / chunkSize), 30));
      const chosen = [...window].sort(() => rand() - 0.5).slice(0, chunks).sort((a, b) => a.date.localeCompare(b.date));
      let remaining = qty;
      chosen.forEach((log, c) => {
        const left = chunks - c;
        let part = c === chunks - 1 ? remaining : remaining / left;
        part = it.uom === "Lot" ? Math.round(part * 100) / 100 : Math.round(part);
        if (part <= 0) return;
        remaining = Math.round((remaining - part) * 100) / 100;
        boqExecutions.push({ id: `exe_${seq.exe++}`, projectId: id, boqItemId: it.id, date: log.date, qty: part, remarks: "", dailyLogId: log.id });
      });
    });
    // activity text & remarks from what was executed that day
    const exeByLog = new Map<string, BoqExecution[]>();
    for (const x of boqExecutions) if (x.dailyLogId && x.projectId === id) exeByLog.set(x.dailyLogId, [...(exeByLog.get(x.dailyLogId) ?? []), x]);
    for (const log of logs) {
      const exe = exeByLog.get(log.id) ?? [];
      const idleEntry = log.attendance.find((a) => a.idleReason);
      if (log.attendance.every((a) => a.status === "holiday")) {
        log.activities = "National holiday – site closed";
      } else if (exe.length) {
        log.activities = exe
          .map((x) => items.find((it) => it.id === x.boqItemId)!.description.split(/[–(]/)[0]!.trim())
          .join("; ");
      } else if (log.attendance.every((a) => a.status === "idle")) {
        log.activities = "Crew on standby";
      } else {
        log.activities = pick(["Material shifting & marking", "Site coordination with civil contractor", "Supports & hangers fixing", "Punch-list rectification", "Pre-installation checks"]);
      }
      if (idleEntry) log.remarks = `Idle: ${idleEntry.idleReason}`;
      else if (rand() < 0.08) log.remarks = pick(["Client walkthrough done", "Safety toolbox talk conducted", "Material received at site", "Drawings revision received"]);
    }
    dailyLogs.push(...logs);

    // ---- expenses: approved total ≈ allotted × progress × expFactor
    const categories: Array<[ExpenseCategory, number, number, string[]]> = [
      ["Accommodation", 18000, 42000, ["Site lodging – monthly rent", "Guest house – weekly stay", "Hotel stay during commissioning"]],
      ["Food", 6000, 22000, ["Crew mess bill", "Meals during night shift", "Site canteen – fortnightly"]],
      ["Travel", 2500, 16000, ["Train tickets – crew mobilisation", "Bus fare to site", "Cab for commissioning visit"]],
      ["Local Conveyance", 1500, 7000, ["Local transport for material pickup", "Two-wheeler fuel reimbursement", "Auto / local cab to site"]],
      ["Site Material", 8000, 60000, ["Urgent copper fittings purchase", "Supports, anchors & fasteners", "Nitrogen & refrigerant top-up", "Insulation tape & sealant"]],
      ["Tools & Consumables", 2000, 14000, ["Drill bits & cutting discs", "Brazing rods & flux", "PPE – gloves & masks"]],
      ["Other", 1000, 6000, ["Printing of drawings", "Courier of documents to client", "Site pass & gate charges"]],
    ];
    const weights = [0.22, 0.2, 0.12, 0.1, 0.24, 0.08, 0.04];
    const targetApproved = allottedExpenses * s.progress * s.expFactor;
    const records: Expense[] = [];
    if (workLogs.length) {
      const count = Math.max(6, Math.round(targetApproved / 16000));
      for (let k = 0; k < count; k++) {
        const r = rand();
        let acc = 0;
        let ci = 0;
        for (; ci < weights.length - 1; ci++) if ((acc += weights[ci]!) > r) break;
        const [category, min, max, descs] = categories[ci]!;
        const log = workLogs[Math.floor(((k + rand()) / count) * workLogs.length)] ?? workLogs[workLogs.length - 1]!;
        const worker = log.attendance.find((a) => a.status === "on_site") ?? log.attendance[0]!;
        const age = daysBetween(log.date, T);
        const pending = s.status === "active" && age <= 12 && rand() < 0.65;
        records.push({
          id: `exp_${seq.exp}`,
          code: `EXP-${1000 + seq.exp++}`,
          employeeId: worker.employeeId,
          projectId: id,
          category,
          amount: between(min, max),
          date: log.date,
          description: pick(descs),
          receipt: rand() > 0.2 ? { fileName: `receipt_${seq.exp}.jpg`, size: Math.round(between(80000, 480000)), mimeType: "image/jpeg" } : null,
          dailyLogId: category === "Food" || category === "Local Conveyance" ? log.id : null,
          status: pending ? "pending" : "approved",
          submittedAt: new Date(parseISODate(log.date).getTime() + 19.5 * 3600000).toISOString(),
          reviewedById: pending ? null : E(s.manager),
          reviewedAt: pending ? null : new Date(parseISODate(addDays(log.date, 2)).getTime() + 11 * 3600000).toISOString(),
          reviewNote: "",
        });
      }
      const approved = records.filter((x) => x.status === "approved");
      const sumApproved = approved.reduce((acc, x) => acc + x.amount, 0);
      const f = sumApproved > 0 ? targetApproved / sumApproved : 1;
      for (const x of records) x.amount = round(x.status === "approved" ? x.amount * f : x.amount, 10);
      // a few rejected claims (not counted)
      for (let k = 0; k < 2; k++) {
        const base = records[Math.floor(rand() * records.length)]!;
        records.push({ ...base, id: `exp_${seq.exp}`, code: `EXP-${1000 + seq.exp++}`, amount: round(between(1500, 9000), 10), status: "rejected", reviewNote: "Not a project expense / duplicate claim", description: "Personal travel claim", category: "Travel", dailyLogId: null });
      }
    }
    expenses.push(...records);

    // ---- instrument deployments
    s.instruments.forEach((insN, k) => {
      const ins = instruments[insN - 1]!;
      const assignedAt = addDays(startDate, 10 + k * 12);
      const engineer = team[k % team.length]!;
      const open = s.status === "active";
      projectInstruments.push({
        id: `pi_${seq.pi++}`,
        instrumentId: ins.id,
        projectId: id,
        engineerId: engineer.employeeId,
        assignedAt,
        returnedAt: open ? null : logEnd,
      });
      if (open) {
        ins.status = "assigned";
        ins.assignedEngineerId = engineer.employeeId;
        ins.assignedProjectId = id;
      }
    });
  });

  // ------------------------------------------------------ other direct costs
  const projectCosts: ProjectCost[] = [
    { id: "pc_1", projectId: "prj_3", type: "hire", description: "Scissor lift hire – 2 months", amount: 84000, date: d(-60) },
    { id: "pc_2", projectId: "prj_6", type: "subcontract", description: "Sub-contract insulation crew", amount: 96000, date: d(-45) },
    { id: "pc_3", projectId: "prj_1", type: "hire", description: "Crane & rigging for chiller shifting", amount: 45000, date: d(-100) },
  ];

  // ----------------------------------------------------------- notifications
  const notifications: AppNotification[] = [];
  const pending = expenses.filter((e) => e.status === "pending").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  for (const e of pending) {
    const emp = employees.find((x) => x.id === e.employeeId)!;
    const project = projects.find((p) => p.id === e.projectId)!;
    notifications.push({
      id: `ntf_${notifications.length + 1}`,
      type: "expense_submitted",
      title: "Expense submitted for approval",
      message: `${emp.name} submitted ${e.category} expense of ₹${e.amount.toLocaleString("en-IN")} on ${project.name}.`,
      link: `/expenses?status=pending`,
      createdAt: e.submittedAt,
      audienceRoles: ["management", "accounts"],
      audienceEmployeeIds: [project.managerId],
      readBy: [],
    });
  }

  return {
    version: DB_VERSION,
    users,
    employees,
    projects,
    assignments,
    expenses,
    instruments,
    projectInstruments,
    projectCosts,
    boqItems,
    boqExecutions,
    dailyLogs,
    documents,
    notifications,
    settings: { ...DEFAULT_SETTINGS },
  };
}
