import AppError from '@/util/AppError';
import { Config } from '@/config/config';

const FORBIDDEN_OPERATIONS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXECUTE|XP_|SP_)\b/i;

export function validateQuery(query: string): void {
    const normalized = query.trim();

    if (!normalized.toUpperCase().startsWith('SELECT')) {
        throw new AppError('Query inválida: deve começar com SELECT', 400);
    }

    if (normalized.includes(';')) {
        throw new AppError('Query inválida: múltiplas instruções não são permitidas', 400);
    }

    if (FORBIDDEN_OPERATIONS.test(normalized)) {
        throw new AppError('Query inválida: operação não permitida', 400);
    }

    validateTableReferences(normalized);
}

function stripVariablePlaceholders(query: string): string {
    return query.replaceAll(/\{\{[a-zA-Z_][a-zA-Z0-9_]{0,49}\}\}/g, 'NULL');
}

function validateTableReferences(query: string): void {
    const queryForValidation = stripVariablePlaceholders(query);

    // Captura o token imediatamente após FROM ou JOIN, ignorando subqueries (que começam com '(')
    const pattern = /\b(?:FROM|JOIN)\s+(?!\s*[(])([^\s,()]+)/gi;

    const allowed = Config.RELATORIO_ALLOWED_DATABASES;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(queryForValidation)) !== null) {
        const token = match[1];

        // Remove brackets e divide nas partes: banco.schema.tabela
        const parts = token
            .split('.')
            .map((p) => p.replaceAll(/^\[|\]$/g, '').trim())
            .filter((p) => p.length > 0);

        if (parts.length < 3) {
            const tableName = parts.at(-1) ?? token;
            const examples = Config.RELATORIO_ALLOWED_DATABASES
                .map((db) => `${db}.dbo.${tableName}`)
                .join(' ou ');
            throw new AppError(
                `Query inválida: a tabela "${token}" deve ser referenciada com o nome completo banco.schema.tabela. Exemplos: ${examples}`,
                400,
            );
        }

        if (allowed.length > 0) {
            const dbName = parts[0].toLowerCase();
            if (!allowed.includes(dbName)) {
                throw new AppError(
                    `Query inválida: banco de dados "${parts[0]}" não é permitido. Permitidos: ${Config.RELATORIO_ALLOWED_DATABASES.join(', ')}`,
                    400,
                );
            }
        }
    }
}
