import { NextResponse } from "next/server";
import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { requireTenantPermission } from "@/lib/tenant";
import { appendAudit } from "@/lib/audit";
import {
  createOperation,
  listOperations,
  updateOperation,
} from "@/lib/operations";
import { createDefaultWorkflow } from "@/lib/operational-workflow";
import { enqueueImportedBatch } from "@/lib/autonomous-acquisition";
import { parseTjspCsv } from "@/lib/tjsp-import";
import {
  beginImport,
  finishImport,
  recordImportSourceRow,
  type ImportSummary,
} from "@/lib/capture-imports";

export const runtime = "nodejs";
const schema = z
  .object({
    text: z.string().max(20_000_000).optional(),
    fileName: z.string().trim().max(160).default("lista-tjsp.csv"),
    sourceFileName: z.string().trim().max(160).optional(),
    sourceUrl: z
      .string()
      .url()
      .max(1000)
      .default("https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral"),
    sourceId: z
      .enum(["tjsp-lista-geral", "esaj-listas", "tjsp-cac-assisted"])
      .default("tjsp-lista-geral"),
    sheet: z.string().max(160).optional(),
    mapping: z.record(z.string(), z.string()).optional(),
    minimum: z
      .number()
      .finite()
      .nonnegative()
      .max(1_000_000_000_000)
      .optional(),
    dataAsOf: z.iso.date().optional(),
  })
  .strict();
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const mappingAliases: Record<string, string[]> = {
  creditorName: [
    "credor",
    "beneficiario",
    "nomecredor",
    "nomebeneficiario",
    "titular",
  ],
  grossAmount: [
    "valor",
    "valorbruto",
    "valorprecatorio",
    "valoratualizado",
    "montante",
  ],
  debtorName: ["devedor", "entedevedor", "municipio", "entidade"],
  debtorMunicipality: ["municipio", "comarca"],
  tribunal: ["tribunal", "orgao", "tribunalexpedidor"],
  precatoryNumber: ["precatorio", "numeroprecatorio", "opv"],
  numeroProcessoDEPRE: [
    "nprocessodepre",
    "numeroprocessodepre",
    "processodepre",
  ],
  epesNumber: ["epes"],
  epesYear: ["anoepes"],
  protocolDate: ["datadoprotocolo", "dataprotocolo"],
  precatoryYear: ["ano", "anoprecatorio"],
  officeNumber: ["oficio", "numerooficio", "requisitorio"],
  officeDate: ["dataoficio", "dataexpedicao"],
  processOrigin: ["processooriginario", "processoorigem"],
  requisitoryProcess: ["processorequisitorio", "processoprecatorio"],
  depre: ["referenciadepre", "referencia"],
  sourceStatus: ["situacao", "status"],
  creditType: ["tipo", "classe", "modalidade"],
  paymentStatus: ["situacaopagamento", "pagamento"],
  paymentOrder: ["ordemdepagamento", "ordempagamento"],
  sourcePage: ["paginadafonte", "pagina"],
  sourceRecord: ["registronapagina", "registro"],
};
function parseMoney(s: string): number | null {
  if (!s.trim()) return null;
  const cleaned = s.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function toCsv(rows: string[][]) {
  return Papa.unparse(rows, { delimiter: ";" });
}
function sheetRows(bytes: Uint8Array, name: string, sheet?: string) {
  const book = XLSX.read(bytes, { type: "array", cellDates: false });
  if (book.SheetNames.length > 1 && !sheet)
    throw new Error("Escolha uma planilha antes de importar.");
  const target = sheet || book.SheetNames[0];
  if (!book.SheetNames.includes(target))
    throw new Error("Planilha selecionada não existe no arquivo.");
  return XLSX.utils.sheet_to_json<string[]>(book.Sheets[target], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as string[][];
}
export async function POST(request: Request) {
  try {
    const tenant = await requireTenantPermission(
      request.headers,
      "operation:write",
    );
    let input: z.infer<typeof schema>, bytes: Uint8Array;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(),
        file = form.get("file");
      if (!(file instanceof File))
        return NextResponse.json(
          { error: "Selecione um arquivo." },
          { status: 400 },
        );
      bytes = new Uint8Array(await file.arrayBuffer());
      input = schema.parse({
        fileName: file.name,
        sourceFileName: String(form.get("sourceFileName") || file.name),
        text: /\.csv$/i.test(file.name)
          ? new TextDecoder("utf-8").decode(bytes)
          : undefined,
        sourceUrl: form.get("sourceUrl") || undefined,
        sourceId: form.get("sourceId") || undefined,
        sheet: form.get("sheet") || undefined,
        mapping: form.get("mapping")
          ? JSON.parse(String(form.get("mapping")))
          : undefined,
        minimum: form.get("minimum") ? Number(form.get("minimum")) : undefined,
        dataAsOf: form.get("dataAsOf")
          ? String(form.get("dataAsOf"))
          : undefined,
      });
    } else {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 21 * 1024 * 1024)
        return NextResponse.json(
          { error: "O arquivo excede 20 MB." },
          { status: 413 },
        );
      input = schema.parse(await request.json());
      bytes = new TextEncoder().encode(input.text || "");
    }
    if (bytes.byteLength > 20 * 1024 * 1024)
      return NextResponse.json(
        { error: "O arquivo excede 20 MB." },
        { status: 413 },
      );
    if (
      input.dataAsOf &&
      new Date(`${input.dataAsOf}T00:00:00Z`).getTime() > Date.now() + 86400000
    )
      return NextResponse.json(
        { error: "A data da lista não pode estar no futuro." },
        { status: 400 },
      );
    if (!/\.(csv|xlsx|xls)$/i.test(input.fileName))
      return NextResponse.json(
        { error: "Use CSV, XLS ou XLSX." },
        { status: 415 },
      );
    input.fileName = input.fileName.replace(/[\r\n/\\]/g, "_").slice(0, 160);
    input.sourceFileName = (input.sourceFileName || input.fileName)
      .replace(/[\r\n/\\]/g, "_")
      .slice(0, 160);
    if (
      /\.xlsx$/i.test(input.fileName) &&
      (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    )
      return NextResponse.json(
        { error: "O conteúdo não corresponde a uma planilha XLSX válida." },
        { status: 400 },
      );
    if (
      /\.xls$/i.test(input.fileName) &&
      !(
        bytes[0] === 0xd0 &&
        bytes[1] === 0xcf &&
        bytes[2] === 0x11 &&
        bytes[3] === 0xe0
      )
    )
      return NextResponse.json(
        { error: "O conteúdo não corresponde a uma planilha XLS válida." },
        { status: 400 },
      );
    const sourceUrl = new URL(input.sourceUrl);
    const validTjsp =
        input.sourceId === "tjsp-lista-geral" &&
        sourceUrl.protocol === "https:" &&
        sourceUrl.hostname === "www.tjsp.jus.br" &&
        sourceUrl.pathname.startsWith("/Precatorios/"),
      validEsaj =
        input.sourceId === "esaj-listas" &&
        sourceUrl.protocol === "https:" &&
        sourceUrl.hostname === "esaj.tjsp.jus.br" &&
        sourceUrl.pathname.startsWith("/portalDevedor/"),
      validCac =
        input.sourceId === "tjsp-cac-assisted" &&
        sourceUrl.protocol === "https:" &&
        sourceUrl.hostname === "www.tjsp.jus.br" &&
        sourceUrl.pathname.startsWith("/cac/scp/");
    if (!validTjsp && !validEsaj && !validCac)
      return NextResponse.json(
        {
          error:
            "A referência precisa pertencer ao portal oficial da fonte selecionada.",
        },
        { status: 400 },
      );
    const sourceName =
      input.sourceId === "esaj-listas"
        ? "TJSP/e-SAJ"
        : input.sourceId === "tjsp-cac-assisted"
          ? "TJSP/CAC · Captura assistida"
          : "TJSP · Lista Geral";
    const started = await beginImport({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      sourceId: input.sourceId,
      sourceName,
      fileName: input.sourceFileName || input.fileName,
      sourceReference: input.sourceUrl,
      bytes,
    });
    if (started.duplicate)
      return NextResponse.json(
        {
          batch: started.batch,
          summary: started.batch.summary,
          alreadyProcessed: true,
          notice:
            "Esta importação já foi processada; nenhum registro foi criado novamente.",
        },
        { status: 200 },
      );
    const summary: ImportSummary = {
      read: 0,
      created: 0,
      updated: 0,
      duplicates: 0,
      conflicts: 0,
      rpvs: 0,
      skipped: 0,
      belowMinimum: 0,
      incomplete: 0,
      errors: 0,
    };
    let errors: unknown[] = [];
    try {
      let csv = input.text || "";
      if (/\.(xlsx|xls)$/i.test(input.fileName)) {
        const rows = sheetRows(bytes, input.fileName, input.sheet);
        csv = toCsv(rows);
      }
      const profileDb = await import("@libsql/client").then(
        ({ createClient }) =>
          createClient({
            url: process.env.DATABASE_URL || "file:central-precatorios.db",
            authToken: process.env.DATABASE_AUTH_TOKEN,
          }),
      );
      const profileRow = await profileDb
        .execute({
          sql: "SELECT profile_json FROM acquisition_profiles WHERE organization_id=?",
          args: [tenant.organizationId],
        })
        .catch(() => ({ rows: [] }) as { rows: Record<string, unknown>[] });
      const threshold =
        input.minimum ??
        Number(
          (profileRow.rows[0]
            ? JSON.parse(String(profileRow.rows[0].profile_json))
                .minimumPrecatory
            : undefined) ?? 100000,
        );
      let rows,
        parseErrors: unknown[] = [];
      if (
        /\.(xlsx|xls)$/i.test(input.fileName) ||
        (input.mapping && Object.values(input.mapping).some(Boolean))
      ) {
        const rawRows = Papa.parse<string[]>(csv, {
          header: false,
          skipEmptyLines: true,
          delimiter: "",
        }).data as string[][];
        const header = rawRows[0] || [],
          chosen = Object.fromEntries(
            Object.entries(mappingAliases).map(([key, aliases]) => [
              key,
              input.mapping?.[key] ||
                header.find(
                  (h) =>
                    aliases.includes(normalize(h)) ||
                    aliases.some((a) => normalize(h).includes(a)),
                ),
            ]),
          ),
          index = (key: string) => {
            const col = chosen[key];
            return col ? header.findIndex((h) => h === col) : -1;
          };
        const pick = (r: string[], key: string) => {
          const i = index(key);
          return i < 0 ? "" : String(r[i] || "");
        };
        rows = rawRows
          .slice(1)
          .map((r) => ({
            type: /\brpv\b/i.test(
              `${pick(r, "creditType")} ${pick(r, "sourceStatus")} ${pick(r, "precatoryNumber")}`,
            )
              ? ("RPV" as const)
              : ("PRECATORY" as const),
            amount: parseMoney(pick(r, "grossAmount")),
            processNumber:
              pick(r, "requisitionProcess") || pick(r, "processOrigin"),
            numeroProcessoDEPRE: pick(r, "numeroProcessoDEPRE"),
            epesNumber: pick(r, "epesNumber"),
            epesYear: pick(r, "epesYear"),
            protocolDate: pick(r, "protocolDate"),
            paymentOrder: pick(r, "paymentOrder"),
            originProcessNumber: pick(r, "processOrigin"),
            sourcePage: Number(pick(r, "sourcePage")) || undefined,
            sourceRecord: Number(pick(r, "sourceRecord")) || undefined,
            debtor: pick(r, "debtorName"),
            creditor: pick(r, "creditorName"),
            court: pick(r, "tribunal") || "TJSP",
            creditNumber: pick(r, "precatoryNumber"),
            precatoryYear: pick(r, "precatoryYear").match(/20\d{2}/)?.[0] || "",
            municipality: pick(r, "debtorMunicipality"),
            valueDate: "",
            originalRow: r,
            sourceRow: rawRows.indexOf(r) + 1,
          }));
        parseErrors =
          rawRows.length < 2
            ? [
                {
                  code: "MISSING_REQUIRED_FIELD",
                  message: "Não há registros abaixo do cabeçalho.",
                },
              ]
            : [];
      } else {
        const parsed = parseTjspCsv(csv, input.sourceUrl);
        const original = Papa.parse<string[]>(csv, {
          header: false,
          skipEmptyLines: true,
        }).data as string[][];
        rows = parsed.rows.map((r, i) => ({
          ...r,
          originalRow: original[i + 1] || [],
          sourceRow: i + 2,
        }));
        parseErrors = parsed.errors;
      }
      summary.read = rows.length;
      errors = parseErrors;
      summary.errors = errors.length;
      const existing = await listOperations(undefined, tenant.organizationId);
      const keyOf = (r: {
        creditNumber: string;
        processNumber: string;
        numeroProcessoDEPRE?: string;
        epesNumber?: string;
        epesYear?: string;
        debtor: string;
        creditor: string;
      }) => {
        if (r.numeroProcessoDEPRE)
          return `d:tjsp:${normalize(r.numeroProcessoDEPRE)}`;
        if (r.epesNumber)
          return `e:tjsp:${normalize(`${r.epesNumber}/${r.epesYear || ""}`)}:${normalize(r.debtor)}`;
        if (r.creditNumber)
          return `p:tjsp:${normalize(r.creditNumber)}:${normalize(r.debtor)}`;
        return `${normalize(r.processNumber)}|${normalize(r.debtor)}|${normalize(r.creditor)}`;
      };
      const byCredit = new Map<string, (typeof existing)[number]>();
      for (const operation of existing) {
        const credit = operation.workflow.credit;
        const identities = [
          credit.numeroProcessoDEPRE &&
            `d:${normalize(operation.tribunal || "TJSP")}:${normalize(credit.numeroProcessoDEPRE)}`,
          credit.precatoryNumber &&
            `p:${normalize(operation.tribunal || "TJSP")}:${normalize(credit.precatoryNumber)}:${normalize(operation.debtor)}`,
          credit.epesNumber &&
            `e:${normalize(operation.tribunal || "TJSP")}:${normalize(`${credit.epesNumber}/${credit.epesYear}`)}:${normalize(operation.debtor)}`,
          `${normalize(operation.process)}|${normalize(operation.debtor)}|${normalize(operation.workflow.client.name)}`,
        ].filter(Boolean) as string[];
        for (const identity of identities) byCredit.set(identity, operation);
      }
      for (const row of rows) {
        if (row.type === "RPV") summary.rpvs++;
        if (
          row.amount === null ||
          (!row.processNumber &&
            !row.originProcessNumber &&
            !row.numeroProcessoDEPRE) ||
          !row.debtor
        )
          summary.incomplete++;
        if (
          row.type === "PRECATORY" &&
          row.amount !== null &&
          row.amount < threshold
        )
          summary.belowMinimum++;
        const key = keyOf(row),
          old = byCredit.get(key),
          now = new Date().toISOString(),
          workflow = old
            ? structuredClone(old.workflow)
            : createDefaultWorkflow(row.amount ?? 0),
          conflicting = Boolean(
            old &&
            old.nominal &&
            row.amount &&
            Math.abs(old.nominal - row.amount) > 0.01,
          );
        workflow.credit = {
          ...workflow.credit,
          precatoryNumber: row.creditNumber || workflow.credit.precatoryNumber,
          numeroProcessoDEPRE:
            row.numeroProcessoDEPRE || workflow.credit.numeroProcessoDEPRE,
          numeroProcessoDEPRENormalizado: row.numeroProcessoDEPRE
            ? row.numeroProcessoDEPRE.replace(/\D/g, "")
            : workflow.credit.numeroProcessoDEPRENormalizado,
          paymentOrderNumber:
            row.paymentOrder || workflow.credit.paymentOrderNumber,
          epesNumber: row.epesNumber || workflow.credit.epesNumber,
          epesYear: row.epesYear || workflow.credit.epesYear,
          originProcessNumber:
            row.originProcessNumber || workflow.credit.originProcessNumber,
          grossAmount: old?.nominal || row.amount || 0,
          creditType: row.type,
          municipality: row.municipality || workflow.credit.municipality,
          issuingCourt: row.court,
          debtorState: "SP",
          sourceUrl: input.sourceUrl,
          sourceName: `${sourceName} · ${input.sourceFileName || input.fileName}`,
          precatoryYear: row.precatoryYear || workflow.credit.precatoryYear,
          checkedAt: input.dataAsOf
            ? new Date(`${input.dataAsOf}T12:00:00Z`).toISOString()
            : old?.workflow.credit.checkedAt || "",
          valueDate: row.valueDate || input.dataAsOf || workflow.credit.valueDate,
        };
        if (row.creditor)
          workflow.client = { ...workflow.client, name: row.creditor };
        workflow.evidence = [
          ...workflow.evidence,
          {
            id: crypto.randomUUID(),
            source: `${sourceName} · ${input.sourceFileName || input.fileName}`,
            sourceType: "OFFICIAL" as const,
            reference: input.sourceUrl,
            retrievedAt: now,
            confidence: 75,
            status: "REVISÃO HUMANA NECESSÁRIA" as const,
            notes: `Página ${row.sourcePage || "não identificada"}, registro ${row.sourceRecord || row.sourceRow}; arquivo ${input.sourceFileName || input.fileName}. Valores brutos preservados no lote. Nº Processo DEPRE: ${row.numeroProcessoDEPRE || "não identificado na fonte consultada"}; EP/ES: ${row.epesNumber ? `${row.epesNumber}${row.epesYear ? `/${row.epesYear}` : ""}` : "não identificado na fonte consultada"}; processo originário: ${row.originProcessNumber || "não identificado na fonte consultada"}; valor: ${row.amount ?? "ausente"}. ${input.dataAsOf ? `Data indicada no relatório: ${input.dataAsOf}.` : `Data-base/publicação não identificada no arquivo; a data de importação não comprova atualidade.`} Confirmar publicação oficial e data-base.`,
          },
        ].slice(-300);
        if (conflicting) {
          summary.conflicts++;
          workflow.validations = [
            ...workflow.validations,
            {
              id: crypto.randomUUID(),
              check: "Divergência de valor entre fontes",
              severity: "CRITICAL" as const,
              status: "HUMAN_REVIEW" as const,
              explanation: `Fonte anterior: ${old!.nominal}; ${input.fileName}, linha ${row.sourceRow}: ${row.amount}. Não sobrescrito.`,
            },
          ].slice(-300);
        }
        workflow.queryStatus = "PARTIAL";
        if (old && !conflicting && old.nominal === row.amount) {
          summary.duplicates++;
          if (
            old.source === `${sourceName} · ${input.sourceFileName || input.fileName}` &&
            old.workflow.credit.sourceUrl === input.sourceUrl
          ) {
            await recordImportSourceRow({
              organizationId: tenant.organizationId,
              batchId: started.batch.id,
              operationId: old.id,
              rowNumber: row.sourceRow,
              sourceReference: input.sourceUrl,
              rawValues: row.originalRow,
              normalizedValues: {
                creditor: row.creditor,
                amount: row.amount,
                debtor: row.debtor,
                tribunal: row.court,
                precatoryNumber: row.creditNumber,
                process: row.processNumber,
                numeroProcessoDEPRE: row.numeroProcessoDEPRE || "",
                numeroProcessoDEPRENormalizado: row.numeroProcessoDEPRE?.replace(/\D/g, "") || "",
                epesNumber: row.epesNumber || "",
                epesYear: row.epesYear || "",
                originProcessNumber: row.originProcessNumber || "",
                sourcePage: row.sourcePage || null,
                sourceRecord: row.sourceRecord || null,
                sourceFileName: input.sourceFileName || input.fileName,
                type: row.type,
              },
            });
            continue;
          }
        }
        const title = `${row.type === "RPV" ? "RPV" : row.numeroProcessoDEPRE ? `Nº Processo DEPRE ${row.numeroProcessoDEPRE}` : row.creditNumber ? `Precatório ${row.creditNumber}` : `Candidato TJSP · ${row.processNumber}`}`;
        const op = old
          ? {
              ...old,
              title,
              debtor: row.debtor || old.debtor,
              tribunal: row.court,
              process: row.originProcessNumber || row.processNumber || old.process,
              nominal: conflicting ? old.nominal : (row.amount ?? old.nominal),
              source: `${sourceName} · ${input.sourceFileName || input.fileName}`,
              workflow,
            }
          : {
              title,
              debtor: row.debtor,
              tribunal: row.court,
              process: row.originProcessNumber || row.processNumber,
              owner: "",
              source: `${sourceName} · ${input.sourceFileName || input.fileName}`,
              stage: "Entrada" as const,
              nominal: row.amount ?? 0,
              notes: `Candidato importado de ${input.sourceFileName || input.fileName}, página ${row.sourcePage || "não identificada"}, registro ${row.sourceRecord || row.sourceRow}. Confirme a publicação original.`,
              tasks: [],
              checks: [],
              proposals: [],
              workflow,
              isDemo: false,
            };
        const saved = old
          ? await updateOperation(
              op as typeof old,
              undefined,
              tenant.organizationId,
              tenant.userId,
            )
          : {
              status: "updated" as const,
              operation: await createOperation(
                op,
                undefined,
                tenant.organizationId,
                tenant.userId,
              ),
            };
        if (saved.status === "updated") {
          byCredit.set(key, saved.operation);
          if (old) summary.updated++;
          else summary.created++;
          await recordImportSourceRow({
            organizationId: tenant.organizationId,
            batchId: started.batch.id,
            operationId: saved.operation.id,
            rowNumber: row.sourceRow,
            sourceReference: input.sourceUrl,
            rawValues: row.originalRow,
            normalizedValues: {
              creditor: row.creditor,
              amount: row.amount,
              debtor: row.debtor,
              tribunal: row.court,
              precatoryNumber: row.creditNumber,
              process: row.processNumber,
              numeroProcessoDEPRE: row.numeroProcessoDEPRE || "",
              numeroProcessoDEPRENormalizado: row.numeroProcessoDEPRE?.replace(/\D/g, "") || "",
              epesNumber: row.epesNumber || "",
              epesYear: row.epesYear || "",
              originProcessNumber: row.originProcessNumber || "",
              sourcePage: row.sourcePage || null,
              sourceRecord: row.sourceRecord || null,
              sourceFileName: input.sourceFileName || input.fileName,
              type: row.type,
            },
          });
        }
      }
      summary.errors = errors.length;
      const status =
        errors.length || summary.conflicts
          ? "COMPLETED_WITH_WARNINGS"
          : "COMPLETED";
      await finishImport(
        started.batch.id,
        tenant.organizationId,
        status,
        summary,
        errors,
      );
      const acquisitionQueue = await enqueueImportedBatch(started.batch.id, tenant.organizationId, tenant.userId);
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "SOURCE_IMPORT_COMPLETED",
        entityType: "capture_import_batch",
        entityId: started.batch.id,
        previousStateSummary: { status: "PROCESSING" },
        nextStateSummary: { status, ...summary },
        metadata: {
          fileName: input.fileName,
          sourceId: input.sourceId,
          sourceUrl: input.sourceUrl,
        },
        requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        source: "LEAD_CENTER_IMPORT",
      });
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "LEAD_IMPORTED",
        entityType: "lead_import_batch",
        entityId: started.batch.id,
        previousStateSummary: {},
        nextStateSummary: {
          created: summary.created,
          updated: summary.updated,
          conflicts: summary.conflicts,
        },
        metadata: { sourceId: input.sourceId, fileName: input.fileName },
        requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        source: "LEAD_CENTER_IMPORT",
      });
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "ACQUISITION_QUEUE_ENQUEUED",
        entityType: "acquisition_batch",
        entityId: started.batch.id,
        previousStateSummary: { queued: 0 },
        nextStateSummary: { queued: acquisitionQueue.enqueued, sourceId: input.sourceId },
        metadata: { parser: "cp-tjsp-import/2.2.1", fileName: input.sourceFileName || input.fileName },
        requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        source: "AUTONOMOUS_ACQUISITION",
      });
      if (summary.conflicts > 0)
        await appendAudit({
          organizationId: tenant.organizationId,
          actorUserId: tenant.userId,
          action: "LEAD_CONFLICT_DETECTED",
          entityType: "lead_import_batch",
          entityId: started.batch.id,
          previousStateSummary: { conflicts: 0 },
          nextStateSummary: { conflicts: summary.conflicts },
          metadata: { sourceId: input.sourceId, fileName: input.fileName },
          requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
          source: "LEAD_CENTER_IMPORT",
        });
      return NextResponse.json(
        {
          batchId: started.batch.id,
          summary,
          acquisitionQueue,
          errors: errors.slice(0, 100),
          notice: input.dataAsOf
            ? `Importação assistida; data da lista registrada como ${input.dataAsOf}. Confirme a publicação oficial.`
            : "Importação assistida; data da lista não informada. A importação não torna os dados atuais; confirme a publicação oficial. Dados ausentes permanecem pendentes e divergências exigem revisão humana.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (e) {
      await finishImport(
        started.batch.id,
        tenant.organizationId,
        "FAILED",
        summary,
        [
          {
            message: e instanceof Error ? e.message : "Falha de processamento",
          },
        ],
      ).catch(() => {});
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "SOURCE_IMPORT_FAILED",
        entityType: "capture_import_batch",
        entityId: started.batch.id,
        previousStateSummary: { status: "PROCESSING" },
        nextStateSummary: { status: "FAILED" },
        metadata: { fileName: input.fileName },
        requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        source: "LEAD_CENTER_IMPORT",
      }).catch(() => {});
      throw e;
    }
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: "Arquivo ou critérios inválidos." },
        { status: 400 },
      );
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Não foi possível importar a lista.",
      },
      { status: 400 },
    );
  }
}
