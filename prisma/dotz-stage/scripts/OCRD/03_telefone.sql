-- Adiciona a coluna telefone na tabela OCRD

ALTER TABLE Dotz_Stage_Trocas.dbo.OCRD
ADD
    telefone NVARCHAR(20) NULL;
