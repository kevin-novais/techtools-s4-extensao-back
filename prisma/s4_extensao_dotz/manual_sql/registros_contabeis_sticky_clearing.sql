-- DTZ-273 - Congelamento do vinculo de compensacao no momento do sync.
--
-- O S/4 apaga clearing_accounting_document quando a compensacao e revertida, e o
-- sync grava o payload inteiro (SyncRegistrosContabeisService.processarPagina),
-- entao o vazio sobrescreve o valor que tinhamos: o vinculo entre pagamento e
-- fatura desaparece da nossa base. As colunas sav_* nao cobrem esse caso porque
-- so sao gravadas em envio bem-sucedido, o que exige a linha classificada.
--
-- Estas colunas sao gravadas pelo proprio sync e NUNCA sobrescritas por vazio.
-- Idempotente (SQL Server). Banco compartilhado: aplicar manualmente, NUNCA via
-- migrate deploy.

IF COL_LENGTH('dbo.registros_contabeis', 'sticky_clear_acc_doc') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sticky_clear_acc_doc NVARCHAR(10) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'sticky_clear_doc_fiscal_year') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sticky_clear_doc_fiscal_year NVARCHAR(4) NULL;
GO
IF COL_LENGTH('dbo.registros_contabeis', 'sticky_clear_item') IS NULL
    ALTER TABLE dbo.registros_contabeis ADD sticky_clear_item NVARCHAR(3) NULL;
GO

-- Backfill do que ainda existe hoje nas colunas vivas e nas sav_*, para nao
-- comecar do zero. Nao inventa vinculo: so copia o que ja esta gravado.
UPDATE dbo.registros_contabeis
   SET sticky_clear_acc_doc         = clearing_accounting_document,
       sticky_clear_doc_fiscal_year = clearing_doc_fiscal_year,
       sticky_clear_item            = clearing_item
 WHERE sticky_clear_acc_doc IS NULL
   AND clearing_accounting_document IS NOT NULL
   AND clearing_accounting_document NOT IN ('', '0');
GO

-- O S/4 usa "0" como marcador de vazio nos campos numericos. Gravado assim, o ano/item
-- da compensacao aponta para lugar nenhum e quebra a referencia. Normaliza para NULL.
UPDATE dbo.registros_contabeis
   SET sticky_clear_doc_fiscal_year = NULLIF(sticky_clear_doc_fiscal_year, '0'),
       sticky_clear_item            = NULLIF(sticky_clear_item, '0')
 WHERE sticky_clear_doc_fiscal_year = '0'
    OR sticky_clear_item = '0';
GO

UPDATE dbo.registros_contabeis
   SET sticky_clear_acc_doc         = sav_clear_acc_doc,
       sticky_clear_doc_fiscal_year = sav_clear_doc_fiscal_year,
       sticky_clear_item            = sav_clear_item
 WHERE sticky_clear_acc_doc IS NULL
   AND sav_clear_acc_doc IS NOT NULL
   AND sav_clear_acc_doc NOT IN ('', '0');
GO
