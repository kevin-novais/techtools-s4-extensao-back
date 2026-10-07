import { Prisma } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasDetalheAccess } from "@/modules/vendas/utils/assertVendasDetalheAccess";
import { formatVendasDetalhe } from "@/modules/vendas/utils/formatVendasDetalhe";

export interface VendasDetalheUpdatePayload {
    itemDocumento?: number;
    codigoProdutoDotz?: string;
    centroLucro?: string | null;
    quantidadePontos?: number | null;
    valorVenda?: Prisma.Decimal | null;
    precoUnitario?: Prisma.Decimal | null;
    custoPontos?: Prisma.Decimal | null;
}

interface VendasDetalheUpdateServiceParams {
    vendasHeaderId: number;
    detalheId: number;
    data: VendasDetalheUpdatePayload;
    ciaIds: number[];
}

const hasValue = <T>(value: T | undefined): value is T => value !== undefined;

export class VendasDetalheUpdateService {
    async execute({
        vendasHeaderId,
        detalheId,
        data,
        ciaIds,
    }: VendasDetalheUpdateServiceParams) {
        await assertVendasDetalheAccess({
            vendasHeaderId,
            detalheId,
            ciaIds,
            requireEditavel: true,
        });

        const now = new Date();
        const updateData: Prisma.VendasDetalheUpdateInput = {
            atualizadoEm: now,
        };

        if (hasValue(data.itemDocumento)) {
            const conflito = await s4DotzClient.vendasDetalhe.findFirst({
                where: {
                    vendasHeaderId,
                    itemDocumento: data.itemDocumento,
                    id: { not: detalheId },
                },
                select: { id: true },
            });

            if (conflito) {
                throw new AppError(
                    `Já existe um detalhe com itemDocumento ${data.itemDocumento} nesta venda`,
                    409,
                );
            }

            updateData.itemDocumento = data.itemDocumento;
        }

        if (hasValue(data.codigoProdutoDotz)) {
            updateData.codigoProdutoDotz = data.codigoProdutoDotz;
        }

        if (hasValue(data.centroLucro)) {
            updateData.centroLucro = data.centroLucro;
        }

        if (hasValue(data.quantidadePontos)) {
            updateData.quantidadePontos = data.quantidadePontos;
        }

        if (hasValue(data.valorVenda)) {
            updateData.valorVenda = data.valorVenda;
        }

        if (hasValue(data.precoUnitario)) {
            updateData.precoUnitario = data.precoUnitario;
        }

        if (hasValue(data.custoPontos)) {
            updateData.custoPontos = data.custoPontos;
        }

        const detalheAtualizado = await s4DotzClient.vendasDetalhe.update({
            where: { id: detalheId },
            data: updateData,
        });

        return formatVendasDetalhe(detalheAtualizado);
    }
}
