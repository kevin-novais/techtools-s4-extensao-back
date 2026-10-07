import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import uploadConfig from "@/config/upload";
import { GCSStorage } from "@/providers/gcs-storage";
import { BankPlusInventApi } from "@/cron/modules/bankplus-invent/http/BankPlusInventApi";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";

interface ConsultarBoletoBankPlusParams {
    vendasHeaderId: number;
}

interface ConsultarBoletoBankPlusResult {
    vendasHeaderId: number;
    documentoId: string;
    pathBoleto: string;
}

const DOCUMENTO_ID_PREFIX = "S4P";
const BOLETOS_GCS_SUBFOLDER = "boletos";

export class ConsultarBoletoBankPlusService {
    constructor(
        private readonly api: BankPlusInventApi = new BankPlusInventApi(),
        private readonly gcsStorage: GCSStorage = new GCSStorage(),
    ) {}

    async execute({ vendasHeaderId }: ConsultarBoletoBankPlusParams): Promise<ConsultarBoletoBankPlusResult> {
        if (!Number.isInteger(vendasHeaderId) || vendasHeaderId <= 0) {
            throw new AppError("vendasHeaderId inválido", 400);
        }

        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id: vendasHeaderId },
            select: {
                id: true,
                ciaIdSAP: true,
                ano: true,
                codigoDocumentoERP: true,
            },
        });

        if (!venda) throw new AppError("Venda não encontrada", 404);

        const cia = await s4DotzClient.cia.findFirst({
            where: {
                ciaIdSAP: String(venda.ciaIdSAP),
                deletadoEm: null,
            },
            select: { id: true, ciaIdSAP: true },
        });

        if (!cia) {
            throw new AppError(
                `CIA com ciaIdSAP ${venda.ciaIdSAP} não encontrada — necessária para montar a chave do boleto`,
                400,
            );
        }

        if (!venda.codigoDocumentoERP?.trim()) {
            throw new AppError("Venda sem codigoDocumentoERP — boleto só pode ser consultado após integração SAP", 400);
        }
        if (!venda.ano) {
            throw new AppError("Venda sem ano fiscal", 400);
        }

        const codigoDocumentoERP = venda.codigoDocumentoERP.trim();

        // reference_document_type e customer vêm do registro contábil real (dados vindos do SAP),
        // não de configuração — é a mesma chave que o BankPlus usa do lado dele.
        const registroContabil = await s4DotzClient.accountingDocumentItem.findFirst({
            where: {
                CompanyCode: cia.ciaIdSAP,
                FiscalYear: String(venda.ano),
                AccountingDocument: codigoDocumentoERP,
                Customer: { not: null },
            },
            select: { ReferenceDocumentType: true, Customer: true },
        });

        if (!registroContabil) {
            throw new AppError(
                `Registro contábil não encontrado para o documento ${codigoDocumentoERP} (CIA ${cia.ciaIdSAP}, ano ${venda.ano}) — necessário para montar a chave do boleto`,
                400,
            );
        }

        const documentoId = this.buildDocumentoId(
            {
                ciaIdSAP: cia.ciaIdSAP,
                ano: venda.ano,
                codigoDocumentoERP,
                referenceDocumentType: registroContabil.ReferenceDocumentType,
                customer: registroContabil.Customer,
            }
        );

        log.info(`[ConsultarBoletoBankPlus] Solicitando boleto | vendasHeaderId=${vendasHeaderId} documentoId=${documentoId}`);
        const pdfBuffer = await this.api.getBoletoPdf(documentoId);

        const pathBoleto = await this.salvarPdf(vendasHeaderId, venda.ano, pdfBuffer);

        await s4DotzClient.vendasHeader.update({
            where: { id: vendasHeaderId },
            data: {
                codigoBoleto: documentoId,
                pathBoleto,
                erroConsultaBoleto: null,
                retornoConsultaBoletoInvent: "Boleto obtido com sucesso",
                dataUltimaConsultaBoleto: new Date(),
                status: StatusVendas.ENVIANDO_EMAIL,
                atualizadoEm: new Date(),
            },
        });

        log.info(`[ConsultarBoletoBankPlus] Boleto salvo | vendasHeaderId=${vendasHeaderId} path=${pathBoleto}`);

        return { vendasHeaderId, documentoId, pathBoleto };
    }

    private buildDocumentoId(venda: {
        ciaIdSAP: string;
        ano: number;
        codigoDocumentoERP: string;
        referenceDocumentType: string | null;
        customer: string | null;
    }): string {
        const referenceDocumentType = venda.referenceDocumentType?.trim();
        const customer = venda.customer?.trim();

        if (!referenceDocumentType) {
            throw new AppError("Registro contábil sem reference_document_type", 400);
        }
        if (!customer) {
            throw new AppError("Registro contábil sem customer", 400);
        }

        // Exemplo: S4P#1410#2025#400000006#BKPFF#14100010
        // (S4P#CompanyCode#FiscalYear#AccountingDocument#ReferenceDocumentType#Customer)
        // Mesma chave montada a partir de registros_contabeis (dados reais do SAP).

        return [
            DOCUMENTO_ID_PREFIX,
            venda.ciaIdSAP,
            venda.ano,
            venda.codigoDocumentoERP,
            referenceDocumentType,
            customer,
        ].join("#");
    }

    private async salvarPdf(vendasHeaderId: number, ano: number, pdfBuffer: Buffer): Promise<string> {
        const tmpFolder = uploadConfig.TMP_FOLDER;

        if (!fs.existsSync(tmpFolder)) {
            fs.mkdirSync(tmpFolder, { recursive: true });
        }

        // Nome único por tentativa: reconsultas (manual ou pelo cron) não podem reusar o mesmo
        // blob — a service account só tem storage.objectCreator (sem delete), então sobrescrever
        // um objeto existente falha com "does not have storage.objects.delete access".
        const timestamp = Date.now();
        const hash = crypto.randomBytes(8).toString("hex");
        const filename = `boleto-${vendasHeaderId}-${ano}-${timestamp}-${hash}.pdf`;
        const tmpPath = path.join(tmpFolder, filename);

        fs.writeFileSync(tmpPath, pdfBuffer);

        const blobName = await this.gcsStorage.saveFile(filename, BOLETOS_GCS_SUBFOLDER);

        return this.gcsStorage.getPublicUrl(blobName);
    }
}
