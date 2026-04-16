"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { encryptSecret } from "@/lib/server/crypto";
import { env } from "@/lib/server/env";
import { prisma } from "@/lib/db/prisma";
import { parseCreateMailboxFormData, parseMailboxIdFormData, parseUpdateMailboxFormData } from "@/lib/server/mailbox-validation";
import { queueMailboxSync } from "@/lib/server/sync";
import { requireSession } from "@/lib/server/session";

function redirectWithError(error: string): never {
  redirect(`/mailboxes?error=${encodeURIComponent(error)}`);
}

export async function createMailboxAction(formData: FormData) {
  await requireSession();
  const parsed = parseCreateMailboxFormData(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
  }

  await prisma.mailbox.create({
    data: {
      email: parsed.data.email,
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username,
      encryptedPassword: encryptSecret(parsed.data.password, env.APP_ENCRYPTION_KEY)
    }
  });

  revalidatePath("/mailboxes");
  revalidatePath("/dashboard");
}

export async function updateMailboxAction(formData: FormData) {
  await requireSession();
  const parsed = parseUpdateMailboxFormData(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
  }

  await prisma.mailbox.update({
    where: { id: parsed.data.id },
    data: {
      email: parsed.data.email,
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username,
      ...(parsed.data.password
        ? {
            encryptedPassword: encryptSecret(parsed.data.password, env.APP_ENCRYPTION_KEY)
          }
        : {})
    }
  });

  revalidatePath("/mailboxes");
}

export async function deleteMailboxAction(formData: FormData) {
  await requireSession();
  const parsed = parseMailboxIdFormData(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
  }

  await prisma.mailbox.delete({ where: { id: parsed.data.id } });
  revalidatePath("/mailboxes");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

export async function queueMailboxSyncAction(formData: FormData) {
  await requireSession();
  const parsed = parseMailboxIdFormData(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
  }

  await queueMailboxSync(parsed.data.id, "manual");
  revalidatePath("/mailboxes");
  revalidatePath("/system");
}
