/**
 * Gera uma senha aleatória segura
 * @param length - Tamanho da senha (padrão: 12 caracteres)
 * @returns Senha gerada com letras maiúsculas, minúsculas, números e símbolos
 */
export function generatePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%&*+-=?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Garante que a senha tenha pelo menos um caractere de cada tipo
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Preenche o restante com caracteres aleatórios
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralha os caracteres para evitar padrão previsível
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

