import { NextResponse } from "next/server";
import { requireTenantPermission } from "@/lib/tenant";
import { prepareAiReconfirmationPreview } from "@/lib/ai-reconfirmation";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    await requireTenantPermission(request.headers, "document:read");
    const { id } = await params;
    const preview = await prepareAiReconfirmationPreview({
      organizationId: tenant.organizationId,
      operationId: id,
    });
    if (!preview) {
      return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
    }
    return NextResponse.json(preview, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("AI reconfirmation preview failed", error);
    return NextResponse.json(
      { error: "Não foi possível preparar a prévia da reconfirmação." },
      { status: 400 },
    );
  }
}
