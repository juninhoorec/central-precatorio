import hashlib, json, os, zipfile
from pypdf import PdfReader
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..")); OUT = os.path.join(ROOT, "evidence", "pilot-triage-20261010"); D = r"C:\Users\Junio Cavalcanti\Downloads"
items=[]
for name in ["SCP_DEPRE_LISTAPRECATORIOPENDENTE_731208.ZIP","SCP_DEPRE_LISTAPRECATORIOPENDENTE_731257.ZIP"]:
 p=os.path.join(D,name); data=open(p,'rb').read(); z=zipfile.ZipFile(p); pdf=next(x for x in z.namelist() if x.lower().endswith('.pdf')); pdfdata=z.read(pdf); r=PdfReader(__import__('io').BytesIO(pdfdata)); first=' '.join((r.pages[0].extract_text() or '').split()); items.append({'zip':name,'zipSha256':hashlib.sha256(data).hexdigest(),'zipBytes':len(data),'members':z.namelist(),'pdf':pdf,'pdfSha256':hashlib.sha256(pdfdata).hexdigest(),'pdfBytes':len(pdfdata),'pages':len(r.pages),'metadata':{str(k):str(v) for k,v in (r.metadata or {}).items()},'firstPage':first[:700],'provenance':'SUPPORTED_BY_INTERNAL_DOCUMENT_METADATA_AND_CONTENT','officialUrl':'','limitation':'Original download URL and access log were not present in the repository or archive; official URL remains unconfirmed.'})
json.dump({'generatedAt':datetime.now(timezone.utc).isoformat(),'documents':items},open(os.path.join(OUT,'pdf-provenance.json'),'w',encoding='utf8'),ensure_ascii=False,indent=2)
json.dump({'officialReferencePages':[{'url':'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral','role':'official TJSP precatorios list portal'},{'url':'https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do','role':'official TJSP/e-SAJ pending and paid lists'}],'caseSpecificOfficialUrlsConfirmed':0,'caseSpecificLocalMatches':50},open(os.path.join(OUT,'official-source-index.json'),'w',encoding='utf8'),ensure_ascii=False,indent=2)
with open(os.path.join(OUT,'pdf-provenance-report.md'),'w',encoding='utf8') as f:
 f.write('# Proveniência dos PDFs do lote piloto\n\n')
 f.write('## Conclusão\n\nOs dois PDFs têm forte evidência interna de serem relatórios do Sistema de Controle de Precatórios/DEPRE: autor `GeneXus`, gerador `GeneXus PDF Report Generator`, produtor iTextSharp e cabeçalho que identifica listas de precatórios pendentes em 04/09/2026. Isso confirma o conteúdo e a origem sistêmica provável, mas não recupera a URL original do download. A proveniência externa permanece `LOCAL_COPY_ORIGIN_UNCONFIRMED`.\n\n')
 for x in items: f.write(f"### {x['zip']}\n\n- SHA-256 ZIP: `{x['zipSha256']}`\n- Conteúdo: `{x['members']}`\n- SHA-256 PDF: `{x['pdfSha256']}`\n- Páginas: {x['pages']}\n- Metadados: `{x['metadata']}`\n- Cabeçalho: {x['firstPage']}\n\n")
 f.write('## Referências oficiais consultadas\n\n- https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral\n- https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do\n\nEssas páginas confirmam o canal institucional e o funcionamento das listas, mas não foram usadas como prova case-specific para nenhum dos 50 casos.\n')
print(json.dumps({'documents':items,'pilotCases':50,'officialCaseSpecificUrls':0},ensure_ascii=False,indent=2))
