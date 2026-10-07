ALTER TABLE [dbo].[contas_bancarias]
    ADD CONSTRAINT [contas_bancarias_codigo_cia_gl_account_key]
    UNIQUE ([codigo_cia], [gl_account]);
