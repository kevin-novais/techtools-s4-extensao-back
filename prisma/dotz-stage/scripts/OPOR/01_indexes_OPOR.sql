CREATE NONCLUSTERED INDEX IX_OPOR_POS_DocDate
ON dbo.OPOR (
    DocDate,
    DocEntry
)
INCLUDE (
    CardCode,
    CardName,
    DocDueDate
)
WHERE U_DOTZ_TIPO = 'TEF'
  AND DocStatus = 'O';

CREATE NONCLUSTERED INDEX IX_OPOR_POS_DocDueDate
ON dbo.OPOR (
    DocDueDate,
    DocEntry
)
INCLUDE (
    CardCode,
    CardName,
    DocDate
)
WHERE U_DOTZ_TIPO = 'TEF'
  AND DocStatus = 'O';