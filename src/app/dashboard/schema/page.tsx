import Link from "next/link";
import { Icon } from "@/components/saberx/icon";
import { PageHeader, Empty } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { getWorkspaceData } from "@/services/repository";

export const dynamic = "force-dynamic";

export default async function SchemaIndexPage() {
  await requireUser();
  const data = await getWorkspaceData();
  return (
    <>
      <PageHeader
        eyebrow="Schema"
        title="Schemas"
        subtitle="Pick a sheet to edit its field metadata, types, and validation."
      />
      <div style={{ padding: "20px 28px" }}>
        {data.documents.length === 0 ? (
          <Empty title="No documents yet" hint="Create a document to define a schema." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--sx-radius-lg)",
                  background: "var(--panel)",
                  boxShadow: "var(--sx-shadow-sm)",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <Icon name="docs" size={12} style={{ color: "var(--ink-3)" }} />
                  <strong style={{ fontSize: 13 }}>{doc.title}</strong>
                  <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 12 }}>
                    {doc.sheets.length} sheets
                  </span>
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                  {doc.sheets.map((sheet) => (
                    <Link
                      key={sheet.id}
                      href={`/dashboard/schema/${sheet.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 6,
                        textDecoration: "none",
                        color: "var(--ink-2)",
                        fontSize: 12.5
                      }}
                    >
                      <Icon name="rows" size={12} style={{ color: "var(--ink-3)" }} />
                      <span style={{ flex: 1 }}>{sheet.name}</span>
                      <span style={{ color: "var(--ink-4)", fontSize: 11 }}>
                        {sheet.fields.length} fields
                      </span>
                      <Icon name="chevronR" size={12} style={{ color: "var(--ink-4)" }} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
