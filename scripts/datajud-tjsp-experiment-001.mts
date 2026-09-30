import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createResearchOfficialProcessRoutes, OfficialProcessSourceCollector } from "../src/lib/official-process-source-collector";
import { DataJudTJSPAdapter } from "../src/lib/datajud-tjsp-experimental";
import { isValidCnjProcessNumber, normalizeCnjProcessNumber } from "../src/lib/acquisition-sources";

const processNumber = "0196151-64.2018.8.26.0500";
const startedAt = Date.now();

function sanitize(value: unknown, secret: string): unknown {
  if (typeof value === "string") {
    const withoutSecret = secret ? value.split(secret).join("[REDACTED]") : value;
    return withoutSecret
      .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF REDIGIDO]")
      .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[CNPJ REDIGIDO]");
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, secret));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    /authorization|api.?key/i.test(key) ? "[REDACTED]" : sanitize(child, secret),
  ]));
}

function markdownJson(value: unknown, secret: string) {
  return `\`\`\`json\n${JSON.stringify(sanitize(value, secret), null, 2)}\n\`\`\``;
}

async function main() {
  const apiKey = process.env.CP_DATAJUD_API_KEY || "";
  const baseUrl = process.env.CP_DATAJUD_BASE_URL || "https://api-publica.datajud.cnj.jus.br";
  const researchAuthorized = process.env.CP_DATAJUD_RESEARCH_AUTHORIZED === "true";
  const publicKeyFallback = process.env.CP_DATAJUD_PUBLIC_KEY_FALLBACK === "true";
  if (!isValidCnjProcessNumber(processNumber)) throw new Error("EXPERIMENT_IDENTIFIER_INVALID");

  const adapter = new DataJudTJSPAdapter({ baseUrl, apiKey, researchAuthorized, allowPublicKeyFallback: publicKeyFallback });
  const routes = createResearchOfficialProcessRoutes(adapter);
  const results = await new OfficialProcessSourceCollector(routes).search({ processNumber });
  const dataJud = results.find((result) => result.source === "DATAJUD_TJSP");
  const djen = results.find((result) => result.source === "DJEN");
  const esaj = results.find((result) => result.source === "TJSP_ESAJ");
  const cac = results.find((result) => result.source === "TJSP_DEPRE_CAC");
  const processes = dataJud?.normalized?.processes ?? [];
  const normalizedTarget = normalizeCnjProcessNumber(processNumber);
  const exactTargetMatches = processes.filter((record: any) => normalizeCnjProcessNumber(record.processNumber || "") === normalizedTarget);
  const durationMs = Date.now() - startedAt;
  const sourceRows = results.map((result) => `| ${result.source} | ${result.status} | ${result.requestAttempted ? "sim" : "não"} | ${result.httpStatus ?? "—"} | ${result.normalized?.total ?? "—"} | ${result.error?.message || "—"} |`).join("\n");
  const report = `# DataJud TJSP — Experimento 001

Data: ${new Date().toISOString()}

## Objetivo

Descobrir se o identificador ${processNumber} é diretamente pesquisável no DataJud TJSP e registrar, sem persistência, os resultados das rotas oficiais aplicáveis em sequência.

## Configuração

- Ambiente: RESEARCH experimental.
- Endpoint DataJud: ${dataJud?.endpoint || `${baseUrl}/api_publica_tjsp/_search`}.
- Credencial DataJud: ${apiKey ? "PRESENTE" : "AUSENTE"}; chave: NÃO EXPOSTA.
- Fallback da chave pública CNJ: ${publicKeyFallback ? "HABILITADO PARA ESTA PESQUISA" : "DESABILITADO"}.
- Autorização explícita RESEARCH: ${researchAuthorized ? "PRESENTE" : "AUSENTE"}.
- Consulta DataJud: numeroProcesso=${processNumber} (normalizado como ${normalizedTarget}).
- Validação do identificador CNJ: ${isValidCnjProcessNumber(processNumber) ? "válido estruturalmente" : "inválido"}; isso não prova que o CNJ indexe o DEPRE.
- Persistência: nenhuma; nenhuma tabela ou operação foi escrita.

## Matriz de rotas aplicáveis

| Fonte | Resultado | Requisição enviada | HTTP | Total reportado | Observação |
|---|---|---:|---:|---:|---|
${sourceRows}

DataJud é a primeira rota. Zero resultados, configuração ausente ou falha não interrompem o coletor: ele registra a tentativa e continua para a rota seguinte aplicável. e-SAJ/CAC são estados assistidos e não executam automação nem CAPTCHA.

## Resultado DataJud

- Status: ${dataJud?.status || "NÃO EXECUTADO"}
- HTTP: ${dataJud?.httpStatus ?? "—"}
- Duração: ${dataJud?.durationMs ?? 0} ms
- Requisição DataJud enviada: ${dataJud?.requestAttempted ? "sim" : "não"}
- Total de hits: ${dataJud?.normalized?.total ?? "—"}
- Hits DataJud: ${processes.length}
- Correspondências exatas após normalização do numeroProcesso: ${exactTargetMatches.length}
- Status DataJud do coletor: ${dataJud?.error?.code || "—"}
- Origem da credencial usada: ${dataJud?.credentialSource || "nenhuma"}.

### Campos normalizados observados

${markdownJson(dataJud?.normalized ?? null, apiKey)}

### Payload bruto recebido

O payload é mantido no resultado do adapter em memória e incluído aqui com CPF/CNPJ e qualquer cópia da chave redigidos. Campos não retornados permanecem null; nenhum significado é inferido para dscSistema.

${markdownJson(dataJud?.rawPayload ?? null, apiKey)}

## Identificação do processo

- A API foi consultada diretamente pelo numeroProcesso normalizado somente se requestAttempted=true.
- DEPRE correspondente diretamente retornado: ${exactTargetMatches.length ? "sim" : dataJud?.requestAttempted ? "não" : "NÃO TESTADO — DataJud não foi consultado"}.
- Outros números retornados: ${processes.map((record: any) => record.processNumber || "(numeroProcesso ausente)").join(", ") || "nenhum"}.
- Processos originários: o adapter não infere processo originário; nenhum campo dedicado é normalizado nesta fase.

## Movimentações e metadados

Movimentações, órgão julgador, classe, assuntos, prioridade, formato/sistema e polos são preservados sem interpretação em normalized.processes[].movements e campos relacionados somente quando presentes no payload. dscSistema é registrado literalmente se existir; não há tradução de códigos.

## Fallbacks

- DJEN: ${djen?.status || "NÃO EXECUTADO"}; requestAttempted=${djen?.requestAttempted ?? false}; HTTP=${djen?.httpStatus ?? "—"}; resultado(s)=${djen?.rawPayload && typeof djen.rawPayload === "object" && "resultCount" in djen.rawPayload ? String((djen.rawPayload as { resultCount: unknown }).resultCount) : "—"}.
- e-SAJ: ${esaj?.status || "NÃO EXECUTADO"}; nenhuma requisição automatizada se MANUAL_REQUIRED.
- TJSP/DEPRE CAC: ${cac?.status || "NÃO EXECUTADO"}; rota CAPTCHA/assistida, sem automação.
- DJe, Campinas DO, Guarulhos DO, São Paulo DO/PGM/PGE, PJe, PROJUDI e eproc: não implementados neste experimento.

### Payload das rotas de fallback

${markdownJson({ DJEN: djen?.rawPayload ?? null, ESAJ: esaj?.rawPayload ?? null, TJSP_DEPRE_CAC: cac?.rawPayload ?? null }, apiKey)}

## Utilidade para CP

- CONFIRMADO: somente o que consta nos campos de retorno e nos hits do endpoint.
- NÃO CONFIRMADO: associação sem hit exato do DEPRE; semelhança de nomes; interpretação de dscSistema; processo originário não explicitamente retornado; precisão/atualidade além do payload.
- Nenhum resultado foi transformado em official_evidence_documents, creditor resolution ou atualização operacional.

## Segurança e escopo

- Consultas limitadas ao DEPRE piloto ${processNumber}.
- O coletor é sequencial; não há retries automáticos nem persistência.
- O valor da credencial não é incluído no relatório; CPF/CNPJ são redigidos.
- Requests DataJud e de fallback são indicados individualmente acima; rotas manuais não enviam request.

## Próximo experimento

${dataJud?.requestAttempted ? dataJud.status === "NO_RESULTS" ? "DataJud não retornou registro; manter o resultado negativo desta fonte e revisar a trilha oficial TJSP/DEPRE assistida antes de tentar buscas nominais." : "Inspecionar o hit e comparar os campos retornados com a referência oficial já vinculada, mantendo a separação entre metadados, titularidade e evidência." : "Configurar CP_DATAJUD_API_KEY e CP_DATAJUD_RESEARCH_AUTHORIZED no ambiente de teste aprovado. DataJud não foi consultado neste experimento por falta de pré-requisito; não repetir chamadas a outras fontes sem justificativa/limite explícitos."}

Tempo total do experimento/coleta de rotas: ${durationMs} ms.
`;

  const reportPath = fileURLToPath(new URL("../docs/CP-DATAJUD-TJSP-EXPERIMENT-001.md", import.meta.url));
  await writeFile(reportPath, report, "utf8");
  console.log(JSON.stringify({ reportPath, depre: processNumber, dataJudStatus: dataJud?.status, dataJudRequestAttempted: dataJud?.requestAttempted, routes: results.map(({ source, status, requestAttempted, httpStatus }) => ({ source, status, requestAttempted, httpStatus })), durationMs, credentialPresent: Boolean(apiKey), researchAuthorized, reportCreated: true }, null, 2));
}

main().catch((error: unknown) => {
  const secret = process.env.CP_DATAJUD_API_KEY || "";
  const message = error instanceof Error ? error.message : "EXPERIMENT_FAILED";
  console.error(secret ? message.split(secret).join("[REDACTED]") : message);
  process.exitCode = 1;
});