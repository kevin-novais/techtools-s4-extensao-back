-- CreateSequence
IF NOT EXISTS (
    SELECT 1
    FROM sys.sequences seq
    WHERE seq.name = 'SeqProtocolo'
)
BEGIN
    CREATE SEQUENCE SeqProtocolo
        AS BIGINT
        START WITH 1
        INCREMENT BY 1;
END;

-- CreateSequence
IF NOT EXISTS (
    SELECT 1
    FROM sys.sequences seq
    WHERE seq.name = 'vExpensesSeqProtocolo'
)
BEGIN
    CREATE SEQUENCE vExpensesSeqProtocolo
        AS BIGINT
        START WITH 1
        INCREMENT BY 1;
END;