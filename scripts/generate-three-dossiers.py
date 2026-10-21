from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

OUT = Path('outputs/three-dossiers')
OUT.mkdir(parents=True, exist_ok=True)

CASES = [
    {
        'city': 'Campinas', 'id': 'CP-907-0277', 'depre': '0279214-11.2023.8.26.0500',
        'holder': 'Valter Alves dos Santos', 'document': 'Não localizado na fila', 'value': 674817.87,
        'debtor': 'Município de Campinas', 'origin': '0006848-49.2023.8.26.0114',
        'lawyer': 'André Laubenstein Pereira', 'oab': 'Não informado na fila', 'nature': 'Alimentar',
        'oficio': 'https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=0279214-11.2023.8.26.0500&foroNumeroUnificado=0500',
        'origin_url': 'https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=0006848-49.2023.8.26.0114',
    },
    {
        'city': 'Guarulhos', 'id': 'CP-907-0848', 'depre': '0034190-80.2019.8.26.0500',
        'holder': 'Patricia Aparecida da Conceição Nascimento', 'document': 'Não localizado na fila', 'value': 305673.72,
        'debtor': 'Município de Guarulhos', 'origin': '0039069-22.2018.8.26.0224',
        'lawyer': 'Janice Cristina de Oliveira Rocha; Renato Donizete Santos; Dauber Silva', 'oab': 'Não informado na fila', 'nature': 'Alimentar',
        'oficio': 'https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=0034190-80.2019.8.26.0500&foroNumeroUnificado=0500',
        'origin_url': 'https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=0039069-22.2018.8.26.0224',
    },
    {
        'city': 'São Paulo', 'id': 'CP-EXCELENCIA-0001', 'depre': '1072559-02.2025.8.26.0053/16',
        'holder': 'Marco Aurelio Garcez de Moura', 'document': '108.538.378-48', 'value': 586213.75,
        'debtor': 'Município de São Paulo', 'origin': '1039876-58.2015.8.26.0053',
        'lawyer': 'Augusto da Fonseca Sociedade de Advogados', 'oab': 'OAB 14566/SP', 'nature': 'Alimentar — Salários e Vencimentos',
        'oficio': 'https://esaj.tjsp.jus.br/pastadigital/pg/abrirConferenciaDocumento.do?processo.codigo=1072559-02.2025.8.26.0053&documento.codigo=rNqa3Nex',
        'origin_url': 'https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=1039876-58.2015.8.26.0053&foroNumeroUnificado=0053',
    },
]

def brl(value):
    return f'R$ {value:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

def whatsapp(c):
    return f'''*CENTRAL PRECATÓRIOS — DOSSIÊ PARA ANÁLISE*
*Município:* {c['city']}
*Identificação CP:* {c['id']}

*Credor / titular:* {c['holder']}
*CPF/CNPJ disponível:* {c['document']}
*Número DEPRE:* {c['depre']}
*Valor informado:* {brl(c['value'])}
*Ente devedor:* {c['debtor']}
*Processo de origem:* {c['origin']}
*Natureza:* {c['nature']}
*Advogado(s):* {c['lawyer']}
*OAB:* {c['oab']}

*Ofício / consulta TJSP:* {c['oficio']}
*Processo de origem:* {c['origin_url']}

*Conferência necessária:* confirmar titular, CPF/CNPJ, valor, advogado e conteúdo do ofício diretamente no TJSP/e-SAJ antes de qualquer proposta.
*Próxima ação sugerida:* conferir o ofício e validar a titularidade.'''

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCP', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=19, leading=23, textColor=colors.HexColor('#102a43'), alignment=TA_CENTER, spaceAfter=5*mm))
styles.add(ParagraphStyle(name='SubCP', parent=styles['Normal'], fontSize=9, leading=13, textColor=colors.HexColor('#52606d'), alignment=TA_CENTER, spaceAfter=7*mm))
styles.add(ParagraphStyle(name='SectionCP', parent=styles['Heading2'], fontSize=12, leading=15, textColor=colors.HexColor('#1d4ed8'), spaceBefore=4*mm, spaceAfter=2*mm))
styles.add(ParagraphStyle(name='SmallCP', parent=styles['Normal'], fontSize=8, leading=11, textColor=colors.HexColor('#52606d')))

def make_pdf(c):
    filename = OUT / f"dossie-{c['city'].lower().replace('ã','a').replace(' ','-')}-{c['id']}.pdf"
    doc = SimpleDocTemplate(str(filename), pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=14*mm, bottomMargin=14*mm, title=f"Dossiê {c['depre']}")
    story = [Paragraph('CENTRAL PRECATÓRIOS', styles['TitleCP']), Paragraph('Dossiê comercial para triagem e validação manual', styles['SubCP'])]
    story += [Paragraph(f"{c['city']} · {c['depre']}", styles['SectionCP'])]
    data = [
        ['Campo', 'Informação disponível'], ['Identificação CP', c['id']], ['Credor / titular', c['holder']],
        ['CPF/CNPJ', c['document']], ['DEPRE', c['depre']], ['Valor informado', brl(c['value'])],
        ['Ente devedor', c['debtor']], ['Processo de origem', c['origin']], ['Natureza', c['nature']],
        ['Advogado(s)', c['lawyer']], ['OAB', c['oab']],
    ]
    table = Table([[Paragraph(str(x), styles['SmallCP']) for x in row] for row in data], colWidths=[42*mm, 135*mm], repeatRows=1)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#dbeafe')),('TEXTCOLOR',(0,0),(-1,0),colors.HexColor('#1e3a8a')),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#cbd5e1')),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [table, Paragraph('Links para conferência oficial', styles['SectionCP'])]
    links = Table([[Paragraph('Ofício / consulta TJSP', styles['SmallCP']), Paragraph(f'<link href="{c["oficio"]}">{c["oficio"]}</link>', styles['SmallCP'])], [Paragraph('Processo de origem', styles['SmallCP']), Paragraph(f'<link href="{c["origin_url"]}">{c["origin_url"]}</link>', styles['SmallCP'])]], colWidths=[42*mm, 135*mm])
    links.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#cbd5e1')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [links, Paragraph('Checklist do analista', styles['SectionCP']), Paragraph('☐ Confirmar o titular nos autos  ·  ☐ Confirmar CPF/CNPJ  ·  ☐ Conferir valor atualizado  ·  ☐ Conferir advogado/OAB  ·  ☐ Ler o ofício requisitório  ·  ☐ Registrar conclusão no CP', styles['SmallCP']), Spacer(1, 5*mm), Paragraph('Observação: este material é um dossiê de prospecção. Os dados devem ser validados pelo analista antes de qualquer decisão comercial.', styles['SmallCP'])]
    doc.build(story)
    return filename

texts = []
for case in CASES:
    make_pdf(case)
    txt = OUT / f"whatsapp-{case['city'].lower().replace('ã','a').replace(' ','-')}.txt"
    txt.write_text(whatsapp(case), encoding='utf-8')
    texts.append(f"### {case['city']}\nPDF: {make_pdf(case).name}\n\n{whatsapp(case)}")
(OUT / 'resumos-whatsapp.md').write_text('\n\n---\n\n'.join(texts), encoding='utf-8')
print(f'Gerados {len(CASES)} dossiês em {OUT.resolve()}')
