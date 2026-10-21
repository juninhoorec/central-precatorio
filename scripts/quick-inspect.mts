import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const xlsxPath = path.resolve('data/CP_pacote_completo_73_DEPREs.xlsx');
if (fs.existsSync(xlsxPath)) {
  const buf = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  console.log('Sheets in CP_pacote_completo_73_DEPREs.xlsx:', wb.SheetNames);
  for (const name of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
    console.log(`Sheet "${name}" rows:`, data.length);
    if (data.length > 0) {
      console.log(`Sample row [0] in "${name}":`, JSON.stringify(data[0]));
      // Check for credor / titular / valor / municipio
      const firstWithTitular = data.find((r: Record<string, unknown>) => r.credor || r.titular || r.beneficiario || r.autor);
      if (firstWithTitular) {
        console.log(`First row with titular in "${name}":`, JSON.stringify(firstWithTitular));
      }
    }
  }
}
