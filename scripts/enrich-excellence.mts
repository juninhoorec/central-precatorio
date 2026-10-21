import * as fs from 'fs';

const queue = JSON.parse(fs.readFileSync('data/queue-907-consolidated-final.json', 'utf-8')) as Array<Record<string, unknown>>;

const MarcoAurelio = {
  id: 'CP-EXCELENCIA-0001',
  depre: '1072559-02.2025.8.26.0053/16',
  titular: 'Marco Aurelio Garcez de Moura',
  cpfCnpj: '108.538.378-48',
  valor: 586213.75,
  municipio: 'São Paulo',
  devedor: 'MUNICÍPIO DE SÃO PAULO',
  processoOrigem: '1039876-58.2015.8.26.0053',
  advogadoNome: 'Augusto da Fonseca Sociedade de Advogados',
  advogadoOab: 'OAB 14566/SP',
  advogadoContato: '',
  oficio1Url: 'https://esaj.tjsp.jus.br/pastadigital/pg/abrirConferenciaDocumento.do?processo.codigo=1072559-02.2025.8.26.0053&documento.codigo=rNqa3Nex',
  oficio2Url: 'https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=1039876-58.2015.8.26.0053&foroNumeroUnificado=0053',
  statusLocalizacao: 'LOCALIZADO',
  prioridade: 0,
  natureza: 'Alimentar - Salários e Vencimentos',
  honorarios: '15%',
  cnaUrl: 'https://cna.oab.org.br/'
};

queue.forEach((r) => {
  r.cnaUrl = r.advogadoNome ? 'https://cna.oab.org.br/' : '';
  r.natureza = r.natureza || (Number(r.valor) > 300000 ? 'Alimentar' : 'Alimentar / Comum');
});

if (!queue.some((q) => String(q.titular || '').includes('Marco Aurelio'))) {
  queue.unshift(MarcoAurelio);
}

fs.writeFileSync('data/queue-907-consolidated-final.json', JSON.stringify(queue, null, 2), 'utf-8');
console.log('Fila enriquecida com sucesso! Total:', queue.length);
