import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import type { Database } from "@/api/seed";
import { todayISO } from "@/lib/dates";
import { uid } from "@/lib/utils";
import type { Instrument, InstrumentStatus, ProjectInstrument } from "@/types/models";
import { pushNotification } from "./notificationService";

export type InstrumentInput = Pick<
  Instrument,
  "name" | "serialNumber" | "category" | "purchaseValue" | "purchaseDate" | "notes"
> & { code?: string };

function closeOpenDeployment(data: Database, instrumentId: string) {
  const today = todayISO();
  for (const pi of data.projectInstruments) {
    if (pi.instrumentId === instrumentId && !pi.returnedAt) pi.returnedAt = today;
  }
}

export const instrumentService = {
  // GET /api/instruments
  async list(): Promise<Instrument[]> {
    await simulateLatency();
    return clone(db.read().instruments);
  },

  // GET /api/project-instruments (deployment history)
  async listDeployments(): Promise<ProjectInstrument[]> {
    await simulateLatency();
    return clone(db.read().projectInstruments);
  },

  async create(input: InstrumentInput): Promise<Instrument> {
    await simulateLatency();
    if (!input.name.trim()) throw new ApiError("Instrument name is required");
    return db.write((data) => {
      if (data.instruments.some((i) => i.serialNumber.toLowerCase() === input.serialNumber.trim().toLowerCase()))
        throw new ApiError("An instrument with this serial number already exists");
      const code = input.code?.trim() || `INS-${String(data.instruments.length + 1).padStart(3, "0")}`;
      if (data.instruments.some((i) => i.code === code)) throw new ApiError(`Instrument ID ${code} is already in use`);
      const ins: Instrument = {
        ...input,
        code,
        id: uid("ins"),
        status: "available",
        assignedEngineerId: null,
        assignedProjectId: null,
      };
      data.instruments.unshift(ins);
      return clone(ins);
    });
  },

  async update(id: string, input: InstrumentInput): Promise<Instrument> {
    await simulateLatency();
    return db.write((data) => {
      const ins = data.instruments.find((i) => i.id === id);
      if (!ins) throw new ApiError("Instrument not found", 404);
      const { code, ...rest } = input;
      Object.assign(ins, rest);
      if (code?.trim()) ins.code = code.trim();
      return clone(ins);
    });
  },

  // POST /api/instruments/:id/assign
  async assign(id: string, engineerId: string, projectId: string): Promise<Instrument> {
    await simulateLatency();
    return db.write((data) => {
      const ins = data.instruments.find((i) => i.id === id);
      const project = data.projects.find((p) => p.id === projectId);
      const eng = data.employees.find((e) => e.id === engineerId);
      if (!ins || !project || !eng) throw new ApiError("Instrument, project or engineer not found", 404);
      if (ins.status === "retired") throw new ApiError("Retired instruments cannot be assigned");
      if (ins.status === "maintenance") throw new ApiError("Instrument is under maintenance");
      closeOpenDeployment(data, id);
      ins.status = "assigned";
      ins.assignedEngineerId = engineerId;
      ins.assignedProjectId = projectId;
      data.projectInstruments.push({
        id: uid("pi"),
        instrumentId: id,
        projectId,
        engineerId,
        assignedAt: todayISO(),
        returnedAt: null,
      });
      pushNotification(data, {
        type: "instrument_assigned",
        title: "Instrument issued",
        message: `${ins.name} (${ins.code}) issued to ${eng.name} for ${project.name}.`,
        link: `/instruments`,
        audienceRoles: ["management"],
        audienceEmployeeIds: [eng.id, project.managerId],
      });
      return clone(ins);
    });
  },

  // POST /api/instruments/:id/return
  async returnInstrument(id: string): Promise<Instrument> {
    await simulateLatency();
    return db.write((data) => {
      const ins = data.instruments.find((i) => i.id === id);
      if (!ins) throw new ApiError("Instrument not found", 404);
      closeOpenDeployment(data, id);
      ins.status = "available";
      ins.assignedEngineerId = null;
      ins.assignedProjectId = null;
      return clone(ins);
    });
  },

  // PATCH /api/instruments/:id/status
  async setStatus(id: string, status: Exclude<InstrumentStatus, "assigned">, notes?: string): Promise<Instrument> {
    await simulateLatency();
    return db.write((data) => {
      const ins = data.instruments.find((i) => i.id === id);
      if (!ins) throw new ApiError("Instrument not found", 404);
      closeOpenDeployment(data, id);
      ins.status = status;
      ins.assignedEngineerId = null;
      ins.assignedProjectId = null;
      if (notes !== undefined) ins.notes = notes;
      return clone(ins);
    });
  },
};
