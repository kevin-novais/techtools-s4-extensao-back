import { z } from 'zod';
import { RELATORIO_VARIAVEL_TIPOS } from '@/modules/relatorio/utils/relatorioVariableTypes';

export const relatorioVariavelSchema = z.object({
    chave: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,49}$/, 'Chave de variável inválida'),
    label: z.string().trim().min(1).max(100),
    tipo: z.enum(RELATORIO_VARIAVEL_TIPOS),
    obrigatorio: z.boolean().default(true),
    fusoHorarioBrasil: z.boolean().default(false),
    ordem: z.number().int().nonnegative().default(0),
});

export const relatorioGrupoSchema = z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

/** Update: null or empty string clears the stored value */
export const relatorioGrupoUpdateSchema = z
    .union([z.string().trim().max(100), z.null()])
    .optional()
    .transform((v): string | null | undefined => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        return v === '' ? null : v;
    });

export const relatorioDescricaoUpdateSchema = z
    .union([z.string().trim().max(500), z.null()])
    .optional()
    .transform((v): string | null | undefined => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        return v === '' ? null : v;
    });

export const reportVariablesSchema = z
    .record(z.union([z.string(), z.number()]))
    .optional()
    .default({});
