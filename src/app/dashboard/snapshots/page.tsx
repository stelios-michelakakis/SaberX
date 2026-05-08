import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, snapshots, users } from "@/db/schema";
import { PageHeader, Empty } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { SnapshotsClient } from "./snapshots-client";

export const dynamic = "force-dynamic";

export default async function SnapshotsPage({
  searchParams
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  await requireUser();
  const { doc } = await searchParams;

  const docs = await db
    .select({ id: documents.id, title: documents.title, baselineState: documents.baselineState })
    .from(documents)
    .where(isNull(documents.deletedAt))
    .orderBy(desc(documents.updatedAt));

  if (docs.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Snapshots" title="Baselines" />
        <div style={{ padding: "40px 28px" }}>
          <Empty title="No documents yet" />
        </div>
      </>
    );
  }

  const activeDocId = doc && docs.find((d) => d.id === doc) ? doc : docs[0].id;
  const activeDoc = docs.find((d) => d.id === activeDocId)!;

  const snapshotRows = await db
    .select({
      id: snapshots.id,
      name: snapshots.name,
      baselineState: snapshots.baselineState,
      reason: snapshots.reason,
      createdAt: snapshots.createdAt,
      createdBy: snapshots.createdBy,
      authorUsername: users.username,
      authorFirstName: users.firstName,
      authorLastName: users.lastName
    })
    .from(snapshots)
    .leftJoin(users, eq(users.id, snapshots.createdBy))
    .where(eq(snapshots.documentId, activeDocId))
    .orderBy(desc(snapshots.createdAt));

  return (
    <SnapshotsClient
      documents={docs}
      activeDocId={activeDocId}
      activeDoc={activeDoc}
      snapshots={snapshotRows.map((s) => ({
        id: s.id,
        name: s.name,
        baselineState: s.baselineState,
        reason: s.reason,
        createdAt: s.createdAt.toISOString(),
        author:
          [s.authorFirstName, s.authorLastName].filter(Boolean).join(" ") ||
          s.authorUsername ||
          "system"
      }))}
    />
  );
}
