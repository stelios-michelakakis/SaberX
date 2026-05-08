"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/saberx/icon";

type SearchResult = {
  id: string;
  documentId: string;
  documentName: string;
  sheetId: string | null;
  sheetName: string | null;
  fieldId: string | null;
  fieldLabel: string | null;
  rowId: string | null;
  rowVisibleId: string | null;
  matchType: string;
  searchableText: string;
  excerpt: string | null;
};

export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [expand, setExpand] = useState(searchParams?.get("expand") === "1");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialQuery) return;
    runSearch(initialQuery, expand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (query: string, expandRelations: boolean) => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/search?q=${encodeURIComponent(query)}${
        expandRelations ? "&relationExpansion=1" : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data: { results: SearchResult[] } = await res.json();
      setResults(data.results);
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString());
    params.set("q", q);
    if (expand) params.set("expand", "1");
    else params.delete("expand");
    router.replace(`/dashboard/search?${params.toString()}`);
    runSearch(q, expand);
  };

  const grouped =
    results?.reduce<Record<string, SearchResult[]>>((acc, r) => {
      const key = `${r.documentName}::${r.sheetName ?? "Document"}`;
      acc[key] ??= [];
      acc[key].push(r);
      return acc;
    }, {}) ?? null;

  return (
    <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          border: "1px solid var(--line)",
          borderRadius: "var(--sx-radius-lg)",
          background: "var(--panel)",
          boxShadow: "var(--sx-shadow-sm)"
        }}
      >
        <Icon name="search" size={16} style={{ color: "var(--ink-3)" }} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents, fields, rows, glossary…"
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: "transparent",
            fontFamily: "inherit",
            fontSize: 14,
            color: "var(--ink)"
          }}
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--ink-3)",
            fontSize: 12.5,
            cursor: "pointer"
          }}
          title="Include rows linked to direct matches"
        >
          <input
            type="checkbox"
            checked={expand}
            onChange={(e) => setExpand(e.target.checked)}
          />
          Include linked rows
        </label>
        <button type="submit" className="sx-btn sx-btn-primary sx-btn-sm" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {!results && !loading && (
        <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
          Type a query and press <span className="kbd">Enter</span>. Tip: <span className="kbd">⌘</span>
          <span className="kbd">K</span> opens search from anywhere.
        </div>
      )}

      {results && results.length === 0 && !loading && (
        <div style={{ color: "var(--ink-3)", fontSize: 13 }}>No matches.</div>
      )}

      {grouped &&
        Object.entries(grouped).map(([key, list]) => {
          const [docName, sheetName] = key.split("::");
          return (
            <div
              key={key}
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
                  padding: "10px 14px",
                  background: "var(--panel-2)",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center"
                }}
              >
                <Icon name="docs" size={12} style={{ color: "var(--ink-3)" }} />
                <strong style={{ fontSize: 13 }}>{docName}</strong>
                <span style={{ color: "var(--ink-3)", fontSize: 12 }}>· {sheetName}</span>
                <span style={{ marginLeft: "auto", color: "var(--ink-4)", fontSize: 11 }}>
                  {list.length} result{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                {list.map((r) => (
                  <Link
                    key={r.id}
                    href={
                      r.sheetId
                        ? `/dashboard/documents/${r.documentId}?sheet=${r.sheetId}`
                        : `/dashboard/documents/${r.documentId}`
                    }
                    style={{
                      display: "block",
                      padding: "12px 14px",
                      borderTop: "1px solid var(--line)",
                      textDecoration: "none",
                      color: "var(--ink-2)"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4
                      }}
                    >
                      {r.rowVisibleId && (
                        <span
                          className="mono"
                          style={{ color: "var(--accent-ink)", fontSize: 11.5 }}
                        >
                          {r.rowVisibleId}
                        </span>
                      )}
                      {r.fieldLabel && (
                        <span className="pill">{r.fieldLabel}</span>
                      )}
                      <span className="pill" style={{ marginLeft: "auto" }}>
                        {r.matchType}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--ink-2)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}
                    >
                      {r.excerpt || r.searchableText.slice(0, 240)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
