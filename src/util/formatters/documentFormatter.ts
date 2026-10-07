/**
 * Formata um CPF ou CNPJ puro vindo do banco de dados.
 * @param value - String ou Number contendo apenas os dígitos.
 * @returns String formatada com pontos, traço e barra.
 */
export const formatCpfCnpj = (value: string | number): string => {
    if (!value) return "";
  
    // Converte para string e limpa qualquer caractere não numérico
    const digits = String(value).replace(/\D/g, "");
  
    // Máscara para CPF: 11 dígitos
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
  
    // Máscara para CNPJ: 14 dígitos
    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
  
    
    return digits;
  };