-- DTZ-247: centro de custo/lucro por conta contábil (usados no LCM enviado ao S/4).
IF COL_LENGTH('dbo.contas_contabeis', 'centro_custo') IS NULL
BEGIN
    ALTER TABLE [dbo].[contas_contabeis] ADD [centro_custo] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.contas_contabeis', 'centro_lucro') IS NULL
BEGIN
    ALTER TABLE [dbo].[contas_contabeis] ADD [centro_lucro] NVARCHAR(20) NULL;
END;
