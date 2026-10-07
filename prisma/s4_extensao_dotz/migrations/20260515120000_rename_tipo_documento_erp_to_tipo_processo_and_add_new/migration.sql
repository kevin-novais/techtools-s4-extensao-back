BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- configuracao_contabil_header
    -- 1) Renomear tipo_documento_erp (NVARCHAR 10, processo) → tipo_processo
    -- 2) Adicionar nova coluna tipo_documento_erp (NVARCHAR 2, SAP: RE/PD/DR/RD)
    -- =========================================================================

    -- 1a) Renomear a coluna tipo_documento_erp → tipo_processo
    IF COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_documento_erp') IS NOT NULL
       AND COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_processo') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header.tipo_documento_erp',
            'tipo_processo',
            'COLUMN';
    END;

    -- 1b) Renomear a default constraint do campo
    IF OBJECT_ID('dbo.configuracao_contabil_header_tipo_documento_erp_df', 'D') IS NOT NULL
       AND OBJECT_ID('dbo.configuracao_contabil_header_tipo_processo_df', 'D') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header_tipo_documento_erp_df',
            'configuracao_contabil_header_tipo_processo_df',
            'OBJECT';
    END;

    -- 1c) Renomear a unique constraint (cia_id, tipo_documento_erp) → (cia_id, tipo_processo)
    IF OBJECT_ID('dbo.configuracao_contabil_header_cia_id_tipo_documento_erp_key', 'UQ') IS NOT NULL
       AND OBJECT_ID('dbo.configuracao_contabil_header_cia_id_tipo_processo_key', 'UQ') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header_cia_id_tipo_documento_erp_key',
            'configuracao_contabil_header_cia_id_tipo_processo_key',
            'OBJECT';
    END;

    -- 1d) Renomear o índice simples por tipo_documento_erp → tipo_processo
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'configuracao_contabil_header_tipo_documento_erp_idx'
          AND object_id = OBJECT_ID('dbo.configuracao_contabil_header')
    )
    AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'configuracao_contabil_header_tipo_processo_idx'
          AND object_id = OBJECT_ID('dbo.configuracao_contabil_header')
    )
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header.configuracao_contabil_header_tipo_documento_erp_idx',
            'configuracao_contabil_header_tipo_processo_idx',
            'INDEX';
    END;

    -- 2a) Adicionar nova coluna tipo_documento_erp (NVARCHAR 2) com default temporário
    IF COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_documento_erp') IS NULL
    BEGIN
        ALTER TABLE [dbo].[configuracao_contabil_header]
            ADD [tipo_documento_erp] NVARCHAR(2) NOT NULL DEFAULT 'RE';
    END;

    -- 2b) Preencher tipo_documento_erp derivando do tipo_processo.
    -- EXEC() forçado para compilação em runtime: sp_rename já renomeou a coluna,
    -- mas o compilador do batch ainda não a conhecia como [tipo_processo].
    EXEC('
        UPDATE [dbo].[configuracao_contabil_header]
        SET [tipo_documento_erp] = CASE [tipo_processo]
            WHEN ''TP_ROM'' THEN ''RE''
            WHEN ''TP_POS'' THEN ''RE''
            WHEN ''PD''     THEN ''PD''
            WHEN ''DR''     THEN ''DR''
            WHEN ''RD''     THEN ''RD''
            ELSE ''RE''
        END
    ');

    -- 2c) Remover default temporário
    DECLARE @constraintName NVARCHAR(256);
    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID('dbo.configuracao_contabil_header')
      AND c.name = 'tipo_documento_erp';

    IF @constraintName IS NOT NULL
        EXEC('ALTER TABLE [dbo].[configuracao_contabil_header] DROP CONSTRAINT [' + @constraintName + ']');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
