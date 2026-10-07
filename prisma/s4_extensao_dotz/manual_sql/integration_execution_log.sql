IF OBJECT_ID('dbo.integration_execution_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.integration_execution_log (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_integration_execution_log PRIMARY KEY,
        integration_key NVARCHAR(80)  NOT NULL,
        trigger_type    NVARCHAR(12)  NOT NULL,
        status          NVARCHAR(12)  NOT NULL,
        started_at      DATETIME2     NOT NULL,
        finished_at     DATETIME2     NULL,
        total_received  INT           NULL,
        total_inserted  INT           NULL,
        total_updated   INT           NULL,
        error_message   NVARCHAR(MAX) NULL,
        triggered_by    NVARCHAR(120) NULL
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_integration_execution_log_key_started'
      AND object_id = OBJECT_ID('dbo.integration_execution_log')
)
BEGIN
    CREATE INDEX IX_integration_execution_log_key_started
        ON dbo.integration_execution_log (integration_key, started_at DESC);
END;
