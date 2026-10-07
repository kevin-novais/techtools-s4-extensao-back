import { describe, expect, it } from 'vitest';
import { validateQuery } from '../../../src/modules/relatorio/utils/validateQuery';
import AppError from '../../../src/util/AppError';

describe('validateQuery', () => {
    it('deve aceitar SELECT simples com nome completo banco.schema.tabela', () => {
        expect(() => validateQuery('SELECT id, nome FROM s4_extensao_dotz.dbo.usuarios')).not.toThrow();
    });

    it('deve aceitar SELECT com alias em minúsculo', () => {
        expect(() => validateQuery('select * from s4_extensao_dotz.dbo.relatorio')).not.toThrow();
    });

    it('deve rejeitar query sem SELECT no início', async () => {
        expect(() => validateQuery('UPDATE usuarios SET ativo = 0')).toThrow(AppError);
    });

    it('deve rejeitar INSERT', () => {
        expect(() => validateQuery('SELECT 1; INSERT INTO usuarios VALUES (1)')).toThrow(AppError);
    });

    it('deve rejeitar múltiplas instruções com ponto-e-vírgula', () => {
        expect(() => validateQuery('SELECT * FROM usuarios;')).toThrow(AppError);
    });

    it('deve rejeitar DROP TABLE', () => {
        expect(() => validateQuery('SELECT * FROM usuarios WHERE 1=1; DROP TABLE usuarios')).toThrow(AppError);
    });

    it('deve rejeitar EXECUTE', () => {
        expect(() => validateQuery('SELECT EXECUTE xp_cmdshell')).toThrow(AppError);
    });

    it('deve rejeitar DELETE', () => {
        expect(() => validateQuery('DELETE FROM usuarios')).toThrow(AppError);
    });

    it('deve rejeitar ALTER', () => {
        expect(() => validateQuery('ALTER TABLE usuarios ADD coluna INT')).toThrow(AppError);
    });

    it('deve rejeitar CREATE', () => {
        expect(() => validateQuery('CREATE TABLE nova_tabela (id INT)')).toThrow(AppError);
    });

    it('deve rejeitar TRUNCATE', () => {
        expect(() => validateQuery('TRUNCATE TABLE usuarios')).toThrow(AppError);
    });

    it('deve lançar AppError com statusCode 400', () => {
        try {
            validateQuery('DROP TABLE usuarios');
        } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            expect((err as AppError).statusCode).toBe(400);
        }
    });
});
