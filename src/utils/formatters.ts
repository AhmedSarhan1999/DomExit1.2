/**
 * DomExit Currency & Math Formatter
 * Strict compliance with Russian financial notation:
 * Separated by non-breaking spaces, ending with ₽
 */
export function formatRubles(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 ₽';
  }
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(amount) + ' ₽';
}

export function formatNumberClean(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0';
  }
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Removes any markdown or latex math artifacts like $\ge 50\%$
 * and formats clean professional Russian legal/banking text
 */
export function cleanMathText(input: string): string {
  return input
    .replace(/\$\\ge\s*(\d+)%\$/g, 'Требуется не менее $1% (≥ $1%)')
    .replace(/\$\\le\s*(\d+)%\$/g, 'Не более $1% (≤ $1%)')
    .replace(/\\ge/g, '≥')
    .replace(/\\le/g, '≤')
    .replace(/\$/g, '');
}
