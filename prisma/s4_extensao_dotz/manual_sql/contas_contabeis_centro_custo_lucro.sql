/* =====================================================================
   DTZ-247 - centro_custo / centro_lucro em contas_contabeis
   ---------------------------------------------------------------------
   Adiciona as colunas usadas para preencher CentroCusto/CentroLucro nas
   linhas do LCM (Journal Entry) enviado ao S/4. Cadastro é feito pela tela
   de Contas Contábeis.

   Espelha a migration `20260702210000_add_centro_custo_lucro_contas_contabeis`.
   Idempotente (COL_LENGTH). Não registra nada em `_prisma_migrations`.
   ===================================================================== */

IF COL_LENGTH('dbo.contas_contabeis', 'centro_custo') IS NULL
    ALTER TABLE [dbo].[contas_contabeis] ADD [centro_custo] NVARCHAR(20) NULL;

IF COL_LENGTH('dbo.contas_contabeis', 'centro_lucro') IS NULL
    ALTER TABLE [dbo].[contas_contabeis] ADD [centro_lucro] NVARCHAR(20) NULL;
