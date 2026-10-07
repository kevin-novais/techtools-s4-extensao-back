IF COL_LENGTH('dbo.vendas_header', 'TIPO_CADASTRO') IS NULL
BEGIN
    EXEC sp_executesql N'
        ALTER TABLE [dbo].[vendas_header]
            ADD [TIPO_CADASTRO] NVARCHAR(20) NULL;
    ';
END;

EXEC sp_executesql N'
    UPDATE [dbo].[vendas_header]
    SET [TIPO_CADASTRO] = ''MANUAL''
    WHERE [TIPO_CADASTRO] IS NULL;
';

EXEC sp_executesql N'
    ALTER TABLE [dbo].[vendas_header]
        ALTER COLUMN [TIPO_CADASTRO] NVARCHAR(20) NOT NULL;
';
