import { describe, expect, it } from "vitest";
import { parseMovimento } from "@/cron/modules/xtpg-saida/soap/XtpgSaidaSoapClient";

/**
 * A conta contábil (GLAccount) que todos os de-paras e a agregação do LCM usam
 * deve vir COMPLETA de FlexField12; a tag <ContaContabil> traz só os 4 últimos
 * dígitos (ambíguos) e serve apenas de fallback/rastreio.
 */
describe("parseMovimento — conta contábil completa (FlexField12)", () => {
    const bloco = (contaCurta: string, flex12: string) =>
        `<Contabil>` +
        `<MvtContador>4631</MvtContador>` +
        `<PfjCodigo>0401</PfjCodigo>` +
        `<ContaContabil>${contaCurta}</ContaContabil>` +
        `<CreditoDebito>D</CreditoDebito>` +
        `<Valor>41696.82</Valor>` +
        `<Lote>040120260817105531</Lote>` +
        `<ParContabil>4032</ParContabil>` +
        (flex12 === "" ? `<FlexField12 />` : `<FlexField12>${flex12}</FlexField12>`) +
        `</Contabil>`;

    it("usa FlexField12 como conta completa e guarda o dígito curto em extras", () => {
        const mov = parseMovimento(bloco("0061", "22510061"));
        expect(mov.contaContabil).toBe("22510061");
        expect(mov.extras.ContaContabilCurta).toBe("0061");
    });

    it("faz fallback para <ContaContabil> quando FlexField12 vem vazio", () => {
        const mov = parseMovimento(bloco("0061", ""));
        expect(mov.contaContabil).toBe("0061");
        expect(mov.extras.ContaContabilCurta).toBe("0061");
    });
});
