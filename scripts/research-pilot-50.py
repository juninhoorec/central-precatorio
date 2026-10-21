import json, os, re, zipfile
from datetime import datetime, timezone
from pypdf import PdfReader

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "evidence", "pilot-triage-20261010")
DOWNLOADS = r"C:\Users\Junio Cavalcanti\Downloads"
sources = {
    "SCP_DEPRE_LISTAPRECATORIOPENDENTE_731208.ZIP": ("Campinas", "SCP_DEPRE_LISTAPRECATORIOPENDENTE_731208.ZIP"),
    "SCP_DEPRE_LISTAPRECATORIOPENDENTE_731257.ZIP": ("Guarulhos", "SCP_DEPRE_LISTAPRECATORIOPENDENTE_731257.ZIP"),
}
texts = {}
for archive, (municipality, _) in sources.items():
    with zipfile.ZipFile(os.path.join(DOWNLOADS, archive)) as zf:
        pdf_name = next(name for name in zf.namelist() if name.lower().endswith(".pdf"))
        reader = PdfReader(zf.open(pdf_name))
        texts[municipality] = [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]

results = []
for line in open(os.path.join(OUT, "pilot-50-selection.jsonl"), encoding="utf-8"):
    case = json.loads(line); depre = case["depre"]; municipality = case["municipalityCandidate"]
    matches = []
    for page, text in texts.get(municipality, []):
        if depre in text:
            matches.append({"page": page, "excerpt": " ".join(text[text.index(depre):text.index(depre) + 400].split())})
    if matches:
        result = "PARTIAL_MATCH"
        limitation = "Correspondência encontrada em PDF local do lote, mas o arquivo disponível é um ZIP local sem URL/órgão emissor verificável nesta execução; não conta como evidência oficial VERIFIED."
    else:
        result = "NO_OFFICIAL_MATCH"
        limitation = "Não localizado no PDF local correspondente; consulta oficial online adicional necessária."
    results.append({"depre": depre, "municipality": municipality, "result": result, "sourceArchive": next((a for a, (m, _) in sources.items() if m == municipality), ""), "documentDate": "UNKNOWN", "officialUrl": "", "matches": matches, "qualifiedEvidenceCount": 0, "readyForAnalyst": False, "limitation": limitation, "nextAction": "Obter URL/registro do órgão emissor e validar o documento original em fonte oficial; depois pesquisar segunda fonte independente."})

with open(os.path.join(OUT, "pilot-50-document-results.jsonl"), "w", encoding="utf-8") as fh:
    for row in results: fh.write(json.dumps(row, ensure_ascii=False) + "\n")
summary = {"generatedAt": datetime.now(timezone.utc).isoformat(), "cases": len(results), "foundInLocalPdf": sum(1 for x in results if x["result"] == "PARTIAL_MATCH"), "notFoundInLocalPdf": sum(1 for x in results if x["result"] == "NO_OFFICIAL_MATCH"), "officialVerified": 0, "readyForAnalyst": 0, "note": "Local PDF matches are triage signals only; no official URL or independent second evidence was inferred."}
with open(os.path.join(OUT, "pilot-research-summary.json"), "w", encoding="utf-8") as fh: json.dump(summary, fh, ensure_ascii=False, indent=2)
print(json.dumps(summary, ensure_ascii=False, indent=2))
