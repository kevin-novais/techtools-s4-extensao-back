CREATE NONCLUSTERED INDEX IX_POR1_POS_Pendentes
ON dbo.POR1 (
    DocEntry,
    ItemCode,
    LineNum
)
INCLUDE (
    Dscription,
    Quantity,
    Price,
    LineTotal,
    U_PEDANALYSER,
    U_POS_ID
)
WHERE U_POS_ID IS NOT NULL
  AND U_DocEntryNF IS NULL
  AND LineStatus <> 'C';