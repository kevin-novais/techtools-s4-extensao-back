import { Request, Response } from "express";
import * as XLSX from "xlsx";
import { CONTAS_CONTABEIS_XLSX_COLUMNS } from "@/modules/contas-contabeis/utils/validateContasContabeisXlsxColumns";

export class ContasContabeisImportTemplateController {
    handle(_req: Request, res: Response) {
        const rows = [CONTAS_CONTABEIS_XLSX_COLUMNS as unknown as string[]];
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Contas Contábeis");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="contas-contabeis-import-template.xlsx"'
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        return res.send(buffer);
    }
}
