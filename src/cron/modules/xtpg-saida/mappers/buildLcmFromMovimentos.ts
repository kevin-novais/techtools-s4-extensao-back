/**
 * Monta o JSON de criação do LCM (Journal Entry) no S/4 a partir dos movimentos
 * de um PAR_CONTABIL. Reusa o contrato `IntegracaoSAPJson` / serviço
 * `IntegracaoSapCreateJournalEntryService` (mesmo endpoint da documento-fiscal).
 *
 * Formato definido pelo dev (DTZ-227, exemplo do PAR_CONTABIL 3962):
 *  - `tipoArApGl` / `tipoDocumento` / `textoDocumento` vêm da Configuração
 *    Contábil (tipoProcesso XTPG_R) – ver ConfiguracaoContabilXtpgRepository.
 *  - Header SEM valorDocumento / codigoParceiro / condicaoPagto.
 *  - Linhas AGREGADAS por conta: C multiplica por -1 e soma, D apenas soma
 *    (sobre o valor absoluto) -> 1 item por conta, só { conta, valor }.
 *  - numeroDocumento = PAR_CONTABIL; datas a partir de DATA
 *    (dataEmissao/dataLancamento/dataVencimento = yyyy-MM-dd, sem horário).
 *
 * HouseBank/HouseBankAccount/TextoDetalhe por linha: COMENTADOS por definição da
 * equipe (11/06) – o contrato do /createJournalEntry ainda não será estendido.
 * O de-para bancário segue resolvido e gravado no Detail (rastreio).
 */
import type { IntegracaoSAPJson } from "@/modules/documento-fiscal/utils/BuildSapIntegration";
import type { ConfiguracaoContabilXtpg } from "@/cron/modules/xtpg-saida/repositories/ConfiguracaoContabilXtpgRepository";
import type { LoteParContabil, MovimentoContabilXtpg } from "@/cron/modules/xtpg-saida/types/xtpgSaida.types";

/** Converte o valor textual do XTPG para número (aceita vírgula decimal). */
export function parseValor(valor: string): number {
    if (!valor) return 0;
    const v = valor.trim();
    // formato BR (1.234,56) -> normaliza; formato com ponto decimal já é parseável
    const normalizado = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : 0;
}

/** Aplica o sinal conforme D/C sobre o valor ABSOLUTO: D = positivo, C = negativo. */
export function valorComSinal(mov: MovimentoContabilXtpg): number {
    const abs = Math.abs(parseValor(mov.valor));
    const dc = (mov.creditoDebito || "").trim().toUpperCase();
    return dc === "C" ? -abs : abs;
}

/**
 * Agrega os movimentos por conta contábil S/4 (já convertida pelo de-para
 * contas_contabeis.gl_account_b1_xtpg): soma os valores já com sinal
 * (C negativo / D positivo) -> 1 item por conta. Ex.: 3 movimentos do
 * PAR_CONTABIL 3962 viram 2 itens na chamada ao SAP.
 */
export function agregarPorConta(
    movimentos: MovimentoContabilXtpg[],
    contaS4PorContaB1: Map<string, string>,
): { conta: string; valor: number }[] {
    const somaPorConta = new Map<string, number>();
    for (const mov of movimentos) {
        const conta = contaS4PorContaB1.get(mov.contaContabil) ?? mov.contaContabil;
        somaPorConta.set(conta, (somaPorConta.get(conta) ?? 0) + valorComSinal(mov));
    }
    // arredonda a 2 casas p/ evitar resíduo de ponto flutuante na soma
    return [...somaPorConta.entries()].map(([conta, valor]) => ({
        conta,
        valor: Math.round(valor * 100) / 100,
    }));
}

/**
 * Detecta o cenário "lançamento na mesma conta": quando débito e crédito de um
 * PAR caem na MESMA conta S/4, a soma agregada daquela conta zera. O S/4 rejeita
 * esse LCM com um HTTP 400 sem descrição útil (só "Request failed with status code
 * 400"). Retorna as contas cuja linha agregada zerou (vazio = ok) para emitir uma
 * crítica clara antes de enviar. Marco 21/08 (lote 040120260820171939, PARs 4068/4069).
 */
export function detectarContasZeradas(lancamentos: { conta: string; valor: number }[]): string[] {
    // valores já vêm arredondados a 2 casas de agregarPorConta; 0,005 cobre o -0.
    return lancamentos.filter((l) => Math.abs(l.valor) < 0.005).map((l) => l.conta);
}

/**
 * (DTZ-302) Marca no texto do header dos LCMs da SAÍDA XTPG, para o envio IGNORAR esses
 * documentos no ramo 30 (LCM) do `XRT_SendFlux` e evitar o round-trip (a saída voltando pela
 * entrada). O compensador do estorno usa `${MARCA_HEADER_SAIDA} EST {codigoSap}`. Limite de 25
 * caracteres no campo do S/4. A view filtra `accounting_document_header_text LIKE 'XTPG %'`.
 */
export const MARCA_HEADER_SAIDA = "XTPG";

/** Prefixa o texto do header com a marca da saída (idempotente) e trunca em 25 chars. */
export function marcarTextoSaida(texto: string | null | undefined): string {
    const base = (texto ?? "").trim();
    const prefixo = `${MARCA_HEADER_SAIDA} `;
    const marcado = base.toUpperCase().startsWith(prefixo.toUpperCase()) ? base : `${prefixo}${base}`;
    return marcado.slice(0, 25).trimEnd();
}

/** DATA (yyyy-MM-dd ou dd/MM/yyyy) -> `yyyy-MM-dd` (date-only). */
export function toDateOnly(data: string): string {
    const v = (data || "").trim();
    const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return v;
}

export interface CentrosContaS4 {
    centroCusto: string | null;
    centroLucro: string | null;
}

export interface BuildLcmParams {
    lote: LoteParContabil;
    /** CompanyCode resolvido no de-para `cia` (cia_id_sap). */
    codigoCia: string;
    /** Configuração contábil XTPG_R da CIA (tipoArApGl/tipoDocumento/textoDocumento). */
    configuracao: ConfiguracaoContabilXtpg;
    /** De-para conta B1 (XTPG) -> conta S/4 (contas_contabeis.gl_account_b1_xtpg). */
    contaS4PorContaB1: Map<string, string>;
    /**
     * (DTZ-247) Centro de custo/lucro por conta S/4 (contas_contabeis) – preenche as
     * linhas do LCM. Opcional para compatibilidade; contas sem cadastro vão sem centro.
     */
    centrosPorContaS4?: Map<string, CentrosContaS4>;
    /** Usuário de lançamento (Config.S4_HANA_CLOUD_USER_NAME). */
    usuarioLancamento: string;
}

export function buildLcmFromMovimentos(params: BuildLcmParams): IntegracaoSAPJson {
    const { lote, codigoCia, configuracao, contaS4PorContaB1, centrosPorContaS4, usuarioLancamento } = params;
    const dateOnly = toDateOnly(lote.data);

    const lancamentosContabeis = agregarPorConta(lote.movimentos, contaS4PorContaB1).map((item) => {
        // DTZ-247: inclui centro de custo/lucro cadastrados na conta (só quando preenchidos).
        const centros = centrosPorContaS4?.get(item.conta);
        return {
            conta: item.conta,
            valor: item.valor,
            ...(centros?.centroCusto ? { centroCusto: centros.centroCusto } : {}),
            ...(centros?.centroLucro ? { centroLucro: centros.centroLucro } : {}),
            // Campos abaixo COMENTADOS por definição da equipe (11/06) – o contrato do
            // /createJournalEntry ainda não será estendido. Descomentar quando o S/4 aceitar.
            // textoDetalhe: ...,
            // houseBank: ...,
            // houseBankAccount: ...,
        };
    });

    const integracao: IntegracaoSAPJson = {
        tipoArApGl: configuracao.tipoArApGl,
        tipoDocumento: configuracao.tipoDocumento,
        codigoCia,
        numeroDocumento: lote.parContabil,
        // DTZ-302: marca de saída no texto do header (para o envio ignorar — ver marcarTextoSaida).
        textoDocumento: marcarTextoSaida(configuracao.textoDocumento),
        dataEmissao: dateOnly,
        dataVencimento: dateOnly,
        dataLancamento: dateOnly,
        usuarioLancamento,
        lancamentosContabeis,
        anexos: [],
    };

    return integracao;
}
