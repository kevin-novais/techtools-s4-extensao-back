-- Adiciona as colunas ativo, cnpj, email, grupo e CODIGO_PAI na tabela OCRD

ALTER TABLE Dotz_Stage_Trocas.dbo.OCRD
ADD
    ativo BIT NOT NULL CONSTRAINT DF_OCRD_ativo DEFAULT 1,
    cnpj NVARCHAR(20) NULL,
    email NVARCHAR(200) NULL,
    grupo NVARCHAR(50) NULL,
    CODIGO_PAI NVARCHAR(50) NULL,
    ie NVARCHAR(9) NULL,
    endereco NVARCHAR(200) NULL,
    municipio NVARCHAR(100) NULL,
    cep NVARCHAR(8) NULL,
    FORMA_PAGAMENTO NVARCHAR(8) NULL;


