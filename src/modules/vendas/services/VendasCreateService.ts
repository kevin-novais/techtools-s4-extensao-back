import { Prisma } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { assertCiaIdUsuarioAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { validateVendasDatas } from "@/modules/vendas/utils/validateVendasDatas";
import { VendasShowService } from "@/modules/vendas/services/VendasShowService";
import {
    VendasAnexos,
    VendasAnexosStorageService,
} from "@/modules/vendas/services/VendasAnexosStorageService";

export interface VendasCreatePayload {
    ciaId: number;
    codigoClienteAnalyzer: string;
    cnpjCliente: string;
    codigoClienteSAP?: string;
    numeroDocumentoAnalyzer: string;
    infoReferenciaAnalyzer?: string;
    valorTotalVendas?: Prisma.Decimal;
    dataEmissao: Date;
    dataLancamentoContabil: Date;
    dataVencimento?: Date;
}

interface VendasCreateServiceParams {
    data: VendasCreatePayload;
    anexos?: VendasAnexos;
    ciaIds: number[];
}

export class VendasCreateService {
    constructor(
        private readonly anexosStorageService = new VendasAnexosStorageService(),
    ) {}

    async execute({ data, anexos, ciaIds }: VendasCreateServiceParams) {
        const cia = await assertCiaIdUsuarioAccess(data.ciaId, ciaIds);

        validateVendasDatas(
            data.dataEmissao,
            data.dataLancamentoContabil,
            data.dataVencimento,
        );

        const now = new Date();
        const ano = data.dataEmissao.getUTCFullYear();

        const venda = await s4DotzClient.vendasHeader.create({
            data: {
                ciaIdSAP: cia.ciaIdSAP,
                status: StatusVendas.CADASTRO,
                tipoCadastro: "MANUAL",
                tipoProcesso: TipoProcesso.DR,
                ano,
                codigoClienteAnalyzer: data.codigoClienteAnalyzer,
                cnpjCliente: data.cnpjCliente,
                codigoClienteSAP: data.codigoClienteSAP ?? null,
                numeroDocumentoAnalyzer: data.numeroDocumentoAnalyzer,
                infoReferenciaAnalyzer: data.infoReferenciaAnalyzer ?? null,
                valorTotalVendas: data.valorTotalVendas ?? null,
                pathArquivoFaturaDetalhadaAnalyzer: null,
                pathArquivoRelatorioAnalitico: null,
                dataEmissao: data.dataEmissao,
                dataLancamentoContabil: data.dataLancamentoContabil,
                dataVencimento: data.dataVencimento ?? null,
                criadoEm: now,
                atualizadoEm: now,
            },
        });

        let uploadResult;
        try {
            uploadResult = await this.anexosStorageService.upload(
                venda.id,
                anexos,
            );
        } catch (error) {
            await Promise.allSettled([
                s4DotzClient.vendasHeader.delete({ where: { id: venda.id } }),
            ]);
            throw error;
        }

        if (Object.keys(uploadResult.paths).length > 0) {
            try {
                await s4DotzClient.vendasHeader.update({
                    where: { id: venda.id },
                    data: uploadResult.paths,
                });
            } catch (error) {
                await this.anexosStorageService.cleanupStoredFiles(
                    venda.id,
                    uploadResult.storedFilenames,
                );
                await s4DotzClient.vendasHeader.delete({
                    where: { id: venda.id },
                });
                throw error;
            }
        }

        return new VendasShowService().execute(venda.id, ciaIds);
    }
}
