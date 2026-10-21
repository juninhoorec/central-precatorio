import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface PrecatRecord {
  id: string;
  depre: string;
  titular: string;
  valor: number;
  municipio: string;
  devedor: string;
  processoOrigem: string;
  advogadoNome: string;
  advogadoOab: string;
  advogadoContato: string;
  oficio1Url: string;
  oficio2Url: string;
  statusLocalizacao: 'LOCALIZADO' | 'PENDENTE' | 'DISPONIVEL';
  prioridade: number;
}

const cellText = (value: unknown) => String(value ?? '').trim();

export function buildConsolidatedQueue(): PrecatRecord[] {
  // 1. Load known titulars from DEPRE_consolidado_recuperado_completo.xlsx
  const titularMap = new Map<string, { titular: string; cpfCnpj: string; advogado: string; municipio: string }>();
  const consolPath = path.resolve('data/CP_pacote_completo_73_DEPREs.xlsx');
  const consolDownloadPath = 'C:\\Users\\Junio Cavalcanti\\Downloads\\DEPRE_consolidado_recuperado_completo.xlsx';
  
  if (fs.existsSync(consolDownloadPath)) {
    try {
      const buf = fs.readFileSync(consolDownloadPath);
      const wb = XLSX.read(buf, { type: 'buffer' });
      for (const s of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[s]);
        rows.forEach((r) => {
          const d = cellText(r['DEPRE / Processo'] || r['DEPRE']);
          const t = cellText(r['Titular / Beneficiário'] || r['Credor / Titular']);
          const adv = cellText(r['Advogado']);
          const doc = cellText(r['CPF / CNPJ']);
          if (d && t) {
            titularMap.set(d, { titular: t, cpfCnpj: doc, advogado: adv, municipio: s });
          }
        });
      }
    } catch (e) {
      console.error('Error reading DEPRE_consolidado:', e);
    }
  }

  // Also check CP_pacote_completo_73_DEPREs.xlsx
  if (fs.existsSync(consolPath)) {
    try {
      const buf = fs.readFileSync(consolPath);
      const wb = XLSX.read(buf, { type: 'buffer' });
      if (wb.Sheets['Contatos 73']) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Contatos 73']);
        rows.forEach((r) => {
          const d = cellText(r['DEPRE']);
          const t = cellText(r['Titular/Credor']);
          const rota = cellText(r['Rota/Contato público']);
          const mun = cellText(r['Município']);
          if (d && t && !titularMap.has(d)) {
            titularMap.set(d, { titular: t, cpfCnpj: '', advogado: rota, municipio: mun });
          }
        });
      }
    } catch (e) {
      console.error('Error reading CP_pacote_completo:', e);
    }
  }

  // 2. Read 907 fila
  const fila907Path = 'C:\\Users\\Junio Cavalcanti\\Downloads\\fila_piloto_campinas_guarulhos.csv';
  const records: PrecatRecord[] = [];
  
  if (fs.existsSync(fila907Path)) {
    const lines = fs.readFileSync(fila907Path, 'utf-8').trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(',');
      const prio = parseInt(parts[0], 10) || i;
      const depre = (parts[1] || '').trim();
      const procOrigem = (parts[2] || '').trim();
      const valor = parseFloat(parts[3]) || 0;
      const devedora = (parts[6] || '').trim();
      let advogado = (parts[12] || '').trim();

      let municipio = devedora.toUpperCase().includes('GUARULHOS')
        ? 'Guarulhos'
        : devedora.toUpperCase().includes('CAMPINAS')
        ? 'Campinas'
        : 'São Paulo';

      // Check if titular is in titularMap
      const enriched = titularMap.get(depre);
      const titular = enriched ? enriched.titular : '';
      if (enriched && enriched.advogado && !advogado) {
        advogado = enriched.advogado;
      }
      if (enriched && enriched.municipio) {
        municipio = enriched.municipio;
      }

      // Extract OAB if present in string
      let advOab = '';
      if (advogado.includes('OAB')) {
        const m = advogado.match(/OAB[^\s,;]+/i);
        if (m) advOab = m[0];
      }

      // URLs for direct official view of the DEPRE and origin process
      // Official direct links to TJSP e-SAJ and Portal Devedor
      const oficio1Url = `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${depre}&foroNumeroUnificado=0500`;
      const oficio2Url = procOrigem
        ? `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${procOrigem}`
        : `https://esaj.tjsp.jus.br/portalDevedor/consultarListaPagamentos.do`;

      records.push({
        id: `CP-907-${i.toString().padStart(4, '0')}`,
        depre,
        titular,
        valor,
        municipio,
        devedor: devedora,
        processoOrigem: procOrigem,
        advogadoNome: advogado,
        advogadoOab: advOab,
        advogadoContato: enriched?.advogado || '',
        oficio1Url,
        oficio2Url,
        statusLocalizacao: titular ? 'LOCALIZADO' : 'PENDENTE',
        prioridade: prio,
      });
    }
  }

  // Also include enriched records from São Paulo from consolidado if not already present
  let extraCount = 907;
  for (const [depre, item] of titularMap.entries()) {
    if (!records.some(r => r.depre === depre)) {
      extraCount++;
      const oficio1Url = `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${depre}&foroNumeroUnificado=0500`;
      records.unshift({
        id: `CP-SP-${extraCount}`,
        depre,
        titular: item.titular,
        valor: 150000, // standard baseline for SP qualified
        municipio: item.municipio || 'São Paulo',
        devedor: item.municipio ? `MUNICÍPIO DE ${item.municipio.toUpperCase()}` : 'MUNICÍPIO DE SÃO PAULO',
        processoOrigem: '',
        advogadoNome: item.advogado || '',
        advogadoOab: '',
        advogadoContato: '',
        oficio1Url,
        oficio2Url: `https://esaj.tjsp.jus.br/portalDevedor/consultarListaPagamentos.do`,
        statusLocalizacao: 'LOCALIZADO',
        prioridade: 0,
      });
    }
  }

  return records;
}

if (process.argv[1]?.includes('consolidate-pilot-907')) {
  const records = buildConsolidatedQueue();
  const localizados = records.filter(r => r.statusLocalizacao === 'LOCALIZADO');
  console.log(`Total consolidado: ${records.length}`);
  console.log(`Total LOCALIZADO com Titular: ${localizados.length}`);
  console.log('Sample localizados:', localizados.slice(0, 5).map(l => ({ depre: l.depre, titular: l.titular, mun: l.municipio, adv: l.advogadoNome })));
}
