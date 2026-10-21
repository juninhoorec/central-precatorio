import csv, hashlib, json
from pathlib import Path
from datetime import date

root = Path(__file__).resolve().parents[1]
downloads = Path(r'C:\Users\Junio Cavalcanti\Downloads')
out = root / 'evidence' / f'djen-pilot-audit-{date.today():%Y%m%d}'
out.mkdir(parents=True, exist_ok=True)
src = downloads / 'piloto_20_casos.csv'
rows = list(csv.DictReader(src.open(encoding='utf-8-sig')))
assert len(rows) == 20 and len({r['depre'] for r in rows}) == 20
assert sum(r['origem_amostra'].startswith('base73') for r in rows) == 10
assert sum(r['origem_amostra'].startswith('fila') for r in rows) == 10

inv_fields = ['id','depre','processo_origem','origem_amostra','devedora','valor','natureza','ordem','advogado_lista','credor_conhecido_base73','esaj_busca_processo_origem','camposAusentes','possivelDuplicata']
with (out/'pilot-20-inventory.csv').open('w',encoding='utf-8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=inv_fields); w.writeheader()
    for r in rows:
        missing=';'.join(k for k in ['ordem','credor_conhecido_base73'] if not r.get(k,'').strip())
        w.writerow({**r,'camposAusentes':missing,'possivelDuplicata':'não'})

db = root/'central-precatorios.db'
sha = hashlib.sha256(db.read_bytes()).hexdigest().upper()
report = f'''# Auditoria do piloto DJEN externo

Data: {date.today().isoformat()}

## Resultado executivo

- CSV: 20 linhas e 20 DEPREs únicos.
- Controles base73: 10.
- Candidatos novos: 10.
- Processos originários distintos: {len(set(r['processo_origem'] for r in rows))}.
- Município/devedor: São Paulo 10, Guarulhos 5, Campinas 5.
- Nenhuma consulta de rede foi executada nesta auditoria.
- Adaptador externo: `NOT_VALIDATED`.
- Integração recomendada: usar o `djenAdapter` já existente no CP, não o script Python como segundo pipeline.

## Problemas comprovados no artefato Python

1. O endpoint usado é `https://comunicaapi.pje.jus.br/api/v1/comunicacao`, diferente do endpoint configurado no CP (`https://hcomunicaapi.cnj.jus.br/api/v1/comunicacao`). A disponibilidade e o contrato do endpoint externo não foram comprovados.
2. O script consulta tanto `processo_origem` quanto `depre`, mas grava os resultados em CSV sem um classificador de correspondência explícita entre comunicação, processo originário e DEPRE.
3. O script transforma destinatários/polo ativo em `candidatos_credor_polo_ativo`; isso é apenas pista processual e não confirmação de titularidade atual.
4. Erros são reduzidos a uma mensagem textual e a consulta continua; não há estados estruturados equivalentes a `SOURCE_BLOCKED`, `RATE_LIMITED`, `NO_RESULT` e `SOURCE_UNAVAILABLE` do CP.
5. O retry só trata 429, não usa `Retry-After`, e grava arquivos `raw/` no diretório de execução. Não existe chave de idempotência persistida nem isolamento por tenant.
6. O script depende de `requests`, que não está declarado nos requisitos do projeto, e não valida o schema individual de cada comunicação.

## Comparação com o CP

O CP já possui adaptador isolado em `src/lib/acquisition-sources.ts`, com URL oficial centralizada, validação CNJ, timeout de 12 segundos, classificação de 401/403/429/5xx, JSON inválido, deduplicação por hash/id, URL consultada, data, identificador, comunicações, partes e contatos. Os testes existentes cobrem esses contratos e foram ampliados nesta rodada.

O CP também mantém o resultado como comunicação/fonte, não como confirmação automática de credor. O Evidence Gate continua separado e não foi alterado.

## Testes sem rede

O contrato do adaptador existente foi executado com fixtures sintéticas: {22} testes PASS em `src/lib/acquisition-sources.test.ts`, incluindo resposta encontrada, vazia, 403, 429, 5xx, timeout/abort, JSON inválido, campos ausentes, deduplicação, partes/advogados e separação do processo originário.

## Conectividade

Não executada. Portanto não há resultado HTTP real e o piloto externo permanece `NOT_VALIDATED`. O próximo teste seguro é uma única consulta opt-in, com um processo autorizado, usando o adaptador do CP e sem persistência operacional.

## Preservação

Banco local verificado sem escrita. SHA-256 atual: `{sha}`. Nenhum caso foi importado, nenhuma evidência foi promovida, nenhuma migration ou deploy foi executado.
'''
(out/'djen-pilot-static-audit.md').write_text(report,encoding='utf-8')
(out/'README.md').write_text('Artefatos gerados por scripts/audit-djen-pilot.py. Auditoria estática e inventário local; nenhuma chamada de rede e nenhuma escrita no banco.\n',encoding='utf-8')
print(out)
