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

/**
 * Normalizes developer names across the entire platform.
 * Strips legal forms (ООО, ПАО, АО, ГК, Группа), quotes, extra spaces,
 * and canonicalizes major Russian real estate developers.
 */
export function normalizeDeveloperName(name: string | undefined | null): string {
  if (!name) return '';
  let s = name.toLowerCase().replace(/ё/g, 'е').trim();
  s = s.replace(/[«»"'`,\.\-\(\)\/]/g, ' ');

  const legalTokens = [
    'группа компаний',
    'группа',
    'девелопмент',
    'холдинг',
    'недвижимость',
    'ооо',
    'пао',
    'зао',
    'оао',
    'гк',
    'ск',
    'ао',
    'development',
    'group',
    'holding',
  ];

  for (const token of legalTokens) {
    const regex = new RegExp(`(^|\\s)${token}(\\s|$)`, 'g');
    s = s.replace(regex, ' ');
  }

  s = s.replace(/\s+/g, ' ').trim();

  // Canonical mapping for top developers
  if (s === 'лср' || s.includes('лср')) return 'лср';
  if (s === 'пик' || s.includes('пик')) return 'пик';
  if (s === 'самолет' || s.includes('самолет')) return 'самолет';
  if (s === 'сетл' || s === 'setl' || s.includes('setl') || s.includes('сетл')) return 'setl group';
  if (s === 'фск' || s.includes('фск')) return 'фск';
  if (s === 'эталон' || s.includes('эталон')) return 'эталон';
  if (s === 'а101' || s.includes('а101') || s.includes('a101')) return 'а101';
  if (s === 'брусника' || s.includes('брусника')) return 'брусника';
  if (s === 'главстрой' || s.includes('главстрой')) return 'главстрой';
  if (s === 'rbi' || s === 'рби' || s.includes('rbi') || s.includes('рби')) return 'rbi';
  if (s === 'квс' || s.includes('квс')) return 'квс';
  if (s === 'пионер' || s.includes('пионер')) return 'пионер';
  if (s === 'mr' || s.includes('mr') || s.includes('мр')) return 'mr group';
  if (s === 'sminex' || s.includes('sminex') || s.includes('смайнекс')) return 'sminex';
  if (s === 'донстрой' || s.includes('донстрой')) return 'донстрой';

  return s;
}
