import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/advogado-contato?nome=<nome>&oab=<OABnumero/UF>
 *
 * Consulta pública do CNA (Cadastro Nacional de Advogados) da OAB.
 * Retorna URL de busca direta + dados conhecidos do advogado.
 *
 * Nenhuma credencial necessária — 100% público.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nome = (searchParams.get("nome") || "").trim();
  const oab  = (searchParams.get("oab")  || "").trim();

  if (!nome && !oab) {
    return NextResponse.json({ error: "Informe nome ou número OAB." }, { status: 400 });
  }

  // Parse OAB: ex "14566/SP" → numero=14566, uf=SP
  let oabNumero = "";
  let oabUF     = "SP";
  if (oab) {
    const parts = oab.replace(/\s/g, "").split("/");
    oabNumero = parts[0].replace(/\D/g, "");
    oabUF     = parts[1]?.toUpperCase() || "SP";
  }

  // Link de busca direta no CNA público
  const cnaSearchUrl = oabNumero
    ? `https://cna.oab.org.br/#/consulta-advogado?inscricao=${oabNumero}&uf=${oabUF}`
    : `https://cna.oab.org.br/#/consulta-advogado?nome=${encodeURIComponent(nome)}&uf=${oabUF}`;

  // Busca na API pública do CNA (sem autenticação)
  let advogadoData: Record<string, unknown> | null = null;
  let apiError: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // O CNA tem uma API pública não documentada usada pelo próprio site
    const apiUrl = oabNumero
      ? `https://cna.oab.org.br/api/advogado/consulta?Inscricao=${oabNumero}&Uf=${oabUF}&NomeParcial=`
      : `https://cna.oab.org.br/api/advogado/consulta?Inscricao=&Uf=${oabUF}&NomeParcial=${encodeURIComponent(nome)}`;

    const resp = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Origin": "https://cna.oab.org.br",
        "Referer": "https://cna.oab.org.br/",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      // CNA retorna array ou objeto com ResultadosConsulta
      const results = Array.isArray(data) ? data : (data?.ResultadosConsulta ?? data?.Items ?? []);
      if (results.length > 0) {
        const r = results[0];
        advogadoData = {
          nome:      r.Nome          ?? r.NomeAdvogado ?? nome,
          oab:       `${r.Inscricao ?? oabNumero}/${r.Uf ?? oabUF}`,
          situacao:  r.Situacao      ?? r.SituacaoAdvogado ?? "Ativo",
          email:     r.Email         ?? r.EmailAdvogado    ?? null,
          telefone:  r.Telefone      ?? r.TelefoneAdvogado ?? null,
          celular:   r.Celular       ?? r.CelularAdvogado  ?? null,
          endereco:  r.Endereco      ?? null,
          municipio: r.Municipio     ?? r.MunicipioAdvogado ?? null,
          uf:        r.Uf            ?? oabUF,
          totalResultados: results.length,
        };
      }
    } else {
      apiError = `CNA retornou ${resp.status}`;
    }
  } catch (err: unknown) {
    apiError = err instanceof Error ? err.message : "Timeout ou CNA indisponível";
  }

  return NextResponse.json({
    source: "CNA – Cadastro Nacional de Advogados (OAB) · Público",
    consultedAt: new Date().toISOString(),
    oab: oab || null,
    nome: nome || null,
    cnaSearchUrl,
    whatsappUrl: advogadoData?.celular
      ? `https://wa.me/55${String(advogadoData.celular).replace(/\D/g, "")}`
      : advogadoData?.telefone
      ? `https://wa.me/55${String(advogadoData.telefone).replace(/\D/g, "")}`
      : null,
    advogado: advogadoData,
    apiError,
    notice: "Dados do Cadastro Nacional de Advogados (OAB). 100% público. Resultado não encontrado não comprova inatividade; consulte diretamente em cna.oab.org.br.",
  });
}
