/**
 * Formata um telefone brasileiro para o formato internacional com parênteses
 * Formato: +55 (XX) XXXX-XXXX ou +55 (XX) XXXXX-XXXX
 * 
 * @param value - String ou Number contendo o telefone (com ou sem código do país)
 * @returns String formatada no padrão internacional brasileiro
 */
export const formatTelefone = (value: string | number): string => {
    if (!value) return "";
  
    // Converte para string e limpa qualquer caractere não numérico
    let digits = String(value).replace(/\D/g, "");
  
    // Remove o código do país se existir (55)
    if (digits.startsWith("55") && digits.length > 10) {
        digits = digits.substring(2);
    }
  
    // Telefone com 11 dígitos (celular): (XX) XXXXX-XXXX
    if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, "+55 ($1) $2-$3");
    }
  
    // Telefone com 10 dígitos (fixo): (XX) XXXX-XXXX
    if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, "+55 ($1) $2-$3");
    }
  
    // Se não tiver 10 ou 11 dígitos, retorna os dígitos com +55 na frente
    if (digits.length >= 8) {
        return `+55 ${digits}`;
    }
    
    // Se for muito curto, retorna sem formatação
    return digits;
};
