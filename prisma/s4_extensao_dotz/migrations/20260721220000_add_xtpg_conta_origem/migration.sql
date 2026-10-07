IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_conta_origem') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD xtpg_conta_origem NVARCHAR(10) NULL;
END;
IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_conta_origem_nivel') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD xtpg_conta_origem_nivel TINYINT NULL;
END;
IF COL_LENGTH('dbo.registros_contabeis', 'xtpg_conta_origem_nome') IS NULL
BEGIN
    ALTER TABLE dbo.registros_contabeis ADD xtpg_conta_origem_nome NVARCHAR(100) NULL;
END;
