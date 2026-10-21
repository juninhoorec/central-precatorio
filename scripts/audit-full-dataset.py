import csv, json, re
from collections import defaultdict
from pathlib import Path
import openpyxl

DOWNLOADS = Path(r"C:\Users\Junio Cavalcanti\Downloads")
FILES = [
    "CP_pacote_completo_73_DEPREs.xlsx",
    "DEPRE_consolidado_recuperado_completo.xlsx",
    "DEPRE_73_contatos_pesquisados.xlsx",
    "fila_piloto_campinas_guarulhos.csv",
    "CP_CAC_PESQUISA_907_CANDIDATOS.csv",
    "fila_pesquisa.csv",
    "fila_pesquisa.jsonl",
    "registros_completos.csv",
]
CNJ_RE = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")

def text(value):
    return str(value or "").strip()

def find_depres(row):
    found = []
    for key, value in row.items():
        if "depre" not in key.lower():
            continue
        for match in CNJ_RE.findall(text(value)):
            if match not in found:
                found.append(match)
    return found

def classify_row(row):
    joined = " ".join(text(v).lower() for v in row.values())
    has_value = bool(re.search(r"(?:r\$|valor|amount|nominal|cr[eé]dito).{0,80}\d", joined))
    has_url = bool(re.search(r"https?://", joined))
    has_doc = any(token in joined for token in ("ofício", "oficio", "documento", "publicação", "publicacao", "sei", "pdf"))
    return has_value, has_url, has_doc

def consume(source, row_number, row, out):
    dep = find_depres(row)
    has_value, has_url, has_doc = classify_row(row)
    out["rows"] += 1
    out["rows_with_depre"] += bool(dep)
    out["rows_with_value_signal"] += has_value
    out["rows_with_url"] += has_url
    out["rows_with_document_signal"] += has_doc
    for d in dep:
        out["depres"].add(d)
        out["occurrences"][d].append({"source": source, "row": row_number, "has_value_signal": has_value, "has_url": has_url, "has_document_signal": has_doc})

def audit_file(path):
    result = {"path": str(path), "exists": path.exists(), "rows": 0, "rows_with_depre": 0, "rows_with_value_signal": 0, "rows_with_url": 0, "rows_with_document_signal": 0, "depres": set(), "occurrences": defaultdict(list), "sheets": []}
    if not path.exists(): return result
    if path.suffix.lower() == ".xlsx":
        workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for sheet in workbook.worksheets:
            iterator = sheet.iter_rows(values_only=True)
            try: headers = [text(v) for v in next(iterator)]
            except StopIteration: continue
            sheet_rows = 0
            for number, values in enumerate(iterator, start=2):
                if not any(text(v) for v in values): continue
                row = {headers[i] if i < len(headers) else f"column_{i}": values[i] for i in range(len(values))}
                consume(f"{path.name}::{sheet.title}", number, row, result)
                sheet_rows += 1
            result["sheets"].append({"name": sheet.title, "headers": headers, "rows": sheet_rows})
        workbook.close()
    elif path.name.endswith(".jsonl"):
        with path.open(encoding="utf-8-sig") as stream:
            for number, line in enumerate(stream, start=1):
                if line.strip(): consume(path.name, number, json.loads(line), result)
    else:
        with path.open(encoding="utf-8-sig", newline="", errors="replace") as stream:
            reader = csv.DictReader(stream)
            result["headers"] = reader.fieldnames or []
            for number, row in enumerate(reader, start=2): consume(path.name, number, row, result)
    return result

def serializable(result):
    result = dict(result)
    result["depres"] = sorted(result["depres"])
    result["occurrences"] = dict(result["occurrences"])
    return result

if __name__ == "__main__":
    results = [serializable(audit_file(DOWNLOADS / name)) for name in FILES]
    all_depres = defaultdict(list)
    for result in results:
        for depre in result["depres"]:
            all_depres[depre].append(result["path"])
    summary = []
    for result in results:
        summary.append({
            "file": result["path"], "exists": result["exists"], "rows": result["rows"],
            "unique_depres": len(result["depres"]), "rows_with_value_signal": result["rows_with_value_signal"],
            "rows_with_url": result["rows_with_url"], "rows_with_document_signal": result["rows_with_document_signal"],
            "sheets": result["sheets"], "headers": result.get("headers", []),
        })
    print(json.dumps({
        "files": summary,
        "all_unique_depres": len(all_depres),
        "appears_in_multiple_sources": sum(len(v) > 1 for v in all_depres.values()),
        "source_intersection_distribution": {str(n): sum(len(v) == n for v in all_depres.values()) for n in range(1, 8)},
    }, ensure_ascii=False, indent=2))
