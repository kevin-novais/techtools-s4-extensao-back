IF COL_LENGTH('dbo.vendas_header', 'tipo_contabil_erp') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [tipo_contabil_erp] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.vendas_header', 'tipo_processo') IS NULL
BEGIN
    ALTER TABLE [dbo].[vendas_header]
    ADD [tipo_processo] NVARCHAR(10) NULL;
END;

IF COL_LENGTH('dbo.vendas_header', 'tipo_documento_erp') IS NOT NULL
BEGIN
    DECLARE @constraintName NVARCHAR(128);

    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('[dbo].[vendas_header]')
      AND c.name = 'tipo_documento_erp';

    IF @constraintName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE [dbo].[vendas_header] DROP CONSTRAINT [' + @constraintName + ']');
    END;

    ALTER TABLE [dbo].[vendas_header] DROP COLUMN [tipo_documento_erp];
END;
