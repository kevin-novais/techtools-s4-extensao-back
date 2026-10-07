-- DTZ-301 (performance — e-mail Everaldo 26/08): índices em registros_contabeis para evitar
-- lentidão das views XRT_SendPrevPagto/XRT_SendFlux em produção. Só a PK clustered existia
-- (company_code, fiscal_year, accounting_document, accounting_document_item).
--
-- Base: colunas de filtro/join reais das views (o usuário da API não tem VIEW SERVER STATE,
-- então as missing-index DMVs não foram consultáveis; o DBA deve validar com o plano real).
-- Tabela sync-heavy (upsert em massa do SAP) → conjunto enxuto (3 índices).
--
-- 1) Gate de envio: toda varredura filtra status_para_envio (IS NULL / 'SUCESSO_PREV') +
--    financial_account_type IN ('K','D'). Subconjunto quente pequeno.
CREATE NONCLUSTERED INDEX IX_registros_contabeis_status_fat
  ON dbo.registros_contabeis (status_para_envio, financial_account_type);

-- 2) Self-joins de compensação (pgtos/lista/Lst_xtpg no SendFlux) e o 2º update do
--    compensador no write-back (company_code + clearing_accounting_document + clearing_item).
CREATE NONCLUSTERED INDEX IX_registros_contabeis_clearing
  ON dbo.registros_contabeis (company_code, clearing_accounting_document, clearing_item);

-- 3) Joins de reversão/estorno (reverse_document) no SendFlux (ramos de reversão).
CREATE NONCLUSTERED INDEX IX_registros_contabeis_reverse
  ON dbo.registros_contabeis (company_code, reverse_document);

-- Candidato opcional (validar com o DBA se o ramo 'Pagto Prev Rever' pesar em produção):
--   ON dbo.registros_contabeis (company_code, sav_clear_acc_doc, sav_clear_doc_fiscal_year);
-- Em produção, se a edição do SQL Server permitir, criar com WITH (ONLINE = ON) para não
-- bloquear a tabela durante o build.
