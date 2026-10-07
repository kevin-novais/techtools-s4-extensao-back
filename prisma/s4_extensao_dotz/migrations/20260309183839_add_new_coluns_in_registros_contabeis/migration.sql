BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[registros_contabeis] ADD [accounting_document_category_name] NVARCHAR(30),
[accounting_document_type_name] NVARCHAR(30),
[bloco] NVARCHAR(1),
[business_area_name] NVARCHAR(30),
[business_transaction_type] NVARCHAR(10),
[company_code_name] NVARCHAR(30),
[controlling_area_name] NVARCHAR(30),
[cost_center_name] NVARCHAR(30),
[functional_area_name] NVARCHAR(30),
[gl_account_long_name] NVARCHAR(50),
[id_xrt] NVARCHAR(50),
[item_fluxo_de_caixa] NVARCHAR(10),
[number_of_days] INT,
[profit_center_name] NVARCHAR(30),
[segment_name] NVARCHAR(30),
[status_para_envio] NVARCHAR(1),
[status_registro_alterado] NVARCHAR(1);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
