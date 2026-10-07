import { Request, Response } from "express";
import AppError from "@/util/AppError";
import { ContasContabeisImportService } from "@/modules/contas-contabeis/services/ContasContabeisImportService";

export class ContasContabeisImportController {
    async handle(req: Request, res: Response) {
        if (!req.file) {
            throw new AppError("Arquivo não enviado", 400);
        }

        const importService = new ContasContabeisImportService();
        const result = await importService.execute({
            filename: req.file.filename,
        });

        const status = result.success ? 200 : 400;
        return res.status(status).json({
            message: result.success
                ? `Importação concluída: ${result.created} criadas, ${result.skipped} ignoradas (duplicatas)`
                : "Erros de validação na planilha",
            ...result,
        });
    }
}
