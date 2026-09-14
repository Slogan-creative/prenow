/** Shared validation for salon-management server actions. */
export function requiredName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Nome obbligatorio.');
  const name = value.trim();
  if (!name || name.length > 120) throw new Error('Il nome deve contenere da 1 a 120 caratteri.');
  return name;
}

export function serviceDuration(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Durata non valida.');
  const minutes = Number(value);
  if (minutes < 15 || minutes > 1440 || minutes % 15 !== 0) {
    throw new Error('La durata deve essere un multiplo di 15 minuti, tra 15 e 1440.');
  }
  return minutes;
}

/** Parse decimal currency without floating-point rounding or silent truncation. */
export function servicePrice(value: unknown): number | null {
  if (typeof value !== 'string') throw new Error('Prezzo non valido.');
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Prezzo non valido.');
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > 10000000) throw new Error('Il prezzo massimo è 100.000 euro.');
  return cents;
}

export function entityId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Identificativo non valido.');
  }
  return value;
}

export function assignmentIds(values: unknown[]): string[] {
  return [...new Set(values.map(entityId))];
}
