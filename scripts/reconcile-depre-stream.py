import csv, json, os, re, sys
from collections import defaultdict
from openpyxl import load_workbook

DOWNLOADS = r"C:\Users\Junio Cavalcanti\Downloads"
OUT = os.path.abspath("evidence/reconciliation-20261009")
os.makedirs(OUT, exist_ok=True)
PATTERN = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.8\.26\.\d{4}\b")
SOURCES = [
    "CP_pacote_completo_73_DEPREs.xlsx", "DEPRE_consolidado_recuperado_completo.xlsx",
    "DEPRE_73_contatos_pesquisados.xlsx", "fila_piloto_campinas_guarulhos.csv",
    "CP_CAC_PESQUISA_907_CANDIDATOS.csv", "fila_pesquisa.csv", "fila_pesquisa.jsonl", "registros_completos.csv",
]

def extract(values):
    text = " | ".join("" if v is None else str(v) for v in values)
    return list(dict.fromkeys(PATTERN.findall(text)))

def add(rows, source, sheet, line, values, raw):
    ids = extract(values)
    for original in ids:
        rows.append({"sourceFile": source, "sheet": sheet, "rowNumber": line, "depreOriginal": original,
                     "depreKey": re.sub(r"\D", "", original), "identifiersInRow": ids, "raw": raw})

rows = []
for source in SOURCES:
    path = os.path.join(DOWNLOADS, source)
    if not os.path.exists(path):
        continue
    if source.endswith(".xlsx"):
        wb = load_workbook(path, read_only=True, data_only=True)
        for sheet in wb.sheetnames:
            ws = wb[sheet]
            it = ws.iter_rows(values_only=True)
            headers = [str(v or f"column_{i+1}") for i, v in enumerate(next(it, ())) ]
            for line, values in enumerate(it, 2):
                raw = {headers[i] if i < len(headers) else f"column_{i+1}": values[i] if i < len(values) else "" for i in range(len(values))}
                add(rows, source, sheet, line, values, raw)
    elif source.endswith(".jsonl"):
        with open(path, encoding="utf-8-sig", errors="replace") as fh:
            for line, text in enumerate(fh, 1):
                if not text.strip(): continue
                try: raw = json.loads(text)
                except Exception: raw = {"rawLine": text.rstrip("\n"), "parseError": True}
                add(rows, source, "", line, list(raw.values()), raw)
    else:
        with open(path, encoding="utf-8-sig", errors="replace", newline="") as fh:
            reader = csv.DictReader(fh)
            for line, raw in enumerate(reader, 2):
                add(rows, source, "", line, list(raw.values()), raw)

with open(os.path.join(OUT, "depre-correspondence.jsonl"), "w", encoding="utf-8") as out:
    for row in rows: out.write(json.dumps(row, ensure_ascii=False) + "\n")

by_key = defaultdict(list)
for row in rows: by_key[row["depreKey"]].append(row)
with open(os.path.join(OUT, "depre-master.jsonl"), "w", encoding="utf-8") as out:
    for key in sorted(by_key):
        items = by_key[key]
        originals = sorted(set(x["depreOriginal"] for x in items))
        municipalities = sorted(set(str(v).strip() for x in items for k, v in x["raw"].items() if re.search(r"munic|devedora|debtor", k, re.I) and str(v).strip()))
        debtors = sorted(set(str(v).strip() for x in items for k, v in x["raw"].items() if re.search(r"devedora|debtor|ente", k, re.I) and str(v).strip()))
        conflict = len(originals) > 1 or len(municipalities) > 1 or len(debtors) > 1
        out.write(json.dumps({"depreKey": key, "depreOriginals": originals, "occurrenceCount": len(items),
          "sourceCount": len(set(x["sourceFile"] for x in items)), "municipalities": municipalities,
          "debtors": debtors, "conflict": conflict}, ensure_ascii=False) + "\n")

source_sets = {source: {x["depreKey"] for x in rows if x["sourceFile"] == source} for source in SOURCES}
intersections = []
for i, left in enumerate(SOURCES):
    for right in SOURCES[i+1:]:
        intersections.append({"sourceA": left, "sourceB": right, "intersection": len(source_sets[left] & source_sets[right])})
summary = {"totalOccurrences": len(rows), "totalUniqueDepres": len(by_key), "sourceStats": [{"sourceFile": s, "occurrences": sum(1 for x in rows if x["sourceFile"] == s), "uniqueDepres": len(source_sets[s]), "found": os.path.exists(os.path.join(DOWNLOADS, s))} for s in SOURCES], "intersections": intersections, "rowsWithMultipleIdentifiers": sum(1 for x in rows if len(x["identifiersInRow"]) > 1), "entityConflicts": sum(1 for x in by_key.values() if len(set(x[0]["depreOriginal"] for _ in [0])) and len(set(str(v).strip() for y in x for k,v in y["raw"].items() if re.search(r"munic|devedora|debtor", k, re.I) and str(v).strip())) > 1)}
with open(os.path.join(OUT, "reconciliation-source-summary.json"), "w", encoding="utf-8") as fh: json.dump(summary, fh, ensure_ascii=False, indent=2)
print(json.dumps(summary, ensure_ascii=False, indent=2))
