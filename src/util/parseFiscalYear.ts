/**
 * Converte o ano fiscal do SAP (string NVarChar(4), ex.: "2026") para Int, ou null quando ausente
 * ou invalido. Usado para casar documentos por (codigo + ano): o SAP reinicia a sequencia do numero
 * do documento a cada ano fiscal, entao o codigo sozinho nao e unico entre anos.
 */
export function parseFiscalYear(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const year = Number(value);

  return Number.isInteger(year) && year > 0 ? year : null;
}
