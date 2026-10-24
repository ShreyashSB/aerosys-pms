/**
 * Core domain model. These types mirror what a future REST API would return.
 * Relationships are expressed via ids only (no embedded copies) so there is a
 * single source of truth for every entity.
 */

export type ID = string;
export type ISODate = string; // yyyy-mm-dd
export type ISODateTime = string;

export type Role = "management" | "project_manager" | "site_engineer" | "accounts";

export interface User {
  id: ID;
  employeeId: ID;
  role: Role;
  email: string;
}

export type Department = "Management" | "Projects" | "Engineering" | "Accounts" | "Admin" | "Service";
export type EmployeeStatus = "active" | "on_leave" | "inactive";

export interface Employee {
  id: ID;
  code: string; // EMP-001
  name: string;
  email: string;
  phone: string;
  department: Department;
  designation: string;
  /**
   * Internal project costing rate in ₹ per man-day. Entered directly by an
   * authorised user – deliberately NOT derived from salary / CTC.
   */
  dailyCost: number;
  joiningDate: ISODate;
  status: EmployeeStatus;
  isSiteEngineer: boolean;
  baseLocation: string;
}

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";

export interface Project {
  id: ID;
  code: string; // PRJ-2026-001
  name: string;
  clientName: string;
  site: string;
  managerId: ID;
  /** Work order value. */
  contractValue: number;
  /** Budgeted total cost (all cost heads). */
  estimatedCost: number;
  /** Man-days allotted in the estimate – the PPI baseline. */
  allottedManDays: number;
  /** Budget for site expenses (travel, stay, consumables…). */
  allottedExpenses: number;
  startDate: ISODate;
  endDate: ISODate; // expected completion
  /** Start of the current measurement (RA bill) period – splits Previous vs Current BOQ quantities. */
  periodStart: ISODate;
  description: string;
  status: ProjectStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProjectAssignment {
  id: ID;
  projectId: ID;
  employeeId: ID;
  role: "Lead Engineer" | "Site Engineer" | "Technician" | "Supervisor";
  allocation: number; // planned % of time on the project (availability planning; wages come from daily logs)
  startDate: ISODate;
  endDate: ISODate | null; // null = still active
}

export type ExpenseCategory =
  | "Travel"
  | "Accommodation"
  | "Food"
  | "Local Conveyance"
  | "Site Material"
  | "Tools & Consumables"
  | "Other";

export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface Receipt {
  fileName: string;
  size: number;
  mimeType: string;
  dataUrl?: string; // small images kept locally to simulate upload
}

export interface Expense {
  id: ID;
  code: string;
  employeeId: ID;
  projectId: ID;
  category: ExpenseCategory;
  amount: number;
  date: ISODate;
  description: string;
  receipt: Receipt | null;
  /** Set when the expense was raised from a daily work log. */
  dailyLogId: ID | null;
  status: ExpenseStatus;
  submittedAt: ISODateTime;
  reviewedById: ID | null;
  reviewedAt: ISODateTime | null;
  reviewNote: string;
}

export type InstrumentStatus = "available" | "assigned" | "maintenance" | "retired";
export type InstrumentCategory =
  | "Measurement"
  | "Refrigerant Handling"
  | "Air Balancing"
  | "Electrical Testing"
  | "Power Tools"
  | "Safety";

export interface Instrument {
  id: ID;
  code: string; // INS-001
  name: string;
  serialNumber: string;
  category: InstrumentCategory;
  purchaseValue: number;
  purchaseDate: ISODate;
  status: InstrumentStatus;
  assignedEngineerId: ID | null;
  assignedProjectId: ID | null;
  notes: string;
}

/** History of instrument deployments. Drives instrument/equipment cost. */
export interface ProjectInstrument {
  id: ID;
  instrumentId: ID;
  projectId: ID;
  engineerId: ID | null;
  assignedAt: ISODate;
  returnedAt: ISODate | null;
}

export type ProjectCostType = "subcontract" | "hire" | "other";

/** Other direct project costs not covered by expenses (e.g. sub-contract labour, crane hire). */
export interface ProjectCost {
  id: ID;
  projectId: ID;
  type: ProjectCostType;
  description: string;
  amount: number;
  date: ISODate;
}

export type NotificationType =
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "engineer_assigned"
  | "instrument_assigned"
  | "project_deadline"
  | "project_completion"
  | "project_created"
  | "idle_recorded";

export interface AppNotification {
  id: ID;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  createdAt: ISODateTime;
  /** Roles that should see this notification. */
  audienceRoles: Role[];
  /** Specific employees that should see it (in addition to roles). */
  audienceEmployeeIds: ID[];
  readBy: ID[]; // user ids
  dedupeKey?: string;
}

// ---------------------------------------------------------------- Annexure / BOQ

export interface BoqItem {
  id: ID;
  projectId: ID;
  srNo: string;
  description: string;
  uom: string;
  contractQty: number;
  rate: number;
}

/** Quantity executed against a BOQ item – from a daily log or a manual measurement. */
export interface BoqExecution {
  id: ID;
  projectId: ID;
  boqItemId: ID;
  date: ISODate;
  qty: number;
  remarks: string;
  dailyLogId: ID | null;
}

// ---------------------------------------------------------------- Daily work log

export type AttendanceStatus = "on_site" | "off_site" | "idle" | "weekly_off" | "holiday" | "leave";

export type IdleReason =
  | "Site not ready"
  | "Material unavailable"
  | "Client dependency"
  | "Equipment unavailable"
  | "Approval pending"
  | "Design issue"
  | "Weather"
  | "Other";

export interface AttendanceEntry {
  employeeId: ID;
  status: AttendanceStatus;
  /** Partial idle time (man-hours) for someone otherwise working. */
  idleHours: number;
  idleReason: IdleReason | null;
}

export interface DailyLog {
  id: ID;
  projectId: ID;
  date: ISODate;
  attendance: AttendanceEntry[];
  activities: string;
  remarks: string;
  createdById: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------- Documents

export type DocumentType = "Work Order" | "Annexure / BOQ" | "Drawing" | "Measurement Sheet" | "Correspondence" | "Other";

export interface ProjectDocument {
  id: ID;
  projectId: ID;
  name: string;
  type: DocumentType;
  size: number;
  mimeType: string;
  uploadedById: ID;
  uploadedAt: ISODateTime;
}

export type ProjectionMethod = "performance" | "budget";

export interface AppSettings {
  companyName: string;
  /** Monthly instrument usage charge as a % of purchase value. */
  instrumentMonthlyRatePct: number;
  /** Days before expected completion that triggers a deadline alert. */
  deadlineAlertDays: number;
  /** Working hours in one man-day – converts idle man-hours to idle man-days. */
  hoursPerManDay: number;
  /** Overhead charged as a % of wages (demo assumption). */
  overheadPctOfWages: number;
  /** Management charges as a % of earned value (demo assumption). */
  managementPctOfEarnedValue: number;
  /** How remaining cost is projected. */
  projectionMethod: ProjectionMethod;
  /** Margin below which projected profit is flagged. */
  targetMarginPct: number;
}
