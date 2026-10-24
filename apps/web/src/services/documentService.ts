import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { uid } from "@/lib/utils";
import type { ProjectDocument } from "@/types/models";

export type DocumentInput = Pick<ProjectDocument, "projectId" | "name" | "type" | "size" | "mimeType">;

export const documentService = {
  // GET /api/documents
  async list(): Promise<ProjectDocument[]> {
    await simulateLatency();
    return clone(db.read().documents);
  },
  // POST /api/projects/:id/documents (file bytes are not stored in this prototype)
  async upload(input: DocumentInput, actorId: string): Promise<ProjectDocument> {
    await simulateLatency(400, 800);
    if (input.size > 25 * 1024 * 1024) throw new ApiError("Files must be smaller than 25 MB");
    return db.write((data) => {
      const doc: ProjectDocument = { ...input, id: uid("doc"), uploadedById: actorId, uploadedAt: new Date().toISOString() };
      data.documents.unshift(doc);
      return clone(doc);
    });
  },
  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      data.documents = data.documents.filter((d) => d.id !== id);
    });
  },
};
