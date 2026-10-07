IF COL_LENGTH('dbo.venda_rec_diferida', 'request_sap') IS NULL
BEGIN
    ALTER TABLE dbo.venda_rec_diferida ADD request_sap NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.venda_rec_diferida', 'response_sap') IS NULL
BEGIN
    ALTER TABLE dbo.venda_rec_diferida ADD response_sap NVARCHAR(MAX) NULL;
END;
