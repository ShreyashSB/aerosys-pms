import * as Popover from "@radix-ui/react-popover";
import { useNavigate } from "react-router-dom";
import { Bell, PauseCircle, CheckCheck, CheckCircle2, ClipboardList, Clock, FolderPlus, UserPlus, Wrench, XCircle, type LucideIcon } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { useNotifications } from "@/hooks/queries";
import { useMarkAllNotificationsRead, useMarkNotificationRead } from "@/hooks/mutations";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types/models";

const ICONS: Record<NotificationType, { icon: LucideIcon; cls: string }> = {
  expense_submitted: { icon: ClipboardList, cls: "bg-warning-soft text-warning" },
  expense_approved: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  expense_rejected: { icon: XCircle, cls: "bg-danger-soft text-danger" },
  engineer_assigned: { icon: UserPlus, cls: "bg-info-soft text-info" },
  instrument_assigned: { icon: Wrench, cls: "bg-info-soft text-info" },
  project_deadline: { icon: Clock, cls: "bg-danger-soft text-danger" },
  project_completion: { icon: CheckCheck, cls: "bg-success-soft text-success" },
  project_created: { icon: FolderPlus, cls: "bg-info-soft text-info" },
  idle_recorded: { icon: PauseCircle, cls: "bg-warning-soft text-warning" },
};

export function NotificationCenter() {
  const { user } = useCurrentUser();
  const { data = [], isLoading } = useNotifications(user);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const unread = data.filter((n) => !n.readBy.includes(user.id)).length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(24rem,calc(100vw-1rem))] rounded-lg border bg-surface shadow-xl animate-in">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">{unread} unread</p>
            </div>
            <Button variant="ghost" size="sm" disabled={unread === 0} onClick={() => markAll.mutate(user)}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : data.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              data.slice(0, 30).map((n) => {
                const isUnread = !n.readBy.includes(user.id);
                const { icon: Icon, cls } = ICONS[n.type];
                return (
                  <Popover.Close asChild key={n.id}>
                    <button
                      onClick={() => {
                        if (isUnread) markRead.mutate({ id: n.id, userId: user.id });
                        if (n.link) navigate(n.link);
                      }}
                      className={cn("flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60 cursor-pointer", isUnread && "bg-primary-soft/40")}
                    >
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", cls)}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          {isUnread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </Popover.Close>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
