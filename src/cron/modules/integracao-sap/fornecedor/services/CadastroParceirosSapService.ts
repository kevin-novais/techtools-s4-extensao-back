import apm from "@/apm";
import { Config } from "@/config/config";
import { BusinessPartnerIdentificationService } from "@/cron/modules/integracao-sap/fornecedor/services/BusinessPartnerIdentificationService";
import getDotzStageClient from "@/database/clients/dotzStageClient";
import { formatMillisecondsToHHMMSS, parseDateForFilter } from "@/util/date";
import log from "@/util/logger";
import { format, subDays } from "date-fns";

const MAX_CARD_CODE_LENGTH = 50; // Tamanho máximo do código do parceiro SAP
const MAX_CARD_NAME_LENGTH = 100; // Tamanho máximo do nome do parceiro SAP
const MAX_CNPJ_LENGTH = 20; // Tamanho máximo do CNPJ
const MAX_EMAIL_LENGTH = 200; // Tamanho máximo do email
const MAX_IE_LENGTH = 9; // Tamanho máximo da Inscrição Estadual
const MAX_ENDERECO_LENGTH = 200; // Tamanho máximo do endereço
const MAX_MUNICIPIO_LENGTH = 100; // Tamanho máximo do município
const MAX_CEP_LENGTH = 8; // Tamanho máximo do CEP
const MAX_FORMA_PAGAMENTO_LENGTH = 8; // Tamanho máximo da forma de pagamento
const MAX_TIPO_INDUSTRIA_LENGTH = 10; // Tamanho máximo do tipo de indústria
const MAX_DESCRICAO_INDUSTRIA_LENGTH = 100; // Tamanho máximo da descrição da indústria
const MAX_CODIGO_PAI_LENGTH = 100; // Tamanho máximo do código pai

const DAYS_TO_SYNC = Config.DAYS_TO_SYNC_SAP_PARTNERS;

type SyncPartner = {
    codigoSap: string;
    nome: string;
    codigoAnalyzer: string;
    ativo: boolean;
    cnpj: string;
    email: string;
    ie: string | null;
    endereco: string | null;
    municipio: string | null;
    cep: string | null;
    formaPagamento: string | null;
    tipoIndustria: string | null;
    descricaoIndustria: string | null;
    codigoPai: string | null;
};

type SyncMetrics = {
    inserted: number;
    updated: number;
    totalReceived: number;
};

export class CadastroParceirosSapService {
    private readonly businessPartnerService = new BusinessPartnerIdentificationService();

    async execute(): Promise<SyncMetrics> {
        const filterDate = this.buildFilterDate();
        const timeStart = performance.now();
        log.debug(`[CadastroParceirosSapService] Filter date: ${filterDate} Time start: ${timeStart}`);
        const partners = await this.businessPartnerService.execute({ data: filterDate });

        const metrics: SyncMetrics = {
            inserted: 0,
            updated: 0,
            totalReceived: partners.length,
        };

        if (!partners.length) {
            log.info(`[CadastroParceirosSapService] Nenhum parceiro identificado`);
            return metrics;
        }

        const client = getDotzStageClient();
        const validPartners: SyncPartner[] = [];

        for (const partner of partners) {
            log.debug(`[CadastroParceirosSapService] Normalizando o parceiro: ${JSON.stringify(partner)}`);
            const normalizedPartner = this.normalizePartner(partner);
            log.debug(`[CadastroParceirosSapService] Parceiro normalizado: ${JSON.stringify(normalizedPartner)}`);
            validPartners.push(normalizedPartner);
        }

        if (!validPartners.length) {
            log.info(`[CadastroParceirosSapService] Nenhum parceiro válido`);
            return metrics;
        }

        const existingRecords = await client.OCRD.findMany({
            where: {
                CardCode: {
                    in: validPartners.map((partner) => partner.codigoSap),
                },
            },
            select: {
                CardCode: true,
            },
        });

        const existingCodes = new Set<string>(existingRecords.map((record: { CardCode: string }) => record.CardCode));
        const now = new Date();

        for (const partner of validPartners) {
            if (existingCodes.has(partner.codigoSap)) {
                log.info(`[CadastroParceirosSapService] Atualizando parceiro no banco: ${partner.codigoSap}`);
                const updateSpan = apm.startSpan("DB OCRD.update");
                updateSpan?.addLabels({ card_code: partner.codigoSap, card_name: partner.nome });
                try {
                    await client.OCRD.update({
                        where: {
                            CardCode: partner.codigoSap,
                        },
                        data: {
                            CardName: partner.nome,
                            U_CODDOTZ: partner.codigoAnalyzer,
                            CODIGO_PAI: partner.codigoPai,
                            ativo: partner.ativo,
                            cnpj: partner.cnpj || null,
                            email: partner.email || null,
                            ie: partner.ie,
                            endereco: partner.endereco,
                            municipio: partner.municipio,
                            cep: partner.cep,
                            FORMA_PAGAMENTO: partner.formaPagamento,
                            TIPO_INDUSTRIA: partner.tipoIndustria,
                            DESCRICAO_INDUSTRIA: partner.descricaoIndustria,
                            UpdateDate: now,
                        },
                    });
                    log.info(`[CadastroParceirosSapService] Parceiro ${partner.codigoSap} atualizado no banco`);
                } finally {
                    updateSpan?.end();
                }

                metrics.updated += 1;
                continue;
            }

            log.info(`[CadastroParceirosSapService] Inserindo parceiro no banco: ${partner.codigoSap}`);
            const createSpan = apm.startSpan("DB OCRD.create");
            createSpan?.addLabels({ card_code: partner.codigoSap, card_name: partner.nome });
            try {
                await client.OCRD.create({
                    data: {
                        CardCode: partner.codigoSap,
                        CardName: partner.nome,
                        U_CODDOTZ: partner.codigoAnalyzer,
                        CODIGO_PAI: partner.codigoPai,
                        ativo: partner.ativo,
                        cnpj: partner.cnpj || null,
                        email: partner.email || null,
                        ie: partner.ie,
                        endereco: partner.endereco,
                        municipio: partner.municipio,
                        cep: partner.cep,
                        FORMA_PAGAMENTO: partner.formaPagamento,
                        TIPO_INDUSTRIA: partner.tipoIndustria,
                        DESCRICAO_INDUSTRIA: partner.descricaoIndustria,
                        CreateDate: now,
                        UpdateDate: now,
                    },
                });
                log.info(`[CadastroParceirosSapService] Parceiro ${partner.codigoSap} inserido no banco`);
            } finally {
                createSpan?.end();
            }

            metrics.inserted += 1;
        }

        const timeEnd = performance.now();
        log.info(`[CadastroParceirosSapService] Tempo de execução: ${formatMillisecondsToHHMMSS(timeEnd - timeStart)}`);

        return metrics;
    }

    private buildFilterDate(): string {
        const twoDaysAgo = subDays(new Date(), DAYS_TO_SYNC);
        const dateString = format(twoDaysAgo, "yyyy-MM-dd");
        const dateAtMidnightUTC = parseDateForFilter(dateString);
        return dateAtMidnightUTC.toISOString().split(".")[0];
    }

    private normalizePartner(partner: any): SyncPartner {
        const ie = (partner.ie?.trim() || "isento").slice(0, MAX_IE_LENGTH);

        let codigoAnalyzer = partner.codigoAnalyzer?.toString().trim();
        if (codigoAnalyzer && Number.isInteger(Number(codigoAnalyzer))) {
            codigoAnalyzer = Number(codigoAnalyzer);
        } else {
            codigoAnalyzer = null;
        }

        // A API retorna uma lista, mas hoje só vem 1 item por parceiro
        const industria = partner.industrias?.[0];

        return {
            codigoSap: (partner.codigoSap?.trim() ?? "").slice(0, MAX_CARD_CODE_LENGTH),
            nome: (partner.nome?.trim() ?? "").slice(0, MAX_CARD_NAME_LENGTH),
            codigoAnalyzer: codigoAnalyzer,
            ativo: partner.ativo ?? false,
            cnpj: (partner.cnpj?.trim() ?? "").slice(0, MAX_CNPJ_LENGTH),
            email: (partner.email?.trim() ?? "").slice(0, MAX_EMAIL_LENGTH),
            ie: ie,
            endereco: partner.endereco?.trim()?.slice(0, MAX_ENDERECO_LENGTH) ?? null,
            municipio: partner.municipio?.trim()?.slice(0, MAX_MUNICIPIO_LENGTH) ?? null,
            cep: partner.cep?.trim()?.slice(0, MAX_CEP_LENGTH) ?? null,
            formaPagamento: partner.formaPagamento?.trim()?.slice(0, MAX_FORMA_PAGAMENTO_LENGTH) ?? null,
            tipoIndustria: industria?.tipoIndustria?.trim()?.slice(0, MAX_TIPO_INDUSTRIA_LENGTH) ?? null,
            descricaoIndustria: industria?.descricaoIndustria?.trim()?.slice(0, MAX_DESCRICAO_INDUSTRIA_LENGTH) ?? null,
            codigoPai: partner.codigoPai?.trim()?.slice(0, MAX_CODIGO_PAI_LENGTH) || null,
        };
    }
}
