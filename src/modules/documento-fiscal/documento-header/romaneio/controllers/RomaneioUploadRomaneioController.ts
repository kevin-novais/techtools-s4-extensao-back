import { Request, Response } from "express";
import { z } from "zod";
import AppError from "@/util/AppError";

import { parseDateAsBrazilian } from "@/util/date";
import { RomaneioUploadRomaneioService } from "@/modules/documento-fiscal/documento-header/romaneio/services/RomaneioUploadRomaneioService";

const romaneioUploadRomaneioSchema = z.object({
    ciaId: z.string().transform((val) => {
        const num = Number(val);
        if (Number.isNaN(num)) {
            throw new AppError("ciaId deve ser um número válido", 400);
        }
        return num;
    }),
    dataEmissao: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Data de emissão inválida",
    }),
    dataLancamentoContabil: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Data de lançamento contábil inválida",
    }),
    dataVencimento: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Data de vencimento inválida",
    }),
});

export class RomaneioUploadRomaneioController {
    handle = async (req: Request, res: Response) => {
        if (!req.file) {
            throw new AppError("Arquivo não enviado", 400);
        }

        const data = romaneioUploadRomaneioSchema.parse(req.body);
        const usuarioId = req.user?.id!;
        const filename = req.file.filename;

        const romaneioUploadRomaneioService = new RomaneioUploadRomaneioService();
        const { criados, barrados } = await romaneioUploadRomaneioService.execute({
            ciaId: data.ciaId,
            dataEmissao: parseDateAsBrazilian(data.dataEmissao),
            dataLancamentoContabil: parseDateAsBrazilian(data.dataLancamentoContabil),
            dataVencimento: parseDateAsBrazilian(data.dataVencimento),
            filename,
            nomeRomaneio: req.file.originalname,
            usuarioId,
        });

        return res.status(201).json({
            message: this.montarMensagem(criados.length, barrados),
            documentos: criados,
            barrados,
            // Mantido por compatibilidade: primeiro documento criado
            documento: criados[0],
        });
    };

    private montarMensagem(totalCriados: number, barrados: { motivo: string }[]) {
        const documentos = totalCriados === 1 ? "documento" : "documentos";
        const base = `Romaneio enviado com sucesso: ${totalCriados} ${documentos} criado(s)`;

        if (barrados.length === 0) {
            return base;
        }

        return `${base}. ${barrados.length} documento(s) não importado(s): ${barrados
            .map((b) => b.motivo)
            .join("; ")}`;
    }
}

