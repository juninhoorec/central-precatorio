# Mesa de operações CP

## Disponível nesta versão

- Cadastro progressivo de operações, devedor, tribunal, processo, responsável e origem.
- Persistência LibSQL no servidor, separada dos contatos e isolada pela organização ativa.
- Pipeline por etapa, busca, filtros e agenda de tarefas por operação.
- Diligência com checklist individual, sem certificação automática.
- Documentos PDF até 5 MB no banco, download autenticado em produção e hash SHA-256.
- Propostas indicativas e cenários independentes por oportunidade; comparação por custo, prazo e retorno.
- Exportações CSV, JSON do dossiê e texto de proposta.
- Histórico gerado no servidor e controle de versão contra sobrescrita concorrente.
- Métricas calculadas sobre os registros cadastrados.

## Referências de produto pesquisadas

Pipedrive: atividades, próximos passos, visualização de etapas e acompanhamento de negócios: https://www.pipedrive.com/en/features/pipeline-management

DealCloud: histórico de relacionamentos e negócios, pipeline e diligência: https://dealcloud.com/solutions/business-development/

Firmex: organização documental e integração de salas de documentos: https://www.firmex.com/resources/wp-content/uploads/sites/2/2019/12/Firmex-API-Integrate-Automate-VDR.pdf

As referências orientam recursos; o CP não possui conexão contratada com esses fornecedores.

## Limites da implantação atual

Esta é a mesa interna de uma operação CP. Todas as pessoas com a credencial administrativa compartilham o mesmo acesso. Não habilitar acesso a empresas externas independentes antes de isolamento por organização e contas individuais.

PDFs são armazenados com acesso restrito, mas não são inspecionados por antivírus, OCR ou validação jurídica. Novos envios não sobrescrevem versões anteriores. Infraestrutura remota, backup e controle de retenção dependem da implantação.

O histórico registra mudanças pelo servidor, mas não é ledger imutável nem identifica colaboradores individualmente enquanto a autenticação for compartilhada.

Cadastro, proposta indicativa e mudança de etapa são registros internos: não assinam, transferem créditos, liquidam pagamentos ou protocolam cessões.

Consulta de metadados processuais públicos via DataJud está disponível em Integrações. KYC/KYB, assinatura, pagamento e protocolo aguardam fornecedores e credenciais.

## Verificação desta evolução — 9 de setembro de 2026

- 14 testes automatizados aprovados; compilação de produção e TypeScript aprovados.
- Teste no navegador: criação, edição, tarefa e persistência após recarregar.
- Teste HTTP: conflito de versão 409, origem ausente 403, upload/listagem/download PDF com igualdade dos bytes.
- Revisão de produto e código com agente Astra: prioridade ao titular na home, separação das ferramentas profissionais, proteção contra edição durante salvamento e recuperação de conflitos.
- Registro identificado como “TESTE TÉCNICO CP — dados fictícios” e PDF técnico mantidos na base local para demonstrar a verificação; não representam oportunidade comercial.

Esta revisão não é certificação jurídica, auditoria independente de segurança ou aprovação para operar como SaaS multiempresa. Assinatura, transferência, pagamentos e consulta processual automática continuam fora do fluxo executado pelo CP.
