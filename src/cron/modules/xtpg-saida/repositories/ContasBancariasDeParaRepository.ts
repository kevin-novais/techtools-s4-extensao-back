/**
 * De-para de Conta Bancária para a Saída XTPG.
 *
 * Resolve `HouseBank` + `HouseBankAccount` (códigos SAP) a partir do movimento,
 * por uma de duas formas (consultora, DTZ-227):
 *   - Modo 1 (por conta contábil): CONTA_CONTABIL -> GLAccount (+ CodigoCia).
 *   - Modo 2 (por dados do banco): BAN/AGE/CNT_CODIGO -> NumeroBanco/NumeroAgencia/NumeroConta (+ CodigoCia).
 *
 * Definido pela equipe (11/06): a ordem entre os modos é indiferente; quando
 * NENHUM casar, o PAR_CONTABIL inteiro é travado (Header status_sap=ERRO com a
 * descrição na tabela) – tratamento feito no ProcessarSaidaXtpgService.
 */
import s4DotzClient from "@/database/clients/s4DotzClient";

export interface HouseBankRef {
    houseBank: string;
    houseBankAccount: string;
}

export class ContasBancariasDeParaRepository {
    /** Modo 1 – por conta contábil (GLAccount). */
    async resolverPorContaContabil(params: {
        codigoCia: string;
        contaContabil: string;
    }): Promise<HouseBankRef | null> {
        if (!params.codigoCia || !params.contaContabil) return null;

        const conta = await s4DotzClient.contasBancarias.findFirst({
            where: { CodigoCia: params.codigoCia, GLAccount: params.contaContabil },
            select: { HouseBank: true, HouseBankAccount: true },
        });

        return conta ? { houseBank: conta.HouseBank, houseBankAccount: conta.HouseBankAccount } : null;
    }

    /** Modo 2 – por dados do banco (Banco/Agência/Conta de origem). */
    async resolverPorDadosBanco(params: {
        codigoCia: string;
        banCodigo: string;
        ageCodigo: string;
        cntCodigo: string;
    }): Promise<HouseBankRef | null> {
        if (!params.codigoCia || !params.banCodigo) return null;

        const conta = await s4DotzClient.contasBancarias.findFirst({
            where: {
                CodigoCia: params.codigoCia,
                NumeroBanco: params.banCodigo,
                NumeroAgencia: params.ageCodigo,
                NumeroConta: params.cntCodigo,
            },
            select: { HouseBank: true, HouseBankAccount: true },
        });

        return conta ? { houseBank: conta.HouseBank, houseBankAccount: conta.HouseBankAccount } : null;
    }

    /**
     * Resolve tentando Modo 1 (conta contábil) e, se não casar, Modo 2 (dados do banco).
     * (Ordem indiferente, definido pela equipe – sem correspondência => trava o PAR_CONTABIL.)
     */
    async resolver(params: {
        codigoCia: string;
        contaContabil: string;
        banCodigo: string;
        ageCodigo: string;
        cntCodigo: string;
    }): Promise<HouseBankRef | null> {
        const porConta = await this.resolverPorContaContabil(params);
        if (porConta) return porConta;
        return this.resolverPorDadosBanco(params);
    }
}
