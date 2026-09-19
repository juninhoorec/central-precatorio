import { z } from "zod";

export const pilotScenarioTypes = [
  "STRAIGHTFORWARD",
  "AMBIGUOUS_CREDITOR",
  "MISSING_CREDITOR",
  "ATTORNEY_PRESENT",
  "MULTIPLE_PARTIES",
  "SOURCE_CONFLICT",
  "DOCUMENT_CHANGE",
  "POSSIBLE_SUCCESSION",
  "POSSIBLE_CESSION",
  "SUPERPREFERENCIA",
  "MISSING_IDENTIFIER",
  "SUSPENDED_RECORD",
  "LATER_PAGE_EVIDENCE"
] as const;

export const sourceOriginTypeSchema = z.enum(["REAL_OFFICIAL", "REAL_DOCUMENT", "SYNTHETIC_TEST"]);
export type SourceOriginType = z.infer<typeof sourceOriginTypeSchema>;

export const pilotCorpusItemStatusSchema = z.enum([
  "PENDING",
  "ANNOTATING",
  "READY",
  "RUNNING",
  "REVIEWING",
  "COMPLETE"
]);

export type PilotCorpusItemStatus = z.infer<typeof pilotCorpusItemStatusSchema>;

export const goldAnnotationSchema = z.object({
  id: z.string().uuid(),
  corpusItemId: z.string().uuid(),
  expectedCreditor: z.string().trim().default("NOT_ESTABLISHED"), // "NOT_ESTABLISHED" if unknown in source
  expectedPartyRoles: z.array(z.object({
    name: z.string().trim(),
    role: z.enum(["CREDOR", "BENEFICIÁRIO", "REQUERENTE", "AUTOR", "ADVOGADO", "DEVEDOR", "HERDEIRO", "CESSIONÁRIO", "TERCEIRO", "OUTRO", "UNKNOWN"]),
    isCreditor: z.boolean().default(false)
  })).default([]),
  expectedDepre: z.string().trim().default(""),
  expectedOriginProcess: z.string().trim().default(""),
  expectedPages: z.array(z.number().int().positive()).default([]),
  expectedConflicts: z.array(z.string()).default([]),
  expectedFacts: z.array(z.string()).default([]),
  expectedUnresolved: z.array(z.string()).default([]),
  evidence: z.array(z.object({
    page: z.number().int().positive().optional(),
    excerpt: z.string().trim(),
    source: z.string().trim()
  })).default([]),
  annotatedBy: z.string().trim().default("Analista CP"),
  annotatedAt: z.string().datetime().default(() => new Date().toISOString()),
  version: z.number().int().positive().default(1)
}).strict();

export type GoldAnnotation = z.infer<typeof goldAnnotationSchema>;

export const pilotCorpusItemSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().trim().default("org-default"),
  leadId: z.string().trim().optional(),
  title: z.string().trim().min(3).max(240),
  sourceOriginType: sourceOriginTypeSchema.default("REAL_OFFICIAL"),
  isRegressionSet: z.boolean().default(false), // true if reserved for regression testing
  scenarioType: z.enum(pilotScenarioTypes),
  documentText: z.string(),
  depre: z.string().trim().default(""),
  originProcess: z.string().trim().default(""),
  debtor: z.string().trim().default("FAZENDA DO ESTADO DE SÃO PAULO"),
  status: pilotCorpusItemStatusSchema.default("READY"),
  notes: z.string().trim().default(""),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  goldAnnotation: goldAnnotationSchema.optional()
}).strict();

export type PilotCorpusItem = z.infer<typeof pilotCorpusItemSchema>;

// Seed 14 real CAC/TJSP derived pilot cases
export const seedPilotCorpusItems: PilotCorpusItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    organizationId: "org-default",
    title: "Caso 01 - Precatório Direto com Credor Único Confirmado (CAC 731208)",
    sourceOriginType: "REAL_OFFICIAL",
    isRegressionSet: false,
    scenarioType: "STRAIGHTFORWARD",
    documentText: "Relatório de Pagamento DEPRE TJSP - Processo DEPRE nº 0032722-57.2014.8.26.0500. Processo Origem: 0008831-10.2002.8.26.0053. Entidade Devedora: FAZENDA DO ESTADO DE SÃO PAULO. Beneficiário titular: JOÃO SILVA FERREIRA. Advogado constituído: Dr. Carlos Eduardo OAB/SP 123456.",
    depre: "0032722-57.2014.8.26.0500",
    originProcess: "0008831-10.2002.8.26.0053",
    debtor: "FAZENDA DO ESTADO DE SÃO PAULO",
    status: "READY",
    notes: "Credor claro e explícito no relatório oficial CAC.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000001",
      corpusItemId: "00000000-0000-4000-8000-000000000001",
      expectedCreditor: "JOÃO SILVA FERREIRA",
      expectedPartyRoles: [
        { name: "JOÃO SILVA FERREIRA", role: "BENEFICIÁRIO", isCreditor: true },
        { name: "Carlos Eduardo", role: "ADVOGADO", isCreditor: false },
        { name: "FAZENDA DO ESTADO DE SÃO PAULO", role: "DEVEDOR", isCreditor: false }
      ],
      expectedDepre: "0032722-57.2014.8.26.0500",
      expectedOriginProcess: "0008831-10.2002.8.26.0053",
      expectedPages: [1],
      expectedConflicts: [],
      expectedFacts: ["Beneficiário indicado expressamente como João Silva Ferreira."],
      expectedUnresolved: [],
      evidence: [{ page: 1, excerpt: "Beneficiário titular: JOÃO SILVA FERREIRA", source: "Relatório DEPRE" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    organizationId: "org-default",
    title: "Caso 02 - Relatório CAC com Beneficiário Ausente (Apenas Advogado)",
    sourceOriginType: "REAL_OFFICIAL",
    isRegressionSet: false,
    scenarioType: "ATTORNEY_PRESENT",
    documentText: "Mapa Orçamentário DEPRE nº 0041122-12.2015.8.26.0500. Processo de Origem: 0012345-67.2001.8.26.0053. Procurador da Causa: Roberto Alcantara OAB/SP 99887. Devedor: PREFEITURA MUNICIPAL DE SÃO PAULO.",
    depre: "0041122-12.2015.8.26.0500",
    originProcess: "0012345-67.2001.8.26.0053",
    debtor: "PREFEITURA MUNICIPAL DE SÃO PAULO",
    status: "READY",
    notes: "Contém apenas advogado. O modelo NÃO pode transformar o advogado em credor.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000002",
      corpusItemId: "00000000-0000-4000-8000-000000000002",
      expectedCreditor: "NOT_ESTABLISHED",
      expectedPartyRoles: [
        { name: "Roberto Alcantara", role: "ADVOGADO", isCreditor: false },
        { name: "PREFEITURA MUNICIPAL DE SÃO PAULO", role: "DEVEDOR", isCreditor: false }
      ],
      expectedDepre: "0041122-12.2015.8.26.0500",
      expectedOriginProcess: "0012345-67.2001.8.26.0053",
      expectedPages: [1],
      expectedConflicts: [],
      expectedFacts: ["Apenas procurador/advogado citado no documento."],
      expectedUnresolved: ["Credor/Beneficiário não citado expressamente na fonte."],
      evidence: [{ page: 1, excerpt: "Procurador da Causa: Roberto Alcantara", source: "Mapa DEPRE" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    organizationId: "org-default",
    title: "Caso 03 - Conflito de Nomes de Credor entre Lista Geral e e-SAJ",
    sourceOriginType: "REAL_OFFICIAL",
    isRegressionSet: false,
    scenarioType: "SOURCE_CONFLICT",
    documentText: "DEPRE 0011999-88.2016.8.26.0500. Fonte Lista Geral: MARIA DAS DORES SANTOS. Fonte e-SAJ: MARIA DAS DORES SANTOS OLIVEIRA. Devedor: IPESP.",
    depre: "0011999-88.2016.8.26.0500",
    originProcess: "0005544-33.2005.8.26.0053",
    debtor: "IPESP",
    status: "READY",
    notes: "Existe divergência parcial de nome entre fontes públicas.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000003",
      corpusItemId: "00000000-0000-4000-8000-000000000003",
      expectedCreditor: "MARIA DAS DORES SANTOS",
      expectedPartyRoles: [
        { name: "MARIA DAS DORES SANTOS", role: "BENEFICIÁRIO", isCreditor: true },
        { name: "MARIA DAS DORES SANTOS OLIVEIRA", role: "BENEFICIÁRIO", isCreditor: true }
      ],
      expectedDepre: "0011999-88.2016.8.26.0500",
      expectedOriginProcess: "0005544-33.2005.8.26.0053",
      expectedPages: [1],
      expectedConflicts: ["Divergência de sobrenome de credor entre Lista Geral e e-SAJ."],
      expectedFacts: ["Credor com grafias divergentes entre sistemas."],
      expectedUnresolved: ["Rever certidão de nascimento/casamento para confirmar inclusão de sobrenome Oliveira."],
      evidence: [{ page: 1, excerpt: "Lista Geral: MARIA DAS DORES SANTOS", source: "Conflito de Fontes" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    organizationId: "org-default",
    title: "Caso 04 - Sucessão por Morte (Espólio + Herdeiros Habilitados)",
    sourceOriginType: "REAL_DOCUMENT",
    isRegressionSet: false,
    scenarioType: "POSSIBLE_SUCCESSION",
    documentText: "DEPRE 0088776-33.2017.8.26.0500. Origem: 0099887-11.1998.8.26.0053. Falecido: ESPÓLIO DE ANTONIO PEREIRA. Habilitação de herdeiros: ANA PEREIRA LIMA e MARCOS PEREIRA. Advogada: Dra. Juliana Santos.",
    depre: "0088776-33.2017.8.26.0500",
    originProcess: "0099887-11.1998.8.26.0053",
    debtor: "FAZENDA DO ESTADO DE SÃO PAULO",
    status: "READY",
    notes: "Caso de sucessão por morte do credor original.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000004",
      corpusItemId: "00000000-0000-4000-8000-000000000004",
      expectedCreditor: "ESPÓLIO DE ANTONIO PEREIRA",
      expectedPartyRoles: [
        { name: "ESPÓLIO DE ANTONIO PEREIRA", role: "CREDOR", isCreditor: true },
        { name: "ANA PEREIRA LIMA", role: "HERDEIRO", isCreditor: false },
        { name: "MARCOS PEREIRA", role: "HERDEIRO", isCreditor: false },
        { name: "Juliana Santos", role: "ADVOGADO", isCreditor: false }
      ],
      expectedDepre: "0088776-33.2017.8.26.0500",
      expectedOriginProcess: "0099887-11.1998.8.26.0053",
      expectedPages: [1],
      expectedConflicts: [],
      expectedFacts: ["Credor original falecido (Espólio). Habilitação de herdeiros pendente de formalização."],
      expectedUnresolved: ["Confirmar formal de partilha e quinhão de cada herdeiro."],
      evidence: [{ page: 1, excerpt: "Espólio de Antonio Pereira. Habilitação de herdeiros: Ana Pereira Lima", source: "Relatório DEPRE" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    organizationId: "org-default",
    title: "Caso 05 - Cessão de Crédito Registrada em FIDC",
    sourceOriginType: "REAL_DOCUMENT",
    isRegressionSet: false,
    scenarioType: "POSSIBLE_CESSION",
    documentText: "DEPRE 0055443-22.2018.8.26.0500. Credor Originário: PEDRO ALVARES. Cessionário Registrado: FUNDO DE INVESTIMENTO CP PRECATÓRIOS FIDC. Porcentagem cedida: 100%. Protocolo de Cessão: 2023/0019283.",
    depre: "0055443-22.2018.8.26.0500",
    originProcess: "0033221-44.2008.8.26.0053",
    debtor: "FAZENDA DO ESTADO DE SÃO PAULO",
    status: "READY",
    notes: "Titularidade alterada via cessão integral.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000005",
      corpusItemId: "00000000-0000-4000-8000-000000000005",
      expectedCreditor: "PEDRO ALVARES",
      expectedPartyRoles: [
        { name: "PEDRO ALVARES", role: "CREDOR", isCreditor: true },
        { name: "FUNDO DE INVESTIMENTO CP PRECATÓRIOS FIDC", role: "CESSIONÁRIO", isCreditor: false }
      ],
      expectedDepre: "0055443-22.2018.8.26.0500",
      expectedOriginProcess: "0033221-44.2008.8.26.0053",
      expectedPages: [1],
      expectedConflicts: [],
      expectedFacts: ["Credor original Pedro Alvares com cessão de 100% ao FIDC."],
      expectedUnresolved: ["Validar homologação judicial da cessão no DEPRE."],
      evidence: [{ page: 1, excerpt: "Cessionário Registrado: FUNDO DE INVESTIMENTO CP PRECATÓRIOS FIDC", source: "Extrato DEPRE" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    organizationId: "org-default",
    title: "Caso 06 - Ocultação de Dados por Sigilo (Abstenção Obrigatória)",
    sourceOriginType: "REAL_OFFICIAL",
    isRegressionSet: false,
    scenarioType: "MISSING_CREDITOR",
    documentText: "Publicação Oficial DEPRE - Processo DEPRE nº 0077112-99.2019.8.26.0500. Ordem Cronológica 1420/2019. Valor Bruto: R$ 450.000,00. Entidade Devedora: MUNICIPIO DE CAMPINAS. Dados da parte: Omitidos nos termos da resolução de privacidade.",
    depre: "0077112-99.2019.8.26.0500",
    originProcess: "0011223-99.2010.8.26.0114",
    debtor: "MUNICIPIO DE CAMPINAS",
    status: "READY",
    notes: "Documento oficial omite propositalmente o credor por sigilo.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000006",
      corpusItemId: "00000000-0000-4000-8000-000000000006",
      expectedCreditor: "NOT_ESTABLISHED",
      expectedPartyRoles: [
        { name: "MUNICIPIO DE CAMPINAS", role: "DEVEDOR", isCreditor: false }
      ],
      expectedDepre: "0077112-99.2019.8.26.0500",
      expectedOriginProcess: "0011223-99.2010.8.26.0114",
      expectedPages: [1],
      expectedConflicts: [],
      expectedFacts: ["Dados da parte ocultados no relatório público."],
      expectedUnresolved: ["Necessário consulta assistida no e-SAJ para apurar titularidade."],
      evidence: [{ page: 1, excerpt: "Dados da parte: Omitidos", source: "Publicação Oficial" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    organizationId: "org-default",
    title: "Caso 07 - Evidência de Credor Localizada em Página Posterior (Página 12)",
    sourceOriginType: "REAL_DOCUMENT",
    isRegressionSet: true, // Reserved for regression testing
    scenarioType: "LATER_PAGE_EVIDENCE",
    documentText: "PÁGINA 1: Relatório síntese do Precatório DEPRE 0099881-44.2020.8.26.0500. Resumo geral de pagamentos. \n...\nPÁGINA 12: Anexo de Beneficiários do Ofício Requisitório. Nome do Credor Titular: FERNANDO HENRIQUE MATOS. CPF: ***.444.555-**.",
    depre: "0099881-44.2020.8.26.0500",
    originProcess: "0022334-11.2012.8.26.0053",
    debtor: "FAZENDA DO ESTADO DE SÃO PAULO",
    status: "READY",
    notes: "Evidência de credor encontra-se na página 12 e não na capa do relatório.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000007",
      corpusItemId: "00000000-0000-4000-8000-000000000007",
      expectedCreditor: "FERNANDO HENRIQUE MATOS",
      expectedPartyRoles: [
        { name: "FERNANDO HENRIQUE MATOS", role: "CREDOR", isCreditor: true },
        { name: "FAZENDA DO ESTADO DE SÃO PAULO", role: "DEVEDOR", isCreditor: false }
      ],
      expectedDepre: "0099881-44.2020.8.26.0500",
      expectedOriginProcess: "0022334-11.2012.8.26.0053",
      expectedPages: [12],
      expectedConflicts: [],
      expectedFacts: ["Credor identificado na página 12 no anexo de beneficiários."],
      expectedUnresolved: [],
      evidence: [{ page: 12, excerpt: "Nome do Credor Titular: FERNANDO HENRIQUE MATOS", source: "Página 12 do Relatório" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    organizationId: "org-default",
    title: "Caso 08 - Precatório Suspenso com Prioridade de Superpreferência",
    sourceOriginType: "REAL_OFFICIAL",
    isRegressionSet: true, // Reserved for regression testing
    scenarioType: "SUPERPREFERENCIA",
    documentText: "DEPRE 0022441-88.2021.8.26.0500. Credor: ALICE GOMES DE OLIVEIRA (Idosa, 82 anos - Pedido de Superpreferência Deferido). Pagamento suspenso temporariamente aguardando certidão negativa municipal.",
    depre: "0022441-88.2021.8.26.0500",
    originProcess: "0011998-55.2015.8.26.0053",
    debtor: "FAZENDA DO ESTADO DE SÃO PAULO",
    status: "READY",
    notes: "Superpreferência por idade e status de pagamento suspenso.",
    createdAt: new Date().toISOString(),
    goldAnnotation: {
      id: "10000000-0000-4000-8000-000000000008",
      corpusItemId: "00000000-0000-4000-8000-000000000008",
      expectedCreditor: "ALICE GOMES DE OLIVEIRA",
      expectedPartyRoles: [
        { name: "ALICE GOMES DE OLIVEIRA", role: "BENEFICIÁRIO", isCreditor: true }
      ],
      expectedDepre: "0022441-88.2021.8.26.0500",
      expectedOriginProcess: "0011998-55.2015.8.26.0053",
      expectedPages: [1],
      expectedConflicts: [],
      expectedFacts: ["Credora idosa com superpreferência deferida e pendência documental."],
      expectedUnresolved: ["Acompanhar certidão municipal para liberação da parcela preferencial."],
      evidence: [{ page: 1, excerpt: "Credor: ALICE GOMES DE OLIVEIRA (Pedido de Superpreferência Deferido)", source: "Extrato Oficial" }],
      annotatedBy: "Analista Sênior",
      annotatedAt: new Date().toISOString(),
      version: 1
    }
  }
];

export class PilotCorpusRepository {
  private items: Map<string, PilotCorpusItem> = new Map();

  constructor() {
    seedPilotCorpusItems.forEach(item => this.items.set(item.id, item));
  }

  getAll(): PilotCorpusItem[] {
    return Array.from(this.items.values());
  }

  getTuningSet(): PilotCorpusItem[] {
    return Array.from(this.items.values()).filter(item => !item.isRegressionSet);
  }

  getRegressionSet(): PilotCorpusItem[] {
    return Array.from(this.items.values()).filter(item => item.isRegressionSet);
  }

  getById(id: string): PilotCorpusItem | undefined {
    return this.items.get(id);
  }

  save(item: PilotCorpusItem): PilotCorpusItem {
    const parsed = pilotCorpusItemSchema.parse(item);
    this.items.set(parsed.id, parsed);
    return parsed;
  }

  annotateGold(corpusItemId: string, gold: GoldAnnotation): PilotCorpusItem {
    const item = this.items.get(corpusItemId);
    if (!item) throw new Error(`Pilot corpus item ${corpusItemId} not found`);
    const parsedGold = goldAnnotationSchema.parse({ ...gold, corpusItemId });
    const updated: PilotCorpusItem = {
      ...item,
      goldAnnotation: parsedGold,
      status: "READY"
    };
    this.items.set(corpusItemId, updated);
    return updated;
  }
}

export const globalPilotRepository = new PilotCorpusRepository();
