/* =====================================================================
   DTZ-297 (ajuste) — NOVA QUERY do Relatório de Trocas (relatorio.id = 4008)
   Mudança: a conta de resgate (ContaResgD/ContaResgC) passa a vir do
   snapshot histórico documento_fiscal_ponto, casado por (documento + U_TIPO cru),
   em vez da config viva (configuracao_contabil_detail_ponto por U_TIPOOPOUTROS).

   - Antes: 2 joins ccdp/ccdp_def (match por U_TIPOOPOUTROS senão [default]) + CASE.
   - Depois: 1 join dfp por documento_fiscal_header_id + u_tipo; a conta já vem resolvida.
   - Observação: o relatório exibe/agrupa por U_TIPOOPOUTROS, mas o CASAMENTO da conta
     usa U_TIPO (mesmo campo que a integração usou p/ gravar o histórico) — evita o
     descasamento U_TIPO x U_TIPOOPOUTROS (diferem em ~66% da base; ex. NSF vs NFS).

   Este arquivo é só o TEXTO da query (para revisão). Aplicar via
   apply_relatorio_4008.js (UPDATE parametrizado) — NÃO colar direto sem escapar aspas.
   Rollback: a query anterior está preservada no fim deste arquivo (bloco ROLLBACK).
   ===================================================================== */

-- ============================ QUERY NOVA ============================
select

 -- Fornecedor
 opor.cardCode as "Cod. Fornecedor",
 ocrd.cardname as "Desc. Fornecedor",
 -- Pedido
 FORMAT(opor.U_DOTZNRPED, '0', 'pt-BR') as "pedido",
 opor.DocEntry as "DocEntry",
 dfh.status,
 por1.LineNum as "LineNum",
 dfd.CODIGO_DOCUMENTO AS "Nr.Doc. NF",
 CONVERT(VARCHAR(10), opor.DocDate, 103) AS "Dt.Pedido",
 CONVERT(VARCHAR(10), opor.DocDate, 103) as "Nf.Dt.Emissao",
 CONVERT(VARCHAR(10), opor.DocDueDate, 103) as "Nf.Dt.Vecto",
 FORMAT(por1.LineTotal, '0.00', 'pt-BR')  as "Prc.Unit",
 -- Pontos
 refdotz.U_TIPOOPOUTROS as "U_TIPOOPOUTROS",
 SUM(refdotz.U_PONTOS) as "Qtn. Pontos",
 -- DTZ-297: conta de resgate vinda do snapshot historico (ja resolvida por U_TIPO)
 dfp.conta_debito  AS [ContaResgD],
 dfp.conta_credito AS [ContaResgC]


from dotz_stage_trocas.dbo.OPOR opor

left join dotz_stage_trocas.dbo.POR1 por1
 on (opor.DocEntry = por1.DocEntry)
left join dotz_stage_trocas.dbo."@REFDOTZ" refdotz
 on (opor.U_DOTZNRPED = refdotz.U_PEDCOMPRA)
left join dotz_stage_trocas.dbo.OCRD ocrd
 on (opor.CardCode = ocrd.CardCode)
left join s4_extensao_dotz.dbo.documento_fiscal_detail dfd
 on dfd.[codigo_pedido_analyzer] = CONVERT(NVARCHAR(50), opor.DocEntry)
left join s4_extensao_dotz.dbo.documento_fiscal_header dfh
 on dfh.id = dfd.documento_fiscal_header_id and dfh.status != 'CANCELADO'
-- DTZ-297: substitui os joins na config viva (ccdp/ccdp_def) pelo snapshot historico.
-- Casa por documento + U_TIPO cru (o historico ja guarda a conta resolvida, com fallback default aplicado na gravacao).
left join s4_extensao_dotz.dbo.documento_fiscal_ponto dfp
 on dfp.documento_fiscal_header_id = dfh.id and dfp.u_tipo = refdotz.U_TIPO


where
opor.DocDate  >= {{Data_inicio}}
and opor.DocDate  <= {{Data_Final}}

group by

 opor.cardCode,
 ocrd.cardname,
 -- Pedido
 opor.U_DOTZNRPED,
 opor.DocEntry,
 por1.LineNum,
 dfd.CODIGO_DOCUMENTO,
 opor.DocDate,
 opor.DocDueDate,
 por1.LineTotal,
 -- Pontos
 refdotz.U_TIPOOPOUTROS,
 refdotz.U_PONTOS,
 -- Dados processamento (historico)
 dfp.conta_debito,
 dfp.conta_credito,
 dfh.status


/* ========================== ROLLBACK (query ANTERIOR) ==========================
select
 opor.cardCode as "Cod. Fornecedor",
 ocrd.cardname as "Desc. Fornecedor",
 FORMAT(opor.U_DOTZNRPED, '0', 'pt-BR') as "pedido",
 opor.DocEntry as "DocEntry",
 dfh.status,
 por1.LineNum as "LineNum",
 dfd.CODIGO_DOCUMENTO AS "Nr.Doc. NF",
 CONVERT(VARCHAR(10), opor.DocDate, 103) AS "Dt.Pedido",
 CONVERT(VARCHAR(10), opor.DocDate, 103) as "Nf.Dt.Emissao",
 CONVERT(VARCHAR(10), opor.DocDueDate, 103) as "Nf.Dt.Vecto",
 FORMAT(por1.LineTotal, '0.00', 'pt-BR')  as "Prc.Unit",
 refdotz.U_TIPOOPOUTROS as "U_TIPOOPOUTROS",
 SUM(refdotz.U_PONTOS) as "Qtn. Pontos",
 CASE WHEN ccdp.id IS NOT NULL THEN ccdp.conta_debito WHEN ccdp_def.id IS NOT NULL THEN ccdp_def.conta_debito ELSE null END AS [ContaResgD],
 CASE WHEN ccdp.id IS NOT NULL THEN ccdp.conta_credito WHEN ccdp_def.id IS NOT NULL THEN ccdp_def.conta_credito ELSE null END AS [ContaResgC]
from dotz_stage_trocas.dbo.OPOR opor
left join dotz_stage_trocas.dbo.POR1 por1 on (opor.DocEntry = por1.DocEntry)
left join dotz_stage_trocas.dbo."@REFDOTZ" refdotz on (opor.U_DOTZNRPED = refdotz.U_PEDCOMPRA)
left join dotz_stage_trocas.dbo.OCRD ocrd on (opor.CardCode = ocrd.CardCode)
left join s4_extensao_dotz.dbo.documento_fiscal_detail dfd on dfd.[codigo_pedido_analyzer] = CONVERT(NVARCHAR(50), opor.DocEntry)
left join s4_extensao_dotz.dbo.documento_fiscal_header dfh on dfh.id = dfd.documento_fiscal_header_id and dfh.status != 'CANCELADO'
left join s4_extensao_dotz.dbo.configuracao_contabil_header ccd on ccd.tipo_processo = 'TP_ROM' and dfh.cia_id = ccd.cia_id
left join s4_extensao_dotz.dbo.configuracao_contabil_detail_ponto ccdp on ccd.id = ccdp.configuracao_contabil_id and ccdp.codigo_ponto = refdotz.U_TIPOOPOUTROS
left join s4_extensao_dotz.dbo.configuracao_contabil_detail_ponto ccdp_def on ccdp.id is null and ccd.id = ccdp_def.configuracao_contabil_id and ccdp_def.[default] = 1
where opor.DocDate >= {{Data_inicio}} and opor.DocDate <= {{Data_Final}}
group by opor.cardCode, ocrd.cardname, opor.U_DOTZNRPED, opor.DocEntry, por1.LineNum, dfd.CODIGO_DOCUMENTO, opor.DocDate, opor.DocDueDate, por1.LineTotal, refdotz.U_TIPOOPOUTROS, refdotz.U_PONTOS, ccdp.id, ccdp.conta_debito, ccdp.conta_credito, ccdp_def.id, ccdp_def.conta_debito, ccdp_def.conta_credito, dfh.status
=============================================================================== */
