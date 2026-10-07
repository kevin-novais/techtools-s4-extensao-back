/* =====================================================================
   DTZ-297 (ajuste v2) — BACKFILL do histórico de config de ponto,
   AGORA INCLUINDO OS TP_POS (retorno do consultor 11/09).

   Motivo: o Relatório de Trocas (#4008) resolve a conta de resgate SEMPRE
   pela config TP_ROM da cia (join hardcoded tipo_processo='TP_ROM'),
   independentemente do tipo do documento. A v1 escopava o backfill só a
   TP_ROM → os 17 documentos TP_POS do relatório ficaram sem documento_fiscal_ponto
   e o relatório (que passou a ler do snapshot) quebrou para eles.

   Confirmado na HML (11/09):
   - Universo do relatório = 60 TP_ROM (com dfp) + 17 TP_POS (sem dfp), todos cia_id=2.
   - Os TP_POS têm U_TIPO='NSF'; a config TP_ROM da cia 2 tem codigo_ponto 'NFS'(default)/'Promo'
     => 'NSF' não casa => cai no DEFAULT (NFS: deb 24090113 / cred 41000021).
   - Os dois caminhos de ligação ao @REFDOTZ convergem (via codigo_pedido_parceiro
     e via OPOR.U_DOTZNRPED dão o mesmo conjunto), então o CROSS APPLY por
     codigo_pedido_parceiro resolve TP_ROM e TP_POS igual.

   Regra (retorno do consultor): quando o ponto NÃO tem config própria e cai no
   default, GRAVAR no histórico assim mesmo — u_tipo = tipo cru do @REFDOTZ,
   valores = os do default. É o que o OUTER APPLY abaixo já faz.

   Idempotente: reconstrói o snapshot inteiro (todos os documentos resolvíveis).
   A conta sempre sai da config TP_ROM da cia (semântica do relatório).
   Rodar 1x na HML (s4_extensao_dotz). REQUER a coluna u_tipo (migration
   20260909120000_documento_fiscal_ponto_u_tipo já aplicada).
   ===================================================================== */

SET XACT_ABORT ON;
BEGIN TRAN;

-- 0) Fotografia ANTES (para conferência).
SELECT 'antes' AS etapa, dfh.tipo_documento_erp AS tipo,
       COUNT(DISTINCT dfp.documento_fiscal_header_id) AS docs, COUNT(*) AS linhas
FROM dbo.documento_fiscal_ponto dfp
JOIN dbo.documento_fiscal_header dfh ON dfh.id = dfp.documento_fiscal_header_id
GROUP BY dfh.tipo_documento_erp;

-- 1) Idempotência: reconstrução total do snapshot (será regravado abaixo).
DELETE FROM dbo.documento_fiscal_ponto;

-- 2) Regrava o snapshot para TODOS os documentos resolvíveis (TP_ROM + TP_POS),
--    resolvendo a conta pela config TP_ROM da cia (codigo_ponto=U_TIPO senão default),
--    uma linha por (documento, U_TIPO). u_tipo = tipo cru do @REFDOTZ.
INSERT INTO dbo.documento_fiscal_ponto
    (documento_fiscal_header_id, configuracao_contabil_header_id, configuracao_contabil_detalhe_ponto_id,
     u_tipo, codigo_ponto, descricao_ponto, custo_ponto, conta_credito, conta_debito,
     grupo_pis_cofins, aliquota_pis, conta_credito_pis, conta_debito_pis,
     aliquota_cofins, conta_credito_cofins, conta_debito_cofins, criado_em)
SELECT
    dfh.id,
    resolved.configuracao_contabil_id,
    resolved.id,
    tipos.u_tipo,
    resolved.codigo_ponto,
    resolved.descricao_ponto,
    resolved.custo_ponto,
    resolved.conta_credito,
    resolved.conta_debito,
    ISNULL(resolved.grupo_pis_cofins, 'N'),
    resolved.aliquota_pis,
    resolved.conta_credito_pis,
    resolved.conta_debito_pis,
    resolved.aliquota_cofins,
    resolved.conta_credito_cofins,
    resolved.conta_debito_cofins,
    CURRENT_TIMESTAMP
FROM dbo.documento_fiscal_header dfh
-- config header da cia p/ TP_ROM (semântica do relatório: resgate sempre pela TP_ROM da cia)
JOIN dbo.configuracao_contabil_header h
    ON h.cia_id = dfh.cia_id AND h.tipo_processo = 'TP_ROM'
-- U_TIPO distintos do documento (via pedidos do @REFDOTZ)
CROSS APPLY (
    SELECT DISTINCT ref.U_TIPO AS u_tipo
    FROM dbo.documento_fiscal_detail dfd
    JOIN Dotz_Stage_Trocas.dbo.[@REFDOTZ] ref
        ON ref.U_PEDCOMPRA = TRY_CONVERT(INT, dfd.codigo_pedido_parceiro)
    WHERE dfd.documento_fiscal_header_id = dfh.id
) tipos
-- config aplicada: match exato por codigo_ponto=U_TIPO; senão o default (find(...) ?? confDefault)
OUTER APPLY (
    SELECT TOP 1 d.*
    FROM dbo.configuracao_contabil_detail_ponto d
    WHERE d.configuracao_contabil_id = h.id
      AND (d.codigo_ponto = tipos.u_tipo OR d.[default] = 1)
    ORDER BY CASE WHEN d.codigo_ponto = tipos.u_tipo THEN 0 ELSE 1 END
) resolved
WHERE resolved.id IS NOT NULL;   -- sem config aplicável => não gera linha (igual ao `continue` da integração)

-- 3) Conferência DEPOIS: por tipo + amostra dos TP_POS (devem ter u_tipo cru e contas do default).
SELECT 'depois' AS etapa, dfh.tipo_documento_erp AS tipo,
       COUNT(DISTINCT dfp.documento_fiscal_header_id) AS docs, COUNT(*) AS linhas
FROM dbo.documento_fiscal_ponto dfp
JOIN dbo.documento_fiscal_header dfh ON dfh.id = dfp.documento_fiscal_header_id
GROUP BY dfh.tipo_documento_erp;

SELECT TOP 20 dfp.documento_fiscal_header_id AS doc, dfh.tipo_documento_erp AS tipo,
       dfp.u_tipo, dfp.codigo_ponto, dfp.conta_debito, dfp.conta_credito
FROM dbo.documento_fiscal_ponto dfp
JOIN dbo.documento_fiscal_header dfh ON dfh.id = dfp.documento_fiscal_header_id
WHERE dfh.tipo_documento_erp = 'TP_POS'
ORDER BY dfp.documento_fiscal_header_id;

-- Revisar acima. Se OK: COMMIT TRAN;  senão: ROLLBACK TRAN;
COMMIT TRAN;
