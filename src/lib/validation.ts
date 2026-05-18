import { z } from "zod";
import { FIELD_TYPES } from "./constants";

export const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(256)
});

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .refine((value) => !["admin", "password", "password123", "admin123", "adminadmin"].includes(value.toLowerCase()), {
    message: "Password is too trivial."
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const profileSchema = z.object({
  firstName: z.string().max(120).nullable().optional(),
  lastName: z.string().max(120).nullable().optional(),
  organization: z.string().max(180).nullable().optional()
});

export const invitationCreateSchema = z.object({
  email: z.string().email().max(320),
  username: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  roles: z.array(z.string().min(1)).default(["Editor"])
});

export const documentCreateSchema = z.object({
  title: z.string().min(1).max(220),
  description: z.string().max(10_000).default(""),
  classification: z.string().max(80).default("unclassified"),
  templateType: z.string().max(80).nullable().optional()
});

export const documentUpdateSchema = documentCreateSchema.partial().extend({
  status: z.string().max(60).optional(),
  baselineState: z.string().max(60).optional(),
  version: z.number().int().positive().optional()
});

export const sheetCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(20_000).default(""),
  idPrefix: z.string().min(1).max(20).regex(/^[A-Za-z0-9]+$/).default("ID"),
  zeroPad: z.number().int().min(1).max(8).default(2)
});

export const sheetUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(20_000).optional(),
  version: z.number().int().positive().optional()
});

export const referenceBindingSchema = z.object({
  allowedSheetId: z.string().uuid(),
  allowSelfReference: z.boolean().default(false),
  displayFieldId: z.string().uuid().nullable().optional()
});

export const fieldCreateSchema = z.object({
  label: z.string().min(1).max(160),
  type: z.enum(FIELD_TYPES),
  description: z.string().max(10_000).default(""),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  editable: z.boolean().default(true),
  options: z.array(z.string().min(1).max(160)).default([]),
  validation: z.record(z.unknown()).default({}),
  bindings: z.array(referenceBindingSchema).default([])
});

export const fieldUpdateSchema = fieldCreateSchema.partial().extend({
  archived: z.boolean().optional()
});

export const rowCreateSchema = z.object({
  cells: z.record(z.unknown()).default({})
});

export const cellPatchSchema = z.object({
  fieldId: z.string().uuid(),
  value: z.unknown(),
  rowVersion: z.number().int().positive().optional()
});

export const impactSchema = z.object({
  operation: z.enum(["row_delete", "sheet_delete", "document_delete", "field_delete", "field_type_change"]),
  entityId: z.string().uuid(),
  proposed: z.record(z.unknown()).default({})
});

export const searchSchema = z.object({
  q: z.string().min(1).max(300),
  relationExpansion: z.boolean().default(false)
});

export const snapshotCreateSchema = z.object({
  name: z.string().min(1).max(180),
  baselineState: z.string().max(60).default("draft"),
  reason: z.string().max(2000).optional()
});
