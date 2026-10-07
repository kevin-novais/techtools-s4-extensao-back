import { Request, Response } from "express";
import { z } from "zod";
import AppError from "@/util/AppError";
import { parseDateForFilter, parseDateForFilterEnd } from "@/util/date";
import { AccountfyRegistrosContabeisWebhookService } from "@/modules/webhooks/accountfy/services/AccountfyRegistrosContabeisWebhookService";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const accountfyWebhookQuerySchema = z.object({
    DATA_INICIAL: dateSchema.optional(),
    DATA_FINAL: dateSchema.optional(),
    COD_EMPRESA: z.union([z.string(), z.array(z.string())]).optional(),
    PAGINA: z.coerce.number().int().positive().optional().default(1),
    TAMANHO: z.coerce.number().int().positive().max(1000).optional().default(100),
});

function parseCodEmpresa(value: string | string[] | undefined): string[] {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        const parsedCompanies = value
            .flatMap((company) => company.split(","))
            .map((company) => company.trim())
            .filter((company) => company.length > 0);

        return [...new Set(parsedCompanies)];
    }

    const parsedCompanies = value
        .split(",")
        .map((company) => company.trim())
        .filter((company) => company.length > 0);

    return [...new Set(parsedCompanies)];
}

export class AccountfyRegistrosContabeisWebhookController {
    async handle(req: Request, res: Response) {
        const query = accountfyWebhookQuerySchema.parse(req.query);

        if (!query.DATA_INICIAL) {
            throw new AppError("DATA_INICIAL é obrigatório", 400);
        }

        if (!query.DATA_FINAL) {
            throw new AppError("DATA_FINAL é obrigatório", 400);
        }

        const dataInicial = parseDateForFilter(query.DATA_INICIAL);
        const dataFinal = parseDateForFilterEnd(query.DATA_FINAL);

        if (dataInicial > dataFinal) {
            throw new AppError("DATA_INICIAL não pode ser maior que DATA_FINAL", 400);
        }

        const codEmpresa = parseCodEmpresa(query.COD_EMPRESA);

        const accountfyWebhookService = new AccountfyRegistrosContabeisWebhookService();
        const response = await accountfyWebhookService.execute({
            dataInicial,
            dataFinal,
            codEmpresa,
            pagina: query.PAGINA,
            tamanho: query.TAMANHO,
        });

        return res.status(200).json(response);
    }
}
