-- =====================================================================
-- Colunas request/response em controle_expense para auditoria do envio SAP.
-- request  = payload JSON enviado ao SAP (VexpensesIntegrationJson)
-- response = resposta do SAP (sucesso ou erro)
-- Idempotente: só adiciona se a coluna ainda não existir. Aplicar manualmente
-- (banco s4_extensao_dotz compartilhado / à frente — NÃO usar migrate deploy).
-- Migration formal equivalente: 20260618000000_controle_expense_request_response.
-- =====================================================================

IF COL_LENGTH('s4_extensao_dotz.dbo.controle_expense', 'request') IS NULL
    ALTER TABLE s4_extensao_dotz.dbo.controle_expense ADD [request] NVARCHAR(MAX) NULL;

IF COL_LENGTH('s4_extensao_dotz.dbo.controle_expense', 'response') IS NULL
    ALTER TABLE s4_extensao_dotz.dbo.controle_expense ADD [response] NVARCHAR(MAX) NULL;
