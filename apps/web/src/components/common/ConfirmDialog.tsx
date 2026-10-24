import { useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea, Field } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Ask for a note (e.g. rejection reason). */
  noteLabel?: string;
  noteRequired?: boolean;
  onConfirm: (note: string) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  loading,
  noteLabel,
  noteRequired,
  onConfirm,
}: ConfirmDialogProps) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = !!noteRequired && !note.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setNote("");
          setTouched(false);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        title={title}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              loading={loading}
              onClick={() => {
                setTouched(true);
                if (!invalid) onConfirm(note);
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground">
          {description && <div>{description}</div>}
          {noteLabel && (
            <Field label={noteLabel} required={noteRequired} error={touched && invalid ? "This field is required" : undefined}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus aria-invalid={touched && invalid} />
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
