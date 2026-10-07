-- =====================================================================
-- Visibilidade de relatórios descartados do VExpenses.
-- Torna controle_expense.paying_company_id anulável (relatórios descartados
-- antes da integração podem não ter empresa pagadora resolvida) e habilita o
-- novo status DESCARTADO (gravado pelo VexpensesApprovedReportsService).
-- Idempotente: só altera se a coluna ainda estiver NOT NULL. Aplicar
-- manualmente quando NÃO se pode rodar `prisma migrate deploy` (banco
-- s4_extensao_dotz compartilhado / à frente).
-- Migration formal equivalente: 20260616160000_controle_expense_paying_company_nullable.
-- =====================================================================

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('s4_extensao_dotz.dbo.controle_expense')
      AND name = 'paying_company_id'
      AND is_nullable = 0
)
    ALTER TABLE s4_extensao_dotz.dbo.controle_expense ALTER COLUMN paying_company_id INT NULL;
