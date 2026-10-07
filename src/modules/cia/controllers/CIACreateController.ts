import { Request, Response } from "express";
import z from "zod";
import { CIACreateService } from "@/modules/cia/services/CIACreateService";

const ciaCreateSchema = z.object({
    nome: z.string().min(1, { message: "Nome é obrigatório" }),
    ciaIdSAP: z.string().max(100, { message: "ciaIdSAP deve ter no máximo 100 caracteres" }).optional(),
    nomeBaseDadosB1: z.string().max(128, { message: "nomeBaseDadosB1 deve ter no máximo 128 caracteres" }).optional(),
    ie: z.string().max(9, { message: "IE deve ter no máximo 9 caracteres" }).optional(),
    endereco: z.string().max(200, { message: "Endereço deve ter no máximo 200 caracteres" }).optional(),
    municipio: z.string().max(100, { message: "Município deve ter no máximo 100 caracteres" }).optional(),
    uf: z.string().length(2, { message: "UF deve ter 2 caracteres" }).transform(value => value.toUpperCase()).optional(),
    cep: z.string().max(8, { message: "CEP deve ter no máximo 8 dígitos" }).optional(),
    bairro: z.string().max(100, { message: "Bairro deve ter no máximo 100 caracteres" }).optional(),
    cpfCnpj: z.string().optional().refine(
        value => {
            if (!value) return true;
            const digits = value.replace(/\D/g, "");
            return digits.length === 11 || digits.length === 14;
        },
        { message: "CPF/CNPJ inválido" },
    ),
    telefone: z
        .string()
        .optional()
        .refine(value => {
            if (!value) return true;
            return /^\+\d{10,15}$/.test(value);
        }, { message: "Telefone deve estar no formato E.164 (+5511999999999)" }),
});

export class CIACreateController {
    async handle(req: Request, res: Response) {
        const {
            nome,
            ciaIdSAP,
            nomeBaseDadosB1,
            ie,
            endereco,
            municipio,
            uf,
            cep,
            bairro,
            cpfCnpj,
            telefone,
        } = ciaCreateSchema.parse(req.body);

        const atualizadoPor = req.user?.id!;

        const ciaCreateService = new CIACreateService();

        const cia = await ciaCreateService.execute({
            nome,
            ciaIdSAP,
            nomeBaseDadosB1,
            ie,
            endereco,
            municipio,
            uf,
            cep,
            bairro,
            cpfCnpj,
            telefone,
            atualizadoPor,
        });

        return res.status(200).json({
            message: "Cia criada com sucesso",
            cia,
        });
    }
}