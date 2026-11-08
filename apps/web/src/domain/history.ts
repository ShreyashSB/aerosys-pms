/**
 * How the change history reads on screen: names for record kinds and fields,
 * and how each value is shown (₹ for money, dates, yes/no).
 */
import type { AuditAction, AuditChange, AuditEntity } from "@/types/models";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { ROLE_LABELS } from "@/auth/permissions";

export const ENTITY_LABELS: Record<AuditEntity, string> = {
  employee: "Employee",
  login: "Login",
  project: "Project",
  client: "Client",
  assignment: "Team assignment",
  boq_item: "BOQ item",
  boq_execution: "BOQ measurement",
  daily_log: "Daily log",
  expense: "Expense",
  bill: "Bill / invoice",
  project_cost: "Other project cost",
  instrument: "Instrument",
  document: "Document",
  reviews: "Engineer reviews",
  settings: "Settings",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Added",
  update: "Changed",
  delete: "Removed",
};

const FIELD_LABELS: Record<string, string> = {
  code: "Code",
  name: "Name",
  email: "Email",
  phone: "Phone",
  department: "Department",
  designation: "Designation",
  dailyCost: "Daily cost",
  joiningDate: "Joining date",
  status: "Status",
  isSiteEngineer: "Site engineer",
  baseLocation: "Base location",
  role: "Role",
  active: "Login active",
  client: "Client",
  site: "Site",
  projectType: "Project type",
  manager: "Project manager",
  workOrderNo: "Work order no.",
  poNo: "PO no.",
  poDate: "PO date",
  contractValue: "Contract value",
  estimatedCost: "Estimated cost",
  allottedManDays: "Allotted man-days",
  allottedExpenses: "Allotted expenses",
  operationalCostPerManDay: "Operation cost per man-day",
  startDate: "Start date",
  endDate: "End date",
  periodStart: "Measurement period start",
  description: "Description",
  engineer: "Engineer",
  allocation: "Allocation",
  srNo: "Sr. no.",
  uom: "Unit",
  contractQty: "Contract qty",
  rate: "Rate",
  boqItem: "BOQ item",
  date: "Date",
  qty: "Quantity",
  remarks: "Remarks",
  activities: "Activities",
  createdBy: "Logged by",
  employee: "Employee",
  category: "Category",
  amount: "Amount",
  receipt: "Receipt",
  kind: "Type",
  number: "Number",
  party: "Party",
  notes: "Notes",
  attachment: "Attachment",
  type: "Type",
  size: "File size",
  serialNumber: "Serial no.",
  assetValue: "Asset value",
  purchaseDate: "Purchase date",
  endOfLifeDate: "End of life",
  currentLocation: "Location",
  calibrationCertificate: "Calibration certificate",
  calibrationValidUntil: "Calibration valid until",
  deployedTo: "Deployed to project",
  withEngineer: "With engineer",
  companyName: "Company name",
  deadlineAlertDays: "Deadline alert (days)",
  hoursPerManDay: "Hours per man-day",
  projectionMethod: "Projection method",
  targetMarginPct: "Target margin",
};

const MONEY = new Set(["dailyCost", "contractValue", "estimatedCost", "allottedExpenses", "operationalCostPerManDay", "rate", "amount", "assetValue"]);
const PERCENT = new Set(["allocation", "targetMarginPct"]);

const VALUE_LABELS: Record<string, string> = {
  active: "Active",
  on_leave: "On leave",
  inactive: "Inactive",
  planning: "Planning",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
  available: "Available",
  assigned: "Assigned",
  maintenance: "Maintenance",
  retired: "Retired",
  vendor_bill: "Vendor bill",
  client_invoice: "Client invoice",
  subcontract: "Sub-contract labour",
  hire: "Equipment hire",
  other: "Other",
  performance: "Performance based",
  budget: "Budget based",
  ...ROLE_LABELS,
};

/** "dailyCost" → "Daily cost". Fields that already read as words ("Attendance · Ravi") stay as they are. */
export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  if (/\s/.test(field)) return field;
  const words = field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (MONEY.has(field)) return formatINR(value);
    if (PERCENT.has(field)) return `${formatNumber(value, 2)}%`;
    if (field === "size") return `${formatNumber(value / 1024, 0)} KB`;
    return formatNumber(value, 3);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
    return VALUE_LABELS[value] ?? value;
  }
  return JSON.stringify(value);
}

/** For a money field, how much it went up or down, e.g. "+₹40,000". */
export function moneyDelta(change: AuditChange): string | null {
  if (!MONEY.has(change.field) || typeof change.from !== "number" || typeof change.to !== "number") return null;
  const d = change.to - change.from;
  if (d === 0) return null;
  return `${d > 0 ? "+" : "−"}${formatINR(Math.abs(d))}`;
}

/** Record kinds that matter most for cost control, offered first in the filter. */
export const ENTITY_ORDER: AuditEntity[] = [
  "employee",
  "project",
  "daily_log",
  "expense",
  "bill",
  "project_cost",
  "boq_item",
  "boq_execution",
  "assignment",
  "instrument",
  "document",
  "reviews",
  "settings",
  "login",
  "client",
];
