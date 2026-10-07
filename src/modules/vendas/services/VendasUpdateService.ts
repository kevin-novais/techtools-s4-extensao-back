import { Prisma } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { validateVendasDatas } from "@/modules/vendas/utils/validateVendasDatas";
import { VendasShowService } from "@/modules/vendas/services/VendasShowService";
import { VENDAS_UPDATE_LOAD_SELECT } from "@/modules/vendas/utils/vendasHeaderSelect";
import {
    VendasAnexos,
    VendasAnexosStorageService,
} from "@/modules/vendas/services/VendasAnexosStorageService";

export interface VendasUpdatePayload {
    codigoClienteAnalyzer?: string | null;
    codigoClienteSAP?: string | null;
    numeroDocumentoAnalyzer?: string | null;
    infoReferenciaAnalyzer?: string | null;
    valorTotalVendas?: Prisma.Decimal | null;
    dataEmissao?: Date;
    dataLancamentoContabil?: Date;
    dataVencimento?: Date;
}

interface VendasUpdateServiceParams {
    id: number;
    data: VendasUpdatePayload;
    anexos?: VendasAnexos;
    ciaIds: number[];
}

const hasValue = <T>(value: T | undefined): value is T => value !== undefined;

export class VendasUpdateService {
    constructor(
        private readonly anexosStorageService = new VendasAnexosStorageService(),
    ) {}

    async execute({ id, data, anexos, ciaIds }: VendasUpdateServiceParams) {
        await assertVendasHeaderCiaAccess(id, ciaIds, { requireEditavel: true });

        const vendaAtual = await s4DotzClient.vendasHeader.findUnique({
            where: { id },
            select: VENDAS_UPDATE_LOAD_SELECT,
        });

        if (!vendaAtual) {
            throw new AppError("Venda não encontrada", 404);
        }

        const dataEmissao = hasValue(data.dataEmissao)
            ? data.dataEmissao
            : vendaAtual.dataEmissao;
        const dataLancamentoContabil = hasValue(data.dataLancamentoContabil)
            ? data.dataLancamentoContabil
            : vendaAtual.dataLancamentoContabil;
        const dataVencimento = hasValue(data.dataVencimento)
            ? data.dataVencimento
            : vendaAtual.dataVencimento;

        if (!dataEmissao || !dataLancamentoContabil || !dataVencimento) {
            throw new AppError(
                "Datas de emissão, lançamento contábil e vencimento são obrigatórias",
                400,
            );
        }

        validateVendasDatas(dataEmissao, dataLancamentoContabil, dataVencimento);

        const now = new Date();
        const updateData: Prisma.VendasHeaderUpdateInput = {
            atualizadoEm: now,
        };

        const uploadResult = await this.anexosStorageService.upload(id, anexos);
        Object.assign(updateData, uploadResult.paths);

        if (hasValue(data.codigoClienteAnalyzer)) {
            updateData.codigoClienteAnalyzer = data.codigoClienteAnalyzer;
        }

        if (hasValue(data.codigoClienteSAP)) {
            updateData.codigoClienteSAP = data.codigoClienteSAP;
        }

        if (hasValue(data.numeroDocumentoAnalyzer)) {
            updateData.numeroDocumentoAnalyzer = data.numeroDocumentoAnalyzer;
        }

        if (hasValue(data.infoReferenciaAnalyzer)) {
            updateData.infoReferenciaAnalyzer = data.infoReferenciaAnalyzer;
        }

        if (hasValue(data.valorTotalVendas)) {
            updateData.valorTotalVendas = data.valorTotalVendas;
        }

        if (hasValue(data.dataEmissao)) {
            updateData.dataEmissao = data.dataEmissao;
        }

        if (hasValue(data.dataLancamentoContabil)) {
            updateData.dataLancamentoContabil = data.dataLancamentoContabil;
        }

        if (hasValue(data.dataVencimento)) {
            updateData.dataVencimento = data.dataVencimento;
        }

        await s4DotzClient.vendasHeader.update({
            where: { id },
            data: updateData,
        });

        return new VendasShowService().execute(id, ciaIds);
    }
}
