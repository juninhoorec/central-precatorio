import csv, json, os, hashlib
from collections import Counter
from datetime import datetime, timezone
from openpyxl import load_workbook

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOWNLOADS = r"C:\Users\Junio Cavalcanti\Downloads"
OUT = os.path.join(ROOT, "evidence", "contacts-operational-20261010")
os.makedirs(OUT, exist_ok=True)
source = os.path.join(DOWNLOADS, "DEPRE_73_contatos_pesquisados.xlsx")
source_hash = hashlib.sha256(open(source, "rb").read()).hexdigest()
wb = load_workbook(source, read_only=True, data_only=True)
ws = wb["Contatos 73"]
rows = list(ws.values)
headers = [str(x or "").strip() for x in rows[0]]
records = []
for excel_row, values in enumerate(rows[1:], 2):
    raw = {headers[i]: values[i] if i < len(values) else "" for i in range(len(headers))}
    status = str(raw.get("Status de contato") or "").strip()
    if status == "Contato empresarial":
        principal = "CONTATO_CONFIRMADO"; category = "EMPRESARIAL_PUBLICO"; relation = "empresa_ou_entidade_associada"
    elif status == "Rota profissional":
        principal = "ROTA_PROFISSIONAL"; category = "ADVOGADO_OU_ESCRITORIO"; relation = "representacao_profissional_documentada_ou_indicada"
    elif status == "Sem contato confirmado":
        principal = "SEM_CONTATO_CONFIRMADO"; category = "NENHUM"; relation = "nao_confirmado"
    else:
        principal = "SEM_CONTATO_CONFIRMADO"; category = "REVISAR_STATUS_ORIGINAL"; relation = "status_original_nao_mapeado"
    depre = str(raw.get("DEPRE") or "").strip()
    records.append({
        "depre": depre, "municipio": str(raw.get("Município") or "").strip(),
        "estadoContato": principal, "categoriaContato": category,
        "nomeAssociado": str(raw.get("Titular/Credor") or "").strip(),
        "organizacaoEscritorio": str(raw.get("Rota/Contato público") or "").strip(),
        "telefonePublico": "", "emailPublico": "", "oabUf": "", "siteUrl": "",
        "fonteUrl": "", "tituloOrgaoFonte": str(raw.get("Fonte da busca") or "").strip(),
        "dataFonte": "", "dataConsulta": "", "fatoComprovado": str(raw.get("Detalhe") or "").strip(),
        "vinculoContato": relation, "confianca": "ALTA" if principal == "CONTATO_CONFIRMADO" else "MEDIA" if principal == "ROTA_PROFISSIONAL" else "NAO_CONFIRMADA",
        "justificativa": str(raw.get("Detalhe") or "").strip(),
        "conflitoHomônimo": "REVISAR" if principal != "CONTATO_CONFIRMADO" else "NAO_IDENTIFICADO",
        "proximaAcaoManual": "Confirmar canal e vínculo documental antes da abordagem." if principal != "SEM_CONTATO_CONFIRMADO" else "Pesquisar advogado/escritório por DEPRE e fonte oficial; não atribuir homônimo.",
        "fonteArquivo": os.path.basename(source), "fontePlanilha": "Contatos 73", "fonteLinha": excel_row,
        "statusOriginal": status, "valorOriginalPreservado": json.dumps(raw, ensure_ascii=False),
    })

assert len(records) == 73
assert len({r["depre"] for r in records}) == 73
allowed = {"CONTATO_CONFIRMADO", "ROTA_PROFISSIONAL", "SEM_CONTATO_CONFIRMADO"}
assert {r["estadoContato"] for r in records} <= allowed

operational_fields = ["depre", "municipio", "estadoContato", "categoriaContato", "nomeAssociado", "organizacaoEscritorio", "telefonePublico", "emailPublico", "oabUf", "siteUrl", "fonteUrl", "tituloOrgaoFonte", "dataFonte", "dataConsulta", "fatoComprovado", "vinculoContato", "confianca", "justificativa", "conflitoHomônimo", "proximaAcaoManual", "fonteArquivo", "fontePlanilha", "fonteLinha", "statusOriginal"]
with open(os.path.join(OUT, "contacts-operational-73.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    writer = csv.DictWriter(fh, fieldnames=operational_fields); writer.writeheader(); writer.writerows({k: r[k] for k in operational_fields} for r in records)
with open(os.path.join(OUT, "contacts-operational-73.jsonl"), "w", encoding="utf-8") as fh:
    for r in records: fh.write(json.dumps(r, ensure_ascii=False) + "\n")
source_rows = []
for r in records:
    source_rows.append({"depre": r["depre"], "sourceFile": r["fonteArquivo"], "sheet": r["fontePlanilha"], "row": r["fonteLinha"], "sourceLabel": r["tituloOrgaoFonte"], "fact": r["fatoComprovado"], "relation": r["vinculoContato"], "status": r["estadoContato"]})
with open(os.path.join(OUT, "contacts-source-register.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    fields = list(source_rows[0]); writer = csv.DictWriter(fh, fieldnames=fields); writer.writeheader(); writer.writerows(source_rows)
reviews = [r for r in records if r["estadoContato"] != "CONTATO_CONFIRMADO"]
with open(os.path.join(OUT, "contacts-manual-review.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    fields = ["depre", "estadoContato", "nomeAssociado", "organizacaoEscritorio", "fatoComprovado", "conflitoHomônimo", "proximaAcaoManual", "fonteLinha"]; writer = csv.DictWriter(fh, fieldnames=fields); writer.writeheader(); writer.writerows({k: r[k] for k in fields} for r in reviews)
counts = Counter(r["estadoContato"] for r in records)
summary = {"generatedAt": datetime.now(timezone.utc).isoformat(), "sourceFile": source, "sourceSha256": source_hash, "totalRows": len(records), "uniqueDepres": len({r['depre'] for r in records}), "distribution": dict(counts), "directOrBusinessChannels": counts["CONTATO_CONFIRMADO"], "professionalRoutes": counts["ROTA_PROFISSIONAL"], "withoutConfirmedContact": counts["SEM_CONTATO_CONFIRMADO"], "manualReview": len(reviews), "databaseChanged": False, "evidencePromoted": False}
with open(os.path.join(OUT, "contacts-summary.json"), "w", encoding="utf-8") as fh: json.dump(summary, fh, ensure_ascii=False, indent=2)
with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as fh:
    fh.write(f"# Contatos operacionais dos 73 DEPREs\n\nGerado em {summary['generatedAt']} em modo somente leitura.\n\n- Fonte: `{source}`\n- SHA-256 da fonte: `{source_hash}`\n- DEPREs processados: 73\n- Distribuição: {dict(counts)}\n\nO arquivo original usa `Contato empresarial`, `Rota profissional` e `Sem contato confirmado`. Esses estados foram mapeados, sem inventar telefone, e-mail, OAB ou URL. A planilha não contém URL, telefone, e-mail ou OAB confirmados nos campos analisados; por isso esses campos permanecem vazios.\n\n`ROTA_PROFISSIONAL` não significa contato direto com o titular. `SEM_CONTATO_CONFIRMADO` não significa inexistência de contato, apenas ausência de canal confiável na pesquisa registrada.\n\nNenhuma operação, evidência, auditoria ou banco foi alterado.\n")
print(json.dumps(summary, ensure_ascii=False, indent=2))
