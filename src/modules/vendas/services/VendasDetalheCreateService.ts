import { Prisma } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { formatVendasDetalhe } from "@/modules/vendas/utils/formatVendasDetalhe";

export interface VendasDetalheCreatePayload {
    itemDocumento?: number;
    codigoProdutoDotz: string;
    centroLucro?: string;
    quantidadePontos?: number;
    valorVenda?: Prisma.Decimal;
    precoUnitario?: Prisma.Decimal;
    custoPontos?: Prisma.Decimal;
}

interface VendasDetalheCreateServiceParams {
    vendasHeaderId: number;
    data: VendasDetalheCreatePayload;
    ciaIds: number[];
}

export class VendasDetalheCreateService {
    async execute({ vendasHeaderId, data, ciaIds }: VendasDetalheCreateServiceParams) {
        await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds, {
            requireEditavel: true,
        });

        const itemDocumento = await this.resolveItemDocumento(
            vendasHeaderId,
            data.itemDocumento,
        );

        const detalheExistente = await s4DotzClient.vendasDetalhe.findFirst({
            where: {
                vendasHeaderId,
                itemDocumento,
            },
        });

        if (detalheExistente) {
            throw new AppError(
                `Já existe um detalhe com itemDocumento ${itemDocumento} nesta venda`,
                409,
            );
        }

        const now = new Date();

        const detalhe = await s4DotzClient.vendasDetalhe.create({
            data: {
                vendasHeaderId,
                itemDocumento,
                codigoProdutoDotz: data.codigoProdutoDotz,
                centroLucro: data.centroLucro ?? null,
                quantidadePontos: data.quantidadePontos ?? null,
                valorVenda: data.valorVenda ?? null,
                precoUnitario: data.precoUnitario ?? null,
                custoPontos: data.custoPontos ?? null,
                criadoEm: now,
                atualizadoEm: now,
            },
        });

        return formatVendasDetalhe(detalhe);
    }

    private async resolveItemDocumento(
        vendasHeaderId: number,
        itemDocumentoInformado?: number,
    ): Promise<number> {
        if (itemDocumentoInformado != null) {
            if (itemDocumentoInformado < 1) {
                throw new AppError("itemDocumento deve ser maior que zero", 400);
            }

            return itemDocumentoInformado;
        }

        const ultimoDetalhe = await s4DotzClient.vendasDetalhe.findFirst({
            where: { vendasHeaderId },
            orderBy: { itemDocumento: "desc" },
            select: { itemDocumento: true },
        });

        const ultimoItem = ultimoDetalhe?.itemDocumento ?? 0;

        return ultimoItem + 1;
    }
}
