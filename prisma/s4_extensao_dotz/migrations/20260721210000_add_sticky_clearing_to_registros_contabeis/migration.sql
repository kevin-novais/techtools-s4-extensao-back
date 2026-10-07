IF COL_LENGTH('dbo.registros_contabeis', 'sticky_clear_acc_doc') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD sticky_clear_acc_doc NVARCHAR(10) NULL;
END;
IF COL_LENGTH('dbo.registros_contabeis', 'sticky_clear_doc_fiscal_year') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD sticky_clear_doc_fiscal_year NVARCHAR(4) NULL;
END;
IF COL_LENGTH('dbo.registros_contabeis', 'sticky_clear_item') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD sticky_clear_item NVARCHAR(3) NULL;
END;
