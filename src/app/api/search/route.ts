import { mapError, ok } from "@/lib/api";
import { searchSchema } from "@/lib/validation";
import { requireUser } from "@/services/auth";
import { searchRepository } from "@/services/repository";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const input = searchSchema.parse({ q: url.searchParams.get("q") ?? "", relationExpansion: url.searchParams.get("relationExpansion") === "1" });
    const results = await searchRepository(input.q);
    const grouped = results.reduce<Record<string, Record<string, typeof results>>>((acc, result) => {
      acc[result.documentName] ??= {};
      acc[result.documentName][result.sheetName ?? "Document"] ??= [];
      acc[result.documentName][result.sheetName ?? "Document"].push(result);
      return acc;
    }, {});
    return ok({ results, grouped });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const input = searchSchema.parse(await request.json());
    return ok({ results: await searchRepository(input.q) });
  } catch (error) {
    return mapError(error);
  }
}
