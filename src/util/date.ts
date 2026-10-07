import { format, utcToZonedTime } from "date-fns-tz";

export const BRAZIL_TIMEZONE = "America/Sao_Paulo";

/**
 * Converte uma data (Date ou string ISO) para o fuso horário do Brasil
 * @param date - Data como Date ou string ISO
 * @returns Objeto Date no fuso horário do Brasil
 */
function toBrazilianTimezone(date: Date | string): Date {
  if (!date) {
    throw new Error("Date is required");
  }

  const dateObj = typeof date === "string" ? new Date(date) : date;
  return utcToZonedTime(dateObj, BRAZIL_TIMEZONE);
}

/**
 * Formata uma data para o formato brasileiro completo: "dd/MM/yyyy HH:mm:ss"
 * 
 * REGRA DE USO: Use para timestamps com hora (criadoEm, atualizadoEm, etc.)
 * Converte UTC para timezone brasileiro, preservando a hora correta.
 * 
 * @param date - Data como Date ou string ISO
 * @returns String formatada no fuso horário do Brasil
 */
export function formatDateToBrazilianTimezone(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }

  const zonedDate = toBrazilianTimezone(date);
  return format(zonedDate, "dd/MM/yyyy HH:mm:ss", { timeZone: BRAZIL_TIMEZONE });
}

/**
 * Formata uma data para o formato brasileiro apenas data: "dd/MM/yyyy"
 * 
 * REGRA DE USO: NÃO USE para datas de negócio que vêm do banco (dataEmissao, dataLancamentoContabil, etc.)
 * Esta função converte UTC para timezone brasileiro, causando deslocamento de 1 dia.
 * Use formatDateOnly() para datas de negócio armazenadas em UTC no banco.
 * 
 * @param date - Data como Date ou string ISO
 * @returns String formatada apenas com a data no fuso horário do Brasil
 */
export function formatDateToBrazilianDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }

  const zonedDate = toBrazilianTimezone(date);
  return format(zonedDate, "dd/MM/yyyy", { timeZone: BRAZIL_TIMEZONE });
}

/**
 * Formata uma data para o formato brasileiro apenas hora: "HH:mm:ss"
 * @param date - Data como Date ou string ISO
 * @returns String formatada apenas com a hora no fuso horário do Brasil
 */
export function formatDateToBrazilianTime(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }

  const zonedDate = toBrazilianTimezone(date);
  return format(zonedDate, "HH:mm:ss", { timeZone: BRAZIL_TIMEZONE });
}

/**
 * Formata uma data para ISO string no fuso horário do Brasil
 * @param date - Data como Date ou string ISO
 * @returns String ISO formatada no fuso horário do Brasil
 */
export function formatDateToBrazilianISO(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }

  const zonedDate = toBrazilianTimezone(date);
  return format(zonedDate, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: BRAZIL_TIMEZONE });
}

/**
 * Normaliza uma data para meia-noite (00:00:00) no fuso horário do Brasil
 * Útil para comparações de datas sem considerar hora/timezone
 * @param date - Data como Date ou string ISO
 * @returns Objeto Date normalizado para meia-noite no fuso horário do Brasil
 */
export function normalizeDateToMidnight(date: Date | string): Date {
  if (!date) {
    throw new Error("Date is required");
  }

  const zonedDate = toBrazilianTimezone(date);
  const year = zonedDate.getFullYear();
  const month = zonedDate.getMonth();
  const day = zonedDate.getDate();

  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Normaliza uma data para meia-noite UTC (00:00:00) sem conversão de timezone
 * 
 * REGRA DE USO: SEMPRE use antes de comparar datas que vêm do banco de dados.
 * Normaliza todas as datas para meia-noite UTC, permitindo comparações corretas
 * independente do timezone do servidor.
 * 
 * Exemplo:
 * const dataAtual = normalizeDateToMidnightUTC(new Date());
 * const dataInicio = normalizeDateToMidnightUTC(grupo.dataInicio);
 * const periodoValido = dataAtual >= dataInicio && dataAtual <= dataFim;
 * 
 * @param date - Data como Date ou string ISO
 * @returns Objeto Date normalizado para meia-noite UTC
 */
export function normalizeDateToMidnightUTC(date: Date | string): Date {
  if (!date) {
    throw new Error("Date is required");
  }

  const dateObj = typeof date === "string" ? new Date(date) : date;
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth();
  const day = dateObj.getUTCDate();

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Interpreta uma string de data no formato YYYY-MM-DD como data local do Brasil
 * 
 * REGRA DE USO: Use para converter strings de data vindas de formulários/APIs (formato YYYY-MM-DD).
 * Evita problemas de timezone ao criar Date a partir de strings ISO.
 * 
 * @param dateStr - String de data no formato YYYY-MM-DD
 * @returns Objeto Date criado no timezone local (Brasil)
 */
export function parseDateAsBrazilian(dateStr: string): Date {
  if (!dateStr) {
    throw new Error("Date string is required");
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new TypeError(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Interpreta data e hora no formato ISO local: YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss
 */
export function parseDateTimeAsBrazilian(dateTimeStr: string): Date {
  if (!dateTimeStr) {
    throw new Error("DateTime string is required");
  }

  const trimmed = dateTimeStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (!isoMatch) {
    throw new TypeError(
      `Invalid datetime format: ${dateTimeStr}. Expected YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss`,
    );
  }

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  const hours = Number(isoMatch[4]);
  const minutes = Number(isoMatch[5]);
  const seconds = isoMatch[6] ? Number(isoMatch[6]) : 0;

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds)
  ) {
    throw new TypeError(`Invalid datetime format: ${dateTimeStr}`);
  }

  return new Date(year, month - 1, day, hours, minutes, seconds, 0);
}

/**
 * Interpreta data e hora como UTC: YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss
 */
export function parseDateTimeUtc(dateTimeStr: string): Date {
  if (!dateTimeStr) {
    throw new Error("DateTime string is required");
  }

  const trimmed = dateTimeStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (!isoMatch) {
    throw new TypeError(
      `Invalid datetime format: ${dateTimeStr}. Expected YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss`,
    );
  }

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  const hours = Number(isoMatch[4]);
  const minutes = Number(isoMatch[5]);
  const seconds = isoMatch[6] ? Number(isoMatch[6]) : 0;

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));
}

/**
 * Formata uma data para o formato brasileiro apenas data: "dd/MM/yyyy"
 * 
 * REGRA DE USO: SEMPRE use para datas de negócio (sem hora) que vêm do banco de dados.
 * Exemplos: dataEmissao, dataLancamentoContabil, dataProcessamento, dataIntegracao,
 * dataInicio, dataFim, etc.
 * 
 * Esta função usa UTC diretamente, evitando conversão de timezone que causaria
 * deslocamento de 1 dia. É a função correta para formatar datas de negócio.
 * 
 * NÃO use formatDateToBrazilianDate() para datas de negócio - ela causa deslocamento.
 * 
 * @param date - Data como Date ou string ISO (vinda do banco em UTC)
 * @returns String formatada apenas com a data sem conversão de timezone (dd/MM/yyyy)
 */
export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }

  const dateObj = typeof date === "string" ? new Date(date) : date;
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Formata o mês e o ano de uma data de negócio em português: "JULHO/2026".
 * Usa UTC para evitar que a conversão de fuso altere o mês.
 *
 * @param date - Objeto Date válido
 * @returns Mês por extenso em caixa alta e ano com quatro dígitos
 */
export function formatMonthYear(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("A valid Date is required");
  }

  const months = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];

  return `${months[date.getUTCMonth()]}/${date.getUTCFullYear()}`;
}

/**
 * Converte string de data (YYYY-MM-DD) para Date em UTC (00:00:00.000)
 * 
 * REGRA DE USO: Use para filtros de início de período.
 * Garante que a data seja interpretada como UTC, evitando shift de timezone.
 * 
 * @param dateStr - String de data (YYYY-MM-DD)
 * @returns Date em UTC
 */
export function parseDateForFilter(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Converte string de data (YYYY-MM-DD) para Date em UTC (23:59:59.999)
 * 
 * REGRA DE USO: Use para filtros de fim de período.
 * Garante que a data cubra todo o dia em UTC.
 * 
 * @param dateStr - String de data (YYYY-MM-DD)
 * @returns Date em UTC
 */
export function parseDateForFilterEnd(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export function formatMillisecondsToHHMMSS(ms: number): string {
  const hours = Math.floor(ms / 3_600_000).toString().padStart(2, '0');
  const minutes = Math.floor((ms % 3_600_000) / 60_000).toString().padStart(2, '0');
  const seconds = Math.floor((ms % 60_000) / 1_000).toString().padStart(2, '0');
  const millis = (ms % 1_000).toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

export { toBrazilianTimezone };
