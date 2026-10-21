import csv, json, hashlib
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'evidence' / 'contacts-operational-20261010'
OUT = ROOT / 'evidence' / f'contact-source-audit-{date.today():%Y%m%d}'
OUT.mkdir(parents=True, exist_ok=True)

with (SRC / 'contacts-operational-73.csv').open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
assert len(rows) == 73
assert len({r['depre'] for r in rows}) == 73

verified_business = {
    '0246430-49.2021.8.26.0500': {
        'entity': 'Linkcon Ltda. – EPP', 'channel': '(81) 3019-3706',
        'url': 'https://portaldatransparencia.gov.br/pessoa-juridica/05323742000171',
        'source': 'Portal da Transparência / CGU',
        'fact': 'Página pública associa o CNPJ 05.323.742/0001-71 à Linkcon LTDA e exibe telefone 81 30193706.',
        'result': 'CONFIRMADO', 'limit': 'Canal institucional da empresa; não comprova contato pessoal nem titularidade atual.'},
    '0325500-18.2021.8.26.0500': {
        'entity': 'Linkcon Eirelli EPP', 'channel': '(81) 3019-3706',
        'url': 'https://portaldatransparencia.gov.br/pessoa-juridica/05323742000171',
        'source': 'Portal da Transparência / CGU',
        'fact': 'A fonte pública identifica Linkcon LTDA pelo mesmo CNPJ/canal usado na pesquisa anterior; a variação Eirelli/EPP do artefato requer reconciliação nominal.',
        'result': 'REVISÃO_MANUAL', 'limit': 'A fonte confirma a entidade/CNPJ, mas não resolve sozinha a divergência de razão social entre o DEPRE e a página.'},
    '0105609-68.2016.8.26.0500': {
        'entity': 'Facci Participações Ltda.', 'channel': '',
        'url': 'https://casadosdados.com.br/solucao/cnpj/facci-participacoes-ltda-03878165000159',
        'source': 'Casa dos Dados', 'fact': 'Página pública identifica a pessoa jurídica.',
        'result': 'CORRESPONDÊNCIA_PARCIAL', 'limit': 'Não foi validado canal institucional confiável; números genéricos/inconsistentes foram mantidos fora da lista verificada.'},
    '0020675-12.2018.8.26.0500': {
        'entity': 'MR Administração de Bens Próprios Ltda.', 'channel': '',
        'url': 'https://esaj.tjsp.jus.br/cjsg/getArquivo.do?casChecked=true&cdAcordao=18967759&cdForo=0',
        'source': 'TJSP/e-SAJ', 'fact': 'Acórdão público identifica a pessoa jurídica em documento judicial.',
        'result': 'CORRESPONDÊNCIA_PARCIAL', 'limit': 'A fonte comprova identidade jurídica, não canal de contato público.'},
    '0299677-13.2019.8.26.0500': {
        'entity': 'Osaip Empreendimentos e Participações Ltda.', 'channel': '',
        'url': 'https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=15%2F08%2F2023&jornal=515&pagina=18',
        'source': 'Diário Oficial da União', 'fact': 'Publicação oficial menciona Osaip Empreendimentos e Participações Ltda. e seu CNPJ.',
        'result': 'CORRESPONDÊNCIA_PARCIAL', 'limit': 'Não foi confirmado canal institucional independente; cadastro agregador não foi tratado como prova suficiente.'},
    '0187219-48.2022.8.26.0500': {
        'entity': 'Precatórios do Brasil Ltda.', 'channel': '',
        'url': 'https://www.imprensaoficial.com.br/downloads/pdf/edicao/20240807EXEC3.pdf',
        'source': 'Imprensa Oficial do Estado de São Paulo', 'fact': 'Publicação oficial menciona Precatórios do Brasil Ltda. em contexto de DEPRE.',
        'result': 'CORRESPONDÊNCIA_PARCIAL', 'limit': 'Telefone e e-mail vieram apenas de cadastro agregador e não foram elevados a canal verificado.'},
    '7006578-24.2014.8.26.0500': {
        'entity': 'Comercial e Construtora Fenix Eireli', 'channel': '(11) 4441-7141',
        'url': 'https://www.gov.br/dnocs/pt-br/acesso-a-informacao/licitacoes-e-contratos/conteudo/consulta-de-licitacoes/2024/pregoes/administracao-central/pregao-90008-2024-srp/contrarrazoes-item-05-empresa-comercial-e-construtora-fenix.pdf',
        'source': 'DNOCS / gov.br', 'fact': 'Documento oficial associa a empresa ao telefone 11 4441-7141.',
        'result': 'CONFIRMADO', 'limit': 'Canal empresarial; e-mails encontrados em documentos oficiais divergem e não foram consolidados como único contato.'},
}

fields = ['depre','categoriaOriginal','pessoaEntidade','canalEncontrado','url','fonte','dataConsulta','fatoComprovado','resultado','tipoVinculo','limitacoes','proximaAcao']
findings = []
for r in rows:
    cat = r['estadoContato']
    route = r['organizacaoEscritorio'] or r['nomeAssociado']
    if r['depre'] in verified_business:
        v = verified_business[r['depre']]
        findings.append({
            'depre': r['depre'], 'categoriaOriginal': cat, 'pessoaEntidade': v['entity'],
            'canalEncontrado': v['channel'], 'url': v['url'], 'fonte': v['source'],
            'dataConsulta': date.today().isoformat(), 'fatoComprovado': v['fact'],
            'resultado': v['result'], 'tipoVinculo': 'CANAL_EMPRESARIAL',
            'limitacoes': v['limit'], 'proximaAcao': 'Reconciliação manual do vínculo com o titular/DEPRE.'})
    elif cat == 'ROTA_PROFISSIONAL':
        findings.append({
            'depre': r['depre'], 'categoriaOriginal': cat, 'pessoaEntidade': route,
            'canalEncontrado': r['telefonePublico'] or r['emailPublico'], 'url': r['siteUrl'] or r['fonteUrl'],
            'fonte': r['tituloOrgaoFonte'] or 'Artefato de consolidação anterior',
            'dataConsulta': date.today().isoformat(),
            'fatoComprovado': r['justificativa'] or r['fatoComprovado'],
            'resultado': 'REVISÃO_MANUAL', 'tipoVinculo': 'VÍNCULO_DOCUMENTAL_HISTÓRICO',
            'limitacoes': 'A rota consta no artefato anterior, mas não foi encontrada nesta auditoria uma página pública independente que prove identidade, canal e vínculo atual de forma conjunta.',
            'proximaAcao': 'Localizar fonte institucional do advogado/escritório e confirmar se o vínculo é histórico ou atual.'})
    else:
        findings.append({
            'depre': r['depre'], 'categoriaOriginal': cat, 'pessoaEntidade': r['nomeAssociado'],
            'canalEncontrado': '', 'url': '', 'fonte': 'Artefato de consolidação anterior',
            'dataConsulta': date.today().isoformat(),
            'fatoComprovado': 'Não há contato público confiável confirmado no material auditado.',
            'resultado': 'SEM_RESULTADO', 'tipoVinculo': 'NÃO_CONFIRMADO',
            'limitacoes': 'Busca ampla não repetida nesta rodada sem pista documental específica; ausência não prova inexistência de contato.',
            'proximaAcao': 'Pesquisar somente após surgir pista documental específica de titularidade ou representação.'})

with (OUT / 'contact-source-findings.csv').open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(findings)
with (OUT / 'contact-source-findings.jsonl').open('w', encoding='utf-8') as f:
    for x in findings: f.write(json.dumps(x, ensure_ascii=False) + '\n')

vb = [x for x in findings if x['tipoVinculo']=='CANAL_EMPRESARIAL' and x['resultado']=='CONFIRMADO' and x['canalEncontrado']]
with (OUT / 'verified-business-channels.csv').open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['depre','pessoaEntidade','canal','url','fonte','dataConsulta','fatoComprovado','limitacoes']); w.writeheader()
    for x in vb: w.writerow({'depre':x['depre'],'pessoaEntidade':x['pessoaEntidade'],'canal':x['canalEncontrado'],'url':x['url'],'fonte':x['fonte'],'dataConsulta':x['dataConsulta'],'fatoComprovado':x['fatoComprovado'],'limitacoes':x['limitacoes']})

with (OUT / 'verified-professional-routes.csv').open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['depre','pessoaEntidade','canal','url','fonte','vinculo','resultado','limitacoes']); w.writeheader()
    # No route is promoted: no independent source proved identity + channel + DEPRE relation in this audit.

manual = [x for x in findings if x['resultado'] != 'CONFIRMADO']
with (OUT / 'contact-audit-manual-review.csv').open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(manual)

summary = {
    'totalDepres': 73,
    'distribuicaoOriginal': {'CONTATO_CONFIRMADO':7,'ROTA_PROFISSIONAL':32,'SEM_CONTATO_CONFIRMADO':34},
    'tentativasRegistradas': len(findings), 'confirmados': sum(x['resultado']=='CONFIRMADO' for x in findings),
    'correspondenciasParciais': sum(x['resultado']=='CORRESPONDÊNCIA_PARCIAL' for x in findings),
    'revisaoManual': sum(x['resultado']=='REVISÃO_MANUAL' for x in findings),
    'semResultado': sum(x['resultado']=='SEM_RESULTADO' for x in findings),
    'canaisEmpresariaisVerificados': len(vb), 'rotasProfissionaisVerificadas': 0,
}
(OUT / 'contacts-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')

md = f'''# Auditoria de fontes públicas dos contatos dos 73 DEPREs

Data da auditoria: {date.today().isoformat()}

## Resultado

- DEPREs processados: **73**, todos únicos.
- Distribuição original preservada: 7 `CONTATO_CONFIRMADO`, 32 `ROTA_PROFISSIONAL`, 34 `SEM_CONTATO_CONFIRMADO`.
- Tentativas registradas: {len(findings)}.
- Resultados confirmados: {summary['confirmados']}.
- Correspondências parciais: {summary['correspondenciasParciais']}.
- Revisão manual: {summary['revisaoManual']}.
- Sem resultado nesta auditoria: {summary['semResultado']}.
- Canais empresariais verificáveis: {len(vb)} associações DEPRE/canal.
- Rotas profissionais promovidas nesta auditoria: 0.

## Metodologia

O arquivo operacional anterior foi usado como inventário, não como prova nova. Cada canal só foi considerado verificável quando a fonte pública identificou explicitamente a entidade e o canal. Canais de cadastro agregador, e-mails divergentes, vínculos históricos e homônimos foram mantidos em revisão manual. Nenhum contato direto de beneficiário foi inferido a partir de canal empresarial ou de advogado.

## Fontes verificadas

1. Portal da Transparência/CGU para Linkcon: confirma entidade/CNPJ e telefone institucional. A associação do segundo DEPRE exige reconciliação nominal da variação de razão social.
2. DNOCS/gov.br para Comercial e Construtora Fenix: confirma entidade e telefone institucional. Os e-mails publicados em documentos oficiais divergem, portanto não foram consolidados.

As demais fontes registradas no CSV sustentam apenas identidade jurídica ou correspondência parcial, não um canal verificável suficiente.

## Limitações

O estado `ROTA_PROFISSIONAL` anterior não foi convertido automaticamente em rota verificada. Para fazê-lo seria necessário comprovar, em fonte pública independente, a identidade do profissional, o canal e a relação com o DEPRE, distinguindo vínculo histórico de vínculo atual. Para os 34 casos sem contato, a busca ampla não foi repetida sem pista específica.

## Preservação

Esta auditoria gerou somente artefatos em `{OUT.relative_to(ROOT)}`. Não houve gravação em banco, importação, promoção de evidência, alteração de `READY_FOR_ANALYST`, deploy ou alteração de produção.
'''
(OUT / 'contact-source-audit-summary.md').write_text(md, encoding='utf-8')

readme = f'''# Contact source audit

Artefatos gerados em {date.today().isoformat()} a partir de `evidence/contacts-operational-20261010/`.

Reprodução: executar `python scripts/audit-contact-sources-73.py` a partir da raiz do repositório. O script lê o CSV consolidado, cria uma pasta datada e não abre o banco.

Os resultados web foram registrados manualmente com URL, fonte, fato comprovado e limitações. `verified-business-channels.csv` contém somente canais classificados como `CONFIRMADO`. `verified-professional-routes.csv` permanece vazio nesta rodada porque nenhuma rota reuniu prova independente suficiente de identidade, canal e vínculo.
'''
(OUT / 'README.md').write_text(readme, encoding='utf-8')

print(OUT)
print(json.dumps(summary, ensure_ascii=False))
