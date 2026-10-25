import {
  explainExpenses,
  explainIdle,
  explainInstruments,
  explainManDays,
  explainOperational,
  explainPpi,
  explainProgress,
  explainProjectedProfit,
  explainRunningPpi,
  explainWages,
  type Explanation,
} from "@/domain/explain";
import type { ProjectPerformance } from "@/domain/performance";
import type { AppSettings, Employee } from "@/types/models";

export type MetricKey =
  | "ppi" | "runningPpi" | "progress" | "manDays" | "idle" | "expenses"
  | "wages" | "instruments" | "operational" | "bills" | "projectedProfit" | "other";

export function explainMetric(key: MetricKey, p: ProjectPerformance, s: AppSettings, employeeById: Map<string, Employee>): Explanation {
  switch (key) {
    case "ppi": return explainPpi(p);
    case "runningPpi": return explainRunningPpi(p);
    case "progress": return explainProgress(p);
    case "manDays": return explainManDays(p, s.hoursPerManDay);
    case "idle": return explainIdle(p, s.hoursPerManDay);
    case "expenses": return explainExpenses(p);
    case "wages": return explainWages(p, employeeById);
    case "instruments": return explainInstruments(p);
    case "operational": return explainOperational(p, p.operationalCostPerManDay);
    case "projectedProfit": return explainProjectedProfit(p);
    case "bills": return { title: "Vendor bills", steps: [{ label: "Σ vendor bills entered by Accounts (Bills & invoices tab)", value: "", strong: true }] };
    case "other": return { title: "Other direct costs", steps: [{ label: "Σ direct cost entries (Costs tab)", value: "", strong: true }] };
  }
}
