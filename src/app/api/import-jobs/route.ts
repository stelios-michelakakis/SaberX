import { revalidatePath } from "next/cache";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { importWorkbook } from "@/services/excel";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Missing .xlsx file");
    if (!file.name.endsWith(".xlsx")) throw new Error("Only .xlsx files are supported in v1");
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await importWorkbook(user, file.name, bytes);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard", "layout"); // sidebar document list
    return ok(result);
  } catch (error) {
    return mapError(error);
  }
}
