import * as XLSX from "xlsx";
import fs from "node:fs";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { GCSStorage } from "@/providers/gcs-storage";
import type { RomaneioRow, ErrorWithCode } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";

export class PlanilhaReaderService {
    private readonly gcsStorage = new GCSStorage();

    async execute(romaneioUrl: string): Promise<RomaneioRow[]> {
        const filePath = await this.gcsStorage.downloadToTmp(romaneioUrl);

        log.info(`[PlanilhaReaderService] Lendo planilha: ${filePath}`);

        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.readFile(filePath);
        } catch (error) {
            log.error("[PlanilhaReaderService] Erro ao ler arquivo XLSX: %o", error);
            await fs.promises.unlink(filePath).catch(() => {});
            throw new AppError("Erro ao ler arquivo XLSX", 400);
        }

        await fs.promises.unlink(filePath).catch(() => {});

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new AppError("Arquivo XLSX não contém planilhas", 400);

        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
            raw: true,
            defval: undefined,
        });

        const data = rawData.map((row) => {
            const normalizedRow: any = {};
            for (const key in row) {
                normalizedRow[key.trim()] = row[key];
            }
            return normalizedRow as RomaneioRow;
        });

        log.info(`[PlanilhaReaderService] Total de linhas lidas: ${data.length}`);
        return data;
    }

    /**
     * Extrai lista de pedidos únicos da planilha
     * Usado para otimizar busca no Analyzer (busca todos de uma vez)
     * 
     * @param rows - Linhas do romaneio
     * @returns Array de números de pedidos únicos
     */
    extrairPedidosUnicos(rows: RomaneioRow[]): number[] {
        const pedidosSet = new Set<number>();

        for (const row of rows) {
            const pedido = Number(row.PEDIDO_PARCEIRO);
            if (!Number.isNaN(pedido)) {
                pedidosSet.add(pedido);
            }
        }

        const pedidos = Array.from(pedidosSet);
        log.info(`[PlanilhaReaderService] Pedidos únicos encontrados: ${pedidos.length}`);
        return pedidos;
    }

    /**
     * Valida se há pedidos duplicados no romaneio
     * 
     * REGRA DE NEGÓCIO:
     * Um mesmo PEDIDO_PARCEIRO não deve aparecer mais de uma vez no romaneio
     * 
     * @param rows - Linhas do romaneio
     * @returns Array de erros com código encontrados
     */
    validarDuplicacoes(rows: RomaneioRow[]): ErrorWithCode[] {
        const divergencias: ErrorWithCode[] = [];
        const pedidosContador = new Map<number, number>();

        // Conta ocorrências de cada pedido
        for (const row of rows) {
            const pedido = Number(row.PEDIDO_PARCEIRO);
            if (!Number.isNaN(pedido)) {
                pedidosContador.set(pedido, (pedidosContador.get(pedido) || 0) + 1);
            }
        }

        // Identifica pedidos duplicados
        for (const [pedido, count] of pedidosContador.entries()) {
            if (count > 1) {
                divergencias.push({
                    code: "02",
                    message: `Pedido '${pedido}' está duplicado no romaneio (${count} ocorrências)`,
                });
            }
        }

        if (divergencias.length > 0) {
            log.warn(`[PlanilhaReaderService] ${divergencias.length} pedidos duplicados encontrados`);
        } else {
            log.info(`[PlanilhaReaderService] Nenhum pedido duplicado encontrado`);
        }

        return divergencias;
    }
}

