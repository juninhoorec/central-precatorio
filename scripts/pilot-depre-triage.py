import csv, json, os, re, sqlite3, hashlib
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOWNLOADS = r"C:\Users\Junio Cavalcanti\Downloads"
OUT = os.path.join(ROOT, "evidence", "pilot-triage-20261010")
os.makedirs(OUT, exist_ok=True)
SOURCE = os.path.join(DOWNLOADS, "fila_piloto_campinas_guarulhos.csv")
DEPRE = re.compile(r"^\d{7}-\d{2}\.\d{4}\.8\.26\.0500$")

with open(SOURCE, encoding="utf-8-sig", errors="replace", newline="") as fh:
    rows = list(csv.DictReader(fh))

db = sqlite3.connect(f"file:{os.path.join(ROOT, 'central-precatorios.db')}?mode=ro", uri=True)
existing = set()
for (workflow,) in db.execute("SELECT workflow FROM operations"):
    try:
        value = json.loads(workflow).get("credit", {}).get("numeroProcessoDEPRE", "")
        if value: existing.add(value)
    except Exception: pass
counts = {"operations": db.execute("SELECT COUNT(*) FROM operations").fetchone()[0], "evidence": db.execute("SELECT COUNT(*) FROM official_evidence_documents").fetchone()[0], "audit": db.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]}
db.close()

unique = {}
occurrences = defaultdict(list)
for line, row in enumerate(rows, 2):
    depre = (row.get("depre") or "").strip()
    if not DEPRE.fullmatch(depre):
        continue
    occurrences[depre].append({"sourceFile": os.path.basename(SOURCE), "rowNumber": line, "raw": row})
    unique.setdefault(depre, row)

def municipality(row):
    debtor = (row.get("devedora") or "").upper()
    if "GUARULHOS" in debtor: return "Guarulhos"
    if "CAMPINAS" in debtor: return "Campinas"
    return "UNRESOLVED"

def rank(row):
    m = municipality(row)
    priority = int(row.get("prioridade") or 999999)
    references = bool((row.get("refs_pdf") or "").strip())
    return (0 if m in {"Campinas", "Guarulhos"} else 1, 0 if references else 1, priority)

candidate_rows = []
for depre, row in unique.items():
    m = municipality(row)
    is_existing = depre in existing
    candidate_rows.append({
        "depre": depre, "depreOriginal": depre, "normalizedKey": re.sub(r"\D", "", depre),
        "classification": "EXISTING_OPERATION" if is_existing else ("ENTITY_CONFLICT" if m == "UNRESOLVED" else "NEW_CANDIDATE"),
        "municipalityCandidate": m, "debtorOriginal": row.get("devedora", ""),
        "originProcessOriginal": row.get("processo_origem", ""), "valueOriginal": row.get("valor_max", ""),
        "documentReferenceOriginal": row.get("refs_pdf", ""), "sourceFile": os.path.basename(SOURCE),
        "sourceRows": [x["rowNumber"] for x in occurrences[depre]], "occurrenceCount": len(occurrences[depre]),
        "missingFields": [k for k in ("advogados", "refs_pdf", "protocolo") if not (row.get(k) or "").strip()],
        "nextAction": "Pesquisa documental oficial; confirmar identidade, devedor e situação atual antes de qualquer promoção.",
        "selectionReason": "Identificador DEPRE válido, prioridade registrada, referência PDF e município dentro do escopo." if m in {"Campinas", "Guarulhos"} else "Revisão de entidade necessária.",
        "raw": row,
    })
candidate_rows.sort(key=lambda item: rank(item["raw"]))
eligible = [x for x in candidate_rows if x["classification"] == "NEW_CANDIDATE"]
pilot = eligible[:50]

for index, item in enumerate(pilot, 1):
    item["pilotOrder"] = index
    item["researchStatus"] = "NOT_YET_RESEARCHED"
    item["result"] = "MANUAL_REVIEW_REQUIRED"
    item["officialSourcesConsulted"] = []
    item["qualifiedEvidenceCount"] = 0
    item["readyForAnalyst"] = False

with open(os.path.join(OUT, "pilot-queue-907.jsonl"), "w", encoding="utf-8") as fh:
    for item in candidate_rows: fh.write(json.dumps(item, ensure_ascii=False) + "\n")
with open(os.path.join(OUT, "pilot-50-selection.jsonl"), "w", encoding="utf-8") as fh:
    for item in pilot: fh.write(json.dumps(item, ensure_ascii=False) + "\n")
with open(os.path.join(OUT, "pilot-occurrences.jsonl"), "w", encoding="utf-8") as fh:
    for depre, values in sorted(occurrences.items()):
        for value in values: fh.write(json.dumps({"depre": depre, **value}, ensure_ascii=False) + "\n")

summary = {
    "generatedAt": datetime.now(timezone.utc).isoformat(), "source": SOURCE,
    "sourceSha256": hashlib.sha256(open(SOURCE, "rb").read()).hexdigest(),
    "sourceRows": len(rows), "validDepreRows": sum(len(v) for v in occurrences.values()),
    "uniqueDepresInPilotFile": len(unique), "declaredPriorInventory": 1652,
    "extractionCorrection": "The earlier 1,652 figure counted process-origin identifiers from all fields. The authoritative depre column contains 907 unique DEPREs.",
    "existingOperationsInLocalReadOnlyDb": len(existing), "newCandidates": len(eligible), "existingOperationsMatchedByExactDepre": len(candidate_rows) - len(eligible),
    "pilotSelected": len(pilot), "pilotByMunicipality": dict(Counter(x["municipalityCandidate"] for x in pilot)),
    "classification": dict(Counter(x["classification"] for x in candidate_rows)), "databaseSnapshot": counts,
    "researchStatus": "SELECTION_READY; official research not fabricated or marked complete",
}
with open(os.path.join(OUT, "pilot-summary.json"), "w", encoding="utf-8") as fh: json.dump(summary, fh, ensure_ascii=False, indent=2)
with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as fh:
    fh.write(f"# Triagem piloto DEPRE — 2026-10-10\n\n{summary['extractionCorrection']}\n\n- Linhas da fila piloto: {len(rows)}\n- DEPREs únicos na coluna depre: {len(unique)}\n- Candidatos novos após comparação exata com operações locais: {len(eligible)}\n- Lote selecionado: {len(pilot)}\n- Distribuição do lote: {summary['pilotByMunicipality']}\n\nA seleção não cria operações, não importa dados e não promove evidências. Os arquivos `pilot-queue-907.jsonl`, `pilot-50-selection.jsonl` e `pilot-occurrences.jsonl` preservam a proveniência. A pesquisa oficial deve preencher os resultados individualmente.\n")
print(json.dumps(summary, ensure_ascii=False, indent=2))
