"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

export function AnalysisOverlay({
  open,
  initialQuery,
  onClose
}: {
  open: boolean;
  initialQuery: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setSubmitted(initialQuery);
    }
  }, [initialQuery]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", submitted],
    enabled: open && submitted.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(submitted)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json() as Promise<{ results: { id: string; documentName: string; sheetName: string | null; matchType: string; excerpt: string; rowVisibleId: string | null }[] }>;
    }
  });

  if (!open) return null;

  return (
    <section className="overlay">
      <div className="overlay-head">
        <form
          style={{ display: "flex", gap: 8, flex: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(query);
          }}
        >
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repository" />
          <button className="button icon" type="submit" title="Search">
            <Search size={16} />
          </button>
        </form>
        <button className="button icon" onClick={onClose} title="Close analysis">
          <X size={16} />
        </button>
      </div>
      <div className="results">
        {isFetching ? <span>Searching...</span> : null}
        {data?.results.map((result) => (
          <article className="result-item" key={result.id}>
            <strong>{result.documentName}</strong>
            <span>
              {result.sheetName ?? "Document"} · {result.matchType}
              {result.rowVisibleId ? ` · ${result.rowVisibleId}` : ""}
            </span>
            <p>{result.excerpt}</p>
          </article>
        ))}
        {data && data.results.length === 0 ? <span>No matches.</span> : null}
      </div>
    </section>
  );
}
