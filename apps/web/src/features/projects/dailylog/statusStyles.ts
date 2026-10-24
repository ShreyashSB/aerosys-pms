import type { AttendanceStatus } from "@/types/models";

/** Compact codes + colours for the attendance matrix (always paired with a legend). */
export const STATUS_STYLE: Record<AttendanceStatus, { code: string; cls: string }> = {
  on_site: { code: "W", cls: "bg-success-soft text-success" },
  off_site: { code: "O", cls: "bg-info-soft text-info" },
  idle: { code: "I", cls: "bg-warning-soft text-warning font-semibold" },
  weekly_off: { code: "WO", cls: "bg-muted text-muted-foreground" },
  holiday: { code: "H", cls: "bg-muted text-muted-foreground" },
  leave: { code: "L", cls: "bg-muted text-muted-foreground" },
};
