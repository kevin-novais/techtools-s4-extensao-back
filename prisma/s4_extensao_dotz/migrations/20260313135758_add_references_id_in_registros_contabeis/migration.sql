BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[registros_contabeis] ADD [reference_1_id_by_business_partner] NVARCHAR(20),
[reference_2_id_by_business_partner] NVARCHAR(30),
[reference_3_id_by_business_partner] NVARCHAR(50);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
