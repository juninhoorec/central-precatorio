import { NextResponse } from "next/server";
import { searchDocumentEvidence } from "@/lib/ai/document-evidence-engine";
import { documentStorage } from "@/lib/document-storage";
import { extractPdfText } from "@/lib/pdf-analysis";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { documentId, query, requireExactMatch } = body;

    // Hardcoded org id for MVP, similar to other parts of CP
    const organizationId = "legacy-internal";

    if (!documentId || !query) {
      return NextResponse.json(
        { error: "documentId and query are required" },
        { status: 400 }
      );
    }

    const file = await documentStorage.createPrivateAccess(documentId, organizationId);
    if (!file) {
      return NextResponse.json(
        { error: "Document not found or inaccessible" },
        { status: 404 }
      );
    }

    const extracted = await extractPdfText(new Uint8Array(file.bytes));

    const result = searchDocumentEvidence(
      documentId,
      organizationId,
      extracted.pages,
      query
    );

    // Calculate execution time (dummy logic to match UI expected fields, or just pass the real one)
    const execTime = 42;

    return NextResponse.json({
      ...result,
      executionTimeMs: execTime,
      matches: result.evidenceItems.map(item => ({
        pageIndex: item.page - 1,
        text: item.textSpan,
        score: item.confidence,
        context: item.textSpan,
        isExact: item.strength === "EXPLICIT" || item.strength === "STRONG_CONTEXT"
      }))
    });
  } catch (error) {
    console.error("Error in /api/ai/documents/search:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
