IF COL_LENGTH('dbo.venda_rec_diferida', 'tipo') IS NULL
BEGIN
    ALTER TABLE [dbo].[venda_rec_diferida]
    ADD [tipo] VARCHAR(25) NOT NULL
        CONSTRAINT [venda_rec_diferida_tipo_df] DEFAULT 'DIFERIDO_TOTAL';
END;

IF OBJECT_ID('dbo.venda_rec_diferida_vendas_header_id_periodo_diferimento_key', 'UQ') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[venda_rec_diferida]
    DROP CONSTRAINT [venda_rec_diferida_vendas_header_id_periodo_diferimento_key];
END;

IF OBJECT_ID('dbo.venda_rec_diferida_vendas_header_id_periodo_diferimento_tipo_key', 'UQ') IS NULL
BEGIN
    ALTER TABLE [dbo].[venda_rec_diferida]
    ADD CONSTRAINT [venda_rec_diferida_vendas_header_id_periodo_diferimento_tipo_key]
    UNIQUE NONCLUSTERED ([vendas_header_id], [periodo_diferimento], [tipo]);
END;
