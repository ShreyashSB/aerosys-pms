import { PageHeader } from "@/components/common/PageHeader";
import { HistoryFeed } from "@/features/history/HistoryFeed";

/** Who changed what, and when: costs, rates, employees, daily logs and every other record. */
export function HistoryPage() {
  return (
    <div>
      <PageHeader
        title="Change history"
        description="Every addition, edit and removal, with who made it and the values before and after. Open a row to see each field."
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Change history" }]}
      />
      <HistoryFeed />
    </div>
  );
}
