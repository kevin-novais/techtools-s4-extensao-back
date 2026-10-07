export function resolveDiasPassados(rawValue: unknown): number {
  const diasPassados = Number(rawValue);

  if (Number.isFinite(diasPassados) && diasPassados >= 0) {
    return diasPassados;
  }

  return 7;
}

export function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseExpenseDate(date: string | null | undefined): Date {
  if (!date) {
    return new Date();
  }

  const parts = date.split("-");

  if (parts.length !== 3) {
    return new Date(date);
  }

  const [year, month, day] = parts.map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(date);
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function formatDateWithTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}T00:00:00`;
}
