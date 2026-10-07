/**
 * Divide um array em chunks menores para evitar o limite de 2100 parâmetros do SQL Server
 * 
 * SQL Server tem limite de 2100 parâmetros por query. Ao usar WHERE IN com arrays grandes,
 * precisamos dividir em chunks menores e executar múltiplas queries.
 * 
 * @param array - Array a ser dividido
 * @param size - Tamanho de cada chunk (padrão: 2000, deixando margem de segurança)
 * @returns Array de chunks
 */
export function chunkArray<T>(array: T[], size: number = 2000): T[][] {
    if (array.length === 0) {
        return [];
    }
    
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

