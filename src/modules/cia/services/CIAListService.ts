import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { formatCpfCnpj } from "@/util/formatters/documentFormatter";
import { normalizarTelefone } from "@/util/formatters/phoneNumberFormatter";

interface CiaRecord {
    id: number;
    nome: string;
    ciaIdSAP: string | null;
    nomeBaseDadosB1: string | null;
    ie: string | null;
    endereco: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
    bairro: string | null;
    cpfCnpj: string | null;
    telefone: string | null;
    atualizadoPor: number;
    atualizadoEm: Date;
    deletadoEm: Date | null;
}

interface CIAListParams {
    page?: number;
    limit?: number;
    search?: string;
    includeDeleted?: boolean;
}

interface CIAListResponse {
    cias: Array<{
        id: number;
        nome: string;
        ciaIdSAP: string | null;
        nomeBaseDadosB1: string | null;
        ie: string | null;
        endereco: string | null;
        municipio: string | null;
        uf: string | null;
        cep: string | null;
        bairro: string | null;
        cpfCnpj: string | null;
        telefone: string | null;
        atualizadoPor: number;
        atualizadoEm: string;
        deletadoEm: string | null;
    }>;
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export class CIAListService {
    async execute(params: CIAListParams = {}): Promise<CIAListResponse> {
        const {
            page = 1,
            limit = 10,
            search,
            includeDeleted = false,
        } = params;

        const searchTrimmed = search?.trim();
        const isNumericSearch = searchTrimmed && !isNaN(Number(searchTrimmed));

        const where = {
            ...(searchTrimmed
                ? {
                    OR: [
                        ...(isNumericSearch
                            ? [{ id: Number(searchTrimmed) }]
                            : []),
                        {
                            nome: {
                                contains: searchTrimmed,
                            },
                        },
                    ],
                }
                : {}),
            ...(includeDeleted ? {} : { deletadoEm: null }),
        };

        const skip = (page - 1) * limit;

        const [totalItems, cias] = await Promise.all([
            s4DotzClient.cia.count({ where }),
            s4DotzClient.cia.findMany({
                where,
                select: {
                    id: true,
                    nome: true,
                    ciaIdSAP: true,
                    nomeBaseDadosB1: true,
                    ie: true,
                    endereco: true,
                    municipio: true,
                    uf: true,
                    cep: true,
                    bairro: true,
                    cpfCnpj: true,
                    telefone: true,
                    atualizadoPor: true,
                    atualizadoEm: true,
                    deletadoEm: true,
                },
                orderBy: {
                    id: 'asc',
                },
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        const formattedCias = cias.map((cia: CiaRecord) => {
            const telefoneFormatado = cia.telefone
                ? normalizarTelefone(`+${cia.telefone}`).e164
                : null;

            return {
                id: cia.id,
                nome: cia.nome,
                ciaIdSAP: cia.ciaIdSAP,
                nomeBaseDadosB1: cia.nomeBaseDadosB1,
                ie: cia.ie,
                endereco: cia.endereco,
                municipio: cia.municipio,
                uf: cia.uf,
                cep: cia.cep,
                bairro: cia.bairro,
                cpfCnpj: cia.cpfCnpj ? formatCpfCnpj(cia.cpfCnpj) : null,
                telefone: telefoneFormatado,
                atualizadoPor: cia.atualizadoPor,
                atualizadoEm: formatDateToBrazilianTimezone(cia.atualizadoEm),
                deletadoEm: cia.deletadoEm ? formatDateToBrazilianTimezone(cia.deletadoEm) : null,
            };
        });

        return {
            cias: formattedCias,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}

