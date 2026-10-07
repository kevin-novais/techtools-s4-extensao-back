IF OBJECT_ID('dbo.venda_rec_diferida_tipo_chk', 'C') IS NULL
BEGIN
    ALTER TABLE [dbo].[venda_rec_diferida] WITH CHECK
    ADD CONSTRAINT [venda_rec_diferida_tipo_chk]
    CHECK ([tipo] IN ('DIFERIDO_TOTAL', 'DIFERIDO_VENDA'));

    ALTER TABLE [dbo].[venda_rec_diferida]
    CHECK CONSTRAINT [venda_rec_diferida_tipo_chk];
END;
