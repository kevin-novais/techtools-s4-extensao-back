-- DTZ-248: tabela de valores válidos do Item Fluxo de Caixa (sem tela de cadastro).
IF OBJECT_ID('dbo.item_fluxo_caixa', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[item_fluxo_caixa] (
        [codigo] NVARCHAR(20) NOT NULL,
        [nome] NVARCHAR(100) NOT NULL,
        CONSTRAINT [item_fluxo_caixa_pkey] PRIMARY KEY CLUSTERED ([codigo])
    );
END;

INSERT INTO [dbo].[item_fluxo_caixa] ([codigo], [nome])
SELECT v.[codigo], v.[nome]
FROM (VALUES
    (N'2',  N'Recebimento de notas fiscais de clientes'),
    (N'3',  N'Adiantamentos Recebidos'),
    (N'7',  N'Pagamentos de Resgate de Prêmios'),
    (N'8',  N'Adiantamentos para fornecedores'),
    (N'11', N'Administrative'),
    (N'12', N'Call Center'),
    (N'15', N'Headcount'),
    (N'16', N'Marketing Expenses'),
    (N'17', N'Technology Expenses'),
    (N'18', N'Outros pagamentos operacionais'),
    (N'19', N'Imposto de renda de pessoa jurídica pago'),
    (N'20', N'Juros pagos - atividades operacionais'),
    (N'23', N'Aporte de Capital'),
    (N'24', N'Compra de ativos fixos (Capex)'),
    (N'25', N'Juros recebidos - atividades de investimento'),
    (N'26', N'Resgate/ Aplicações'),
    (N'31', N'Tarifas Bancarias'),
    (N'34', N'Amortização de empréstimos (Principal)'),
    (N'36', N'Dividendo pago'),
    (N'37', N'Juros recebidos - atividades de financiamento'),
    (N'39', N'Services Agreement'),
    (N'43', N'Outras Obrigações'),
    (N'44', N'Pagamentos de notas fiscais para fornecedores'),
    (N'45', N'Long Term Incentive Plan (LTIP)'),
    (N'46', N'Juros pagos - atividades de financiamento'),
    (N'52', N'Pagamento de Impostos sobre emissão e serviço'),
    (N'53', N'Pagamento de outros impostos'),
    (N'54', N'Novos Empréstimos'),
    (N'72', N'Transação Cash-in'),
    (N'76', N'Transação Cash-Out')
) AS v([codigo], [nome])
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[item_fluxo_caixa] t WHERE t.[codigo] = v.[codigo]
);
