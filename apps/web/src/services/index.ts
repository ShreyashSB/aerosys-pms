/**
 * Where the data comes from. With VITE_API_BASE_URL set (for example
 * http://localhost:3000) every service calls the NestJS API; without it the
 * app runs on the in-browser demo data, so the Vercel preview works on its own.
 * Hooks and pages import from here and never know the difference.
 */
import { USE_API } from "@/api/http";
import * as api from "./api";
import * as demo from "./demo";

const source = USE_API ? api : demo;

export const {
  projectService,
  assignmentService,
  expenseService,
  instrumentService,
  employeeService,
  projectCostService,
  notificationService,
  settingsService,
  boqService,
  dailyLogService,
  documentService,
  reviewService,
  billService,
} = source;
