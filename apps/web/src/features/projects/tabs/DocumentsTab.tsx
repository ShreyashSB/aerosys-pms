import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useCurrentUser } from "@/auth/AuthContext";
import { useAppData } from "@/hooks/useAppData";
import { useDeleteDocument, useUploadDocument } from "@/hooks/mutations";
import { formatDateTime } from "@/lib/format";
import type { DocumentType, ProjectDocument } from "@/types/models";

const TYPES: DocumentType[] = ["Work Order", "Annexure / BOQ", "Drawing", "Measurement Sheet", "Correspondence", "Other"];

function iconFor(d: ProjectDocument) {
  if (d.mimeType.includes("sheet") || d.name.endsWith(".xlsx") || d.name.endsWith(".csv")) return FileSpreadsheet;
  if (d.mimeType.startsWith("image/")) return ImageIcon;
  return FileText;
}

const sizeLabel = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DocumentsTab({ projectId, canUpload, onGoBoq }: { projectId: string; canUpload: boolean; onGoBoq: () => void }) {
  const { user } = useCurrentUser();
  const data = useAppData();
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const [type, setType] = useState<DocumentType>("Drawing");
  const [deleting, setDeleting] = useState<ProjectDocument | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const docs = data.documents.filter((d) => d.projectId === projectId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const onFile = (f: File | undefined) => {
    if (!f) return;
    upload.mutate(
      { actorId: user.employeeId, input: { projectId, name: f.name, type, size: f.size, mimeType: f.type || "application/octet-stream" } },
      { onSuccess: () => toast.success("Document uploaded", { description: `${f.name} · ${type}` }) },
    );
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Work order, drawings and correspondence. The Annexure is maintained as structured data in the{" "}
          <button className="font-medium text-primary hover:underline cursor-pointer" onClick={onGoBoq}>Annexure / BOQ tab</button>; files here are for reference.
        </p>
        {canUpload && (
          <div className="flex items-center gap-2">
            <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} className="w-auto" aria-label="Document type">
              {TYPES.map((t) => (<option key={t}>{t}</option>))}
            </Select>
            <input ref={ref} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button onClick={() => ref.current?.click()} loading={upload.isPending}><Upload /> Upload</Button>
          </div>
        )}
      </div>
      <Card className="divide-y">
        {docs.length === 0 ? (
          <EmptyState icon={<FileText />} title="No documents yet" />
        ) : (
          docs.map((d) => {
            const Icon = iconFor(d);
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Icon className="size-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sizeLabel(d.size)} · uploaded by {data.employeeById.get(d.uploadedById)?.name ?? "—"} · {formatDateTime(d.uploadedAt)}
                  </p>
                </div>
                <Badge tone={d.type === "Work Order" ? "info" : d.type === "Annexure / BOQ" ? "success" : "neutral"}>{d.type}</Badge>
                {canUpload && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(d)} aria-label={`Delete ${d.name}`}><Trash2 className="text-muted-foreground" /></Button>
                )}
              </div>
            );
          })
        )}
      </Card>
      <p className="text-xs text-muted-foreground">Prototype: file contents are not stored — only document details are kept locally.</p>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete document?"
        description={deleting?.name}
        destructive
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast.success("Document deleted"); setDeleting(null); } })}
      />
    </div>
  );
}
