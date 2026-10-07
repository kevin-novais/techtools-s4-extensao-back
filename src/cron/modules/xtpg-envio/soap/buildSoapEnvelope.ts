/**
 * Monta o envelope SOAP `EnviarListaMovimentoCaixaAssinc` da XTPG (DeepXRT) em LOTE.
 *
 * As tags de cada `<deep:Movimento>` vêm já resolvidas e ORDENADAS do mapper
 * (cada fluxo pode ter um conjunto/ordem diferente de tags).
 */
import type { MovimentoResolvido } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

/** Escapa caracteres reservados de XML. */
export function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildMovimentoXml(mov: MovimentoResolvido): string {
    const linhas = mov.ordered.map(
        ({ tag, value }) => `            <deep:${tag}>${escapeXml(value ?? "")}</deep:${tag}>`,
    );
    return ["         <deep:Movimento>", ...linhas, "         </deep:Movimento>"].join("\n");
}

export interface BuildEnvelopeParams {
    usuario: string;
    senha: string;
    movimentos: MovimentoResolvido[];
}

/** Constrói o envelope SOAP completo para um lote de movimentos. */
export function buildSoapEnvelope({ usuario, senha, movimentos }: BuildEnvelopeParams): string {
    const movimentosXml = movimentos.map(buildMovimentoXml).join("\n");

    return [
        `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:deep="http://deepxrtbrasil.com.br/">`,
        "   <soapenv:Header>",
        "      <deep:ValidationSoapHeader>",
        `         <deep:Usuario>${escapeXml(usuario)}</deep:Usuario>`,
        `         <deep:Senha>${escapeXml(senha)}</deep:Senha>`,
        "      </deep:ValidationSoapHeader>",
        "   </soapenv:Header>",
        "   <soapenv:Body>",
        "      <deep:EnviarListaMovimentoCaixaAssinc>",
        "         <deep:listaMovimentos>",
        movimentosXml,
        "         </deep:listaMovimentos>",
        "      </deep:EnviarListaMovimentoCaixaAssinc>",
        "   </soapenv:Body>",
        "</soapenv:Envelope>",
    ].join("\n");
}
