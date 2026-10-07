import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizarTelefone(
  valor: string
): {
  e164: string;
  nacional: string;
  internacional: string;
  pais: string;
  tipo?: string;
} {
  const phone = parsePhoneNumberFromString(valor);

  if (!phone?.isValid()) {
    throw new Error('Telefone inválido');
  }

  return {
    e164: phone.format('E.164'),
    nacional: phone.formatNational(),
    internacional: phone.formatInternational(),
    pais: phone.country ?? '',
    tipo: phone.getType()
  };
}


