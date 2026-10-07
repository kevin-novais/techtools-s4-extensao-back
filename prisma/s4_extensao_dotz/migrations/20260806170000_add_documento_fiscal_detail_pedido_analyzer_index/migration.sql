CREATE NONCLUSTERED INDEX [IX_documento_fiscal_detail_pedido_analyzer]
ON [dbo].[documento_fiscal_detail] ([codigo_pedido_analyzer])
INCLUDE ([documento_fiscal_header_id])
WHERE [codigo_pedido_analyzer] IS NOT NULL;
