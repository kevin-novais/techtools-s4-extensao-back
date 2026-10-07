import s4DotzClient from "@/database/clients/s4DotzClient";
import { formatDateOnly, normalizeDateToMidnightUTC } from "@/util/date";

interface GrupoInfo {
    id: number;
    nome: string;
    dataInicio: string;
    dataFim: string;
    periodoAberto: boolean;
    aprovaDivergencia: boolean;
}

interface CiaInfo {
    id: number;
    nome: string;
    ciaIdSAP: string | null;
    nomeBaseDadosB1: string | null;
    grupos: GrupoInfo[];
}

interface CIAListUserAccessResponse {
    cias: CiaInfo[];
}

export class CIAListUserAccessService {
    async execute(usuarioId: number): Promise<CIAListUserAccessResponse> {
        const gruposUsuario = await s4DotzClient.usuarioGrupoUsuario.findMany({
            where: {
                usuarioId,
                grupoUsuario: {
                    deletadoEm: null,
                },
            },
            include: {
                grupoUsuario: {
                    include: {
                        cia: true,
                    },
                },
            },
        });

        const ciasMap = new Map<number, CiaInfo>();
        const dataAtual = normalizeDateToMidnightUTC(new Date());

        for (const rel of gruposUsuario) {
            const { grupoUsuario } = rel;
            const { cia } = grupoUsuario;

            if (!ciasMap.has(cia.id)) {
                ciasMap.set(cia.id, {
                    id: cia.id,
                    nome: cia.nome,
                    ciaIdSAP: cia.ciaIdSAP,
                    nomeBaseDadosB1: cia.nomeBaseDadosB1,
                    grupos: [],
                });
            }

            const dataInicioNormalizada = normalizeDateToMidnightUTC(grupoUsuario.dataInicio);
            const dataFimNormalizada = normalizeDateToMidnightUTC(grupoUsuario.dataFim);
            const periodoAberto =
                dataAtual >= dataInicioNormalizada && dataAtual <= dataFimNormalizada;

            ciasMap.get(cia.id)!.grupos.push({
                id: grupoUsuario.id,
                nome: grupoUsuario.nome,
                dataInicio: formatDateOnly(grupoUsuario.dataInicio),
                dataFim: formatDateOnly(grupoUsuario.dataFim),
                periodoAberto,
                aprovaDivergencia: grupoUsuario.aprovaDivergencia,
            });
        }

        const cias = Array.from(ciasMap.values());

        return { cias };
    }
}

