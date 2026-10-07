BEGIN TRY
    BEGIN TRANSACTION;

    -- =========================================================================
    -- 1) documento_fiscal_header
    --    tipo_documento_erp (antigo contábil) -> tipo_contabil_erp
    --    tipo_processo (antigo processo)       -> tipo_documento_erp
    -- =========================================================================
    IF COL_LENGTH('dbo.documento_fiscal_header', 'tipo_documento_erp') IS NOT NULL
       AND COL_LENGTH('dbo.documento_fiscal_header', 'tipo_contabil_erp') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.documento_fiscal_header.tipo_documento_erp',
            'tipo_contabil_erp',
            'COLUMN';
    END;

    IF COL_LENGTH('dbo.documento_fiscal_header', 'tipo_processo') IS NOT NULL
       AND COL_LENGTH('dbo.documento_fiscal_header', 'tipo_documento_erp') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.documento_fiscal_header.tipo_processo',
            'tipo_documento_erp',
            'COLUMN';
    END;

    -- Default constraint do antigo tipo_processo
    IF OBJECT_ID('dbo.documento_fiscal_header_tipo_processo_df', 'D') IS NOT NULL
       AND OBJECT_ID('dbo.documento_fiscal_header_tipo_documento_erp_df', 'D') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.documento_fiscal_header_tipo_processo_df',
            'documento_fiscal_header_tipo_documento_erp_df',
            'OBJECT';
    END;

    -- Unique constraint (cia_id, codigo_documento, tipo_documento_erp)
    IF OBJECT_ID('dbo.documento_fiscal_header_cia_id_codigo_documento_tipo_processo_key', 'UQ') IS NOT NULL
       AND OBJECT_ID('dbo.documento_fiscal_header_cia_id_codigo_documento_tipo_documento_erp_key', 'UQ') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.documento_fiscal_header_cia_id_codigo_documento_tipo_processo_key',
            'documento_fiscal_header_cia_id_codigo_documento_tipo_documento_erp_key',
            'OBJECT';
    END;

    -- =========================================================================
    -- 2) configuracao_contabil_header
    --    tipo_documento_erp (antigo contábil) -> tipo_contabil_erp
    --    tipo_processo (antigo processo)       -> tipo_documento_erp
    -- =========================================================================
    IF COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_documento_erp') IS NOT NULL
       AND COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_contabil_erp') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header.tipo_documento_erp',
            'tipo_contabil_erp',
            'COLUMN';
    END;

    IF COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_processo') IS NOT NULL
       AND COL_LENGTH('dbo.configuracao_contabil_header', 'tipo_documento_erp') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header.tipo_processo',
            'tipo_documento_erp',
            'COLUMN';
    END;

    -- Default constraint do antigo tipo_processo
    IF OBJECT_ID('dbo.configuracao_contabil_header_tipo_processo_df', 'D') IS NOT NULL
       AND OBJECT_ID('dbo.configuracao_contabil_header_tipo_documento_erp_df', 'D') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header_tipo_processo_df',
            'configuracao_contabil_header_tipo_documento_erp_df',
            'OBJECT';
    END;

    -- Unique constraint (cia_id, tipo_documento_erp)
    IF OBJECT_ID('dbo.configuracao_contabil_header_cia_id_tipo_processo_key', 'UQ') IS NOT NULL
       AND OBJECT_ID('dbo.configuracao_contabil_header_cia_id_tipo_documento_erp_key', 'UQ') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header_cia_id_tipo_processo_key',
            'configuracao_contabil_header_cia_id_tipo_documento_erp_key',
            'OBJECT';
    END;

    -- Índice simples por tipo_documento_erp
    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'configuracao_contabil_header_tipo_processo_idx'
          AND object_id = OBJECT_ID('dbo.configuracao_contabil_header')
    )
    AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'configuracao_contabil_header_tipo_documento_erp_idx'
          AND object_id = OBJECT_ID('dbo.configuracao_contabil_header')
    )
    BEGIN
        EXEC sp_rename
            'dbo.configuracao_contabil_header.configuracao_contabil_header_tipo_processo_idx',
            'configuracao_contabil_header_tipo_documento_erp_idx',
            'INDEX';
    END;

    -- =========================================================================
    -- 3) vendas_header
    --    tipo_processo -> tipo_documento_erp
    -- =========================================================================
    IF COL_LENGTH('dbo.vendas_header', 'tipo_processo') IS NOT NULL
       AND COL_LENGTH('dbo.vendas_header', 'tipo_documento_erp') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.vendas_header.tipo_processo',
            'tipo_documento_erp',
            'COLUMN';
    END;

    -- Default constraint do antigo tipo_processo
    IF OBJECT_ID('dbo.vendas_header_tipo_processo_df', 'D') IS NOT NULL
       AND OBJECT_ID('dbo.vendas_header_tipo_documento_erp_df', 'D') IS NULL
    BEGIN
        EXEC sp_rename
            'dbo.vendas_header_tipo_processo_df',
            'vendas_header_tipo_documento_erp_df',
            'OBJECT';
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
