/**
 * Formata um CEP puro (8 dígitos) vindo do banco de dados.
 * @param value - String ou Number contendo apenas os 8 dígitos do CEP.
 * @returns String formatada no padrão XXXXX-XXX.
 */
export const formatCep = (value: string | number): string => {
    if (!value) return "";
  
    // Converte para string e limpa qualquer caractere não numérico
    const digits = String(value).replaceAll(/\D/g, "");
  
    // Máscara para CEP: 8 dígitos (XXXXX-XXX)
    if (digits.length === 8) {
      return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
    }
  
    // Se não tiver 8 dígitos, retorna os dígitos sem formatação
    return digits;
};
