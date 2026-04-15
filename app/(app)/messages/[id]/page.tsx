import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function formatContacts(payload: unknown): string {
  if (!Array.isArray(payload)) {
    return "-";
  }

  return payload
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return "";
      }
      const address = (entry as { address?: unknown }).address;
      return typeof address === "string" ? address : "";
    })
    .filter(Boolean)
    .join(", ");
}

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session, message] = await Promise.all([
    requireSession(),
    prisma.message.findUnique({
      where: { id },
      include: { mailbox: true }
    })
  ]);

  if (!message) {
    notFound();
  }

  await prisma.auditLog.create({
    data: {
      username: session.username,
      action: "view_message",
      messageId: message.id
    }
  });

  return (
    <Card>
      <h2 className="text-2xl font-semibold">{message.subject ?? "(no subject)"}</h2>
      <dl className="mt-4 grid gap-2 text-sm md:grid-cols-[140px_1fr]">
        <dt className="text-stone-600">Mailbox</dt>
        <dd>{message.mailbox.email}</dd>
        <dt className="text-stone-600">Direction</dt>
        <dd>{message.direction}</dd>
        <dt className="text-stone-600">From</dt>
        <dd>{formatContacts(message.fromJson)}</dd>
        <dt className="text-stone-600">To</dt>
        <dd>{formatContacts(message.toJson)}</dd>
        <dt className="text-stone-600">Received</dt>
        <dd>{message.receivedAt?.toISOString() ?? "-"}</dd>
      </dl>
      <div className="mt-6 space-y-4">
        <section>
          <h3 className="mb-2 text-lg font-semibold">Plain Text</h3>
          <pre className="overflow-x-auto rounded-2xl border border-stone-200 bg-stone-100 p-4 text-sm whitespace-pre-wrap">
            {message.bodyText ?? ""}
          </pre>
        </section>
        {message.bodyHtml ? (
          <section>
            <h3 className="mb-2 text-lg font-semibold">HTML Body</h3>
            <article className="prose max-w-none rounded-2xl border border-stone-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
          </section>
        ) : null}
      </div>
    </Card>
  );
}
