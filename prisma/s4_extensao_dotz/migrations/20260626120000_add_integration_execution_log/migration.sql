BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[integration_execution_log] (
    [id] INT NOT NULL IDENTITY(1,1),
    [integration_key] NVARCHAR(80) NOT NULL,
    [trigger_type] NVARCHAR(12) NOT NULL,
    [status] NVARCHAR(12) NOT NULL,
    [started_at] DATETIME2 NOT NULL,
    [finished_at] DATETIME2,
    [total_received] INT,
    [total_inserted] INT,
    [total_updated] INT,
    [error_message] NVARCHAR(max),
    [triggered_by] NVARCHAR(120),
    CONSTRAINT [integration_execution_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE INDEX [integration_execution_log_integration_key_started_at_idx] ON [dbo].[integration_execution_log]([integration_key], [started_at] DESC);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
