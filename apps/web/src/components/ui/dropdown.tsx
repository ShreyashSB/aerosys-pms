import * as DM from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-44 rounded-md border bg-surface p-1 shadow-lg animate-in", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        destructive && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />;
}

export const DropdownMenuRadioGroup = DM.RadioGroup;

/** A menu item that shows a tick when it is the selected value of its DropdownMenuRadioGroup. */
export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded py-1.5 pl-7 pr-2 text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:font-medium",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <Check className="size-4 text-primary" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.RadioItem>
  );
}
