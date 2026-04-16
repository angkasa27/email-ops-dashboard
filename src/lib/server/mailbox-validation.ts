import { z } from "zod";

const HOST_REGEX =
  /^(?=.{1,253}$)(localhost|(([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.)+[a-zA-Z]{2,63}|(\d{1,3}\.){3}\d{1,3})$/;

const baseMailboxSchema = z.object({
  email: z.string().trim().email("Email must be valid"),
  host: z
    .string()
    .trim()
    .min(1, "Host is required")
    .regex(HOST_REGEX, "Host must be a valid hostname, localhost, or IPv4 address"),
  port: z.coerce.number().int("Port must be an integer").min(1).max(65535),
  username: z.string().trim().min(1, "Username is required"),
  secure: z.boolean(),
});

const createMailboxSchema = baseMailboxSchema.extend({
  password: z.string().trim().min(1, "Password is required"),
});

const updateMailboxSchema = baseMailboxSchema.extend({
  id: z.string().trim().min(1, "Mailbox id is required"),
  password: z.string().trim(),
});

const idOnlySchema = z.object({
  id: z.string().trim().min(1, "Mailbox id is required"),
});

export type CreateMailboxInput = z.infer<typeof createMailboxSchema>;
export type UpdateMailboxInput = z.infer<typeof updateMailboxSchema>;
export type MailboxIdInput = z.infer<typeof idOnlySchema>;

function extractSecure(formData: FormData, fallback: boolean): boolean {
  const value = String(formData.get("secure") ?? (fallback ? "on" : "off"));
  return value === "on";
}

function collectErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  return firstIssue?.message ?? "Invalid mailbox payload";
}

export function parseCreateMailboxFormData(formData: FormData): { success: true; data: CreateMailboxInput } | { success: false; error: string } {
  const parsed = createMailboxSchema.safeParse({
    email: formData.get("email"),
    host: formData.get("host"),
    port: formData.get("port"),
    username: formData.get("username"),
    password: formData.get("password"),
    secure: extractSecure(formData, true),
  });

  if (!parsed.success) {
    return { success: false, error: collectErrorMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

export function parseUpdateMailboxFormData(formData: FormData): { success: true; data: UpdateMailboxInput } | { success: false; error: string } {
  const parsed = updateMailboxSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
    host: formData.get("host"),
    port: formData.get("port"),
    username: formData.get("username"),
    password: formData.get("password") ?? "",
    secure: extractSecure(formData, false),
  });

  if (!parsed.success) {
    return { success: false, error: collectErrorMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

export function parseMailboxIdFormData(formData: FormData): { success: true; data: MailboxIdInput } | { success: false; error: string } {
  const parsed = idOnlySchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { success: false, error: collectErrorMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}
