/**
 * backend/src/modules/legal-core/russianRealEstateDocParser.ts
 *
 * Deterministic Russian Real Estate Document Parser (0 ₽ Cost).
 * Parses OCR extracted text into structured fields:
 * - Cadastral numbers, DDU number & date, area, floor, pricing & payment.
 * - Risk flag scanner (maternal capital, mortgage encumbrance, developer consent fees, arrest/prohibition).
 * - Cross-check against declared lot values (flagging > 3% deviation).
 */

export interface RiskFlagItem {
  code:
    | 'maternal_capital'
    | 'mortgage_encumbrance'
    | 'developer_consent_fee'
    | 'arrest_or_prohibition'
    | 'installment_balance'
    | 'price_mismatch';
  severity: 'high' | 'medium' | 'info';
  labelRu: string;
  pageNumber: number;
  excerpt: string;
}

export interface CrossCheckWarning {
  field: string;
  declaredValue: string;
  extractedValue: string;
  messageRu: string;
}

export interface ExtractedRealEstateFields {
  detectedDocType: 'ddu_contract' | 'developer_payment_cert' | 'rosreestr_extract' | 'buyer_proof' | 'other';
  dduNumber?: string;
  dduDate?: string;
  cadastralNumber?: string;
  areaSqm?: number;
  floor?: number;
  fullPriceRub?: number;
  paidAmountRub?: number;
  developerName?: string;
  developerInn?: string;
  escrowBankName?: string;
  registrationNumber?: string;
  riskFlags: RiskFlagItem[];
  crossCheckWarnings: CrossCheckWarning[];
  confidenceScore: number; // 0..100
}

interface PageInput {
  pageNumber: number;
  fullText: string;
}

function cleanExcerpt(text: string, matchIdx: number, matchLen: number): string {
  const start = Math.max(0, matchIdx - 50);
  const end = Math.min(text.length, matchIdx + matchLen + 70);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet.slice(0, 180);
}

function parseRussianNumber(str: string): number | undefined {
  if (!str) return undefined;
  const clean = str.replace(/\s+|[ ]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses raw text from pages into structured real estate fields.
 */
export function parseRussianRealEstateDoc(pages: PageInput[]): ExtractedRealEstateFields {
  const allText = pages.map((p) => p.fullText).join('\n\n');

  let detectedDocType: ExtractedRealEstateFields['detectedDocType'] = 'other';
  if (/договор[а-я\s]*участия[а-я\s]*в[а-я\s]*долевом|дду/i.test(allText)) {
    detectedDocType = 'ddu_contract';
  } else if (/выписк[а-я\s]*из[а-я\s]*егрн|единый[а-я\s]*государственный[а-я\s]*реестр/i.test(allText)) {
    detectedDocType = 'rosreestr_extract';
  } else if (/справк[а-я\s]*об[а-я\s]*оплат|акт[а-я\s]*сверк|подтверждени[а-я\s]*расчет/i.test(allText)) {
    detectedDocType = 'developer_payment_cert';
  }

  // 1. Cadastral Number: XX:XX:XXXXXXX:XXXX
  let cadastralNumber: string | undefined;
  const cadMatch = allText.match(/\b(\d{2}:\d{2}:\d{6,7}:\d+)\b/);
  if (cadMatch) {
    cadastralNumber = cadMatch[1];
  }

  // 2. DDU Number & Date
  let dduNumber: string | undefined;
  let dduDate: string | undefined;

  const dduNumMatch = allText.match(
    /(?:договор[а-я\s]*участия[а-я\s]*в[а-я\s]*долевом[а-я\s]*строительстве|ДДУ)\s*(?:№|N|номер)?\s*([A-Za-zА-Яа-я0-9\-\_\/]+)/i
  ) || allText.match(/(?:Договор|№|N)\s*([A-Za-z0-9А-Яа-я\-\_\/]{3,25})\s*(?:от|\/)/i);
  if (dduNumMatch) {
    dduNumber = dduNumMatch[1].trim();
  }

  const dduDateMatch = allText.match(
    /(?:от\s*)?(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4}|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4})/i
  );
  if (dduDateMatch) {
    dduDate = dduDateMatch[1].trim();
  }

  // 3. Area (кв. м)
  let areaSqm: number | undefined;
  const areaMatch =
    allText.match(
      /(?:общая\s+площадь|проектная\s+площадь|площадь\s+квартиры|площадью)[\s\:\-]+(\d+[\.,]\d+|\d+)\s*(?:кв\.?\s*м|м2|м²)/i
    ) || allText.match(/(\d+[\.,]\d+)\s*(?:кв\.?\s*м|м2|м²)/i);
  if (areaMatch) {
    areaSqm = parseRussianNumber(areaMatch[1]);
  }

  // 4. Floor
  let floor: number | undefined;
  const floorMatch = allText.match(/(?:этаж|на\s+этаже)[\s\:\-]+(\d+)/i);
  if (floorMatch) {
    floor = parseInt(floorMatch[1], 10);
  }

  // 5. Full Price (Цена договора)
  let fullPriceRub: number | undefined;
  const fullPriceMatch = allText.match(
    /(?:цена\s+(?:настоящего\s+)?договора(?:\s+составляет)?|стоимость\s+(?:настоящего\s+)?договора(?:\s+составляет)?|общая\s+цена|цена\s+квартиры|стоимость\s+квартиры)[\s\:\-]+(\d[\d\s\xa0]*[\.,]?\d*)\s*(?:руб|₽|\(|$)/i
  );
  if (fullPriceMatch) {
    fullPriceRub = parseRussianNumber(fullPriceMatch[1]);
  }

  // 6. Paid Amount (Фактически оплачено)
  let paidAmountRub: number | undefined;
  const paidMatch = allText.match(
    /(?:оплаченная\s+сумма(?:\s+на\s+дату[^\:]*)?|оплачено|внесено|фактически\s+оплачено|размер\s+оплаченных\s+средств|сумма\s+платежа|внесено\s+денежных\s+средств)[\s\:\-]+(\d[\d\s\xa0]*[\.,]?\d*)\s*(?:руб|₽|\(|$)/i
  );
  if (paidMatch) {
    paidAmountRub = parseRussianNumber(paidMatch[1]);
  }

  // 7. Developer Name & INN
  let developerName: string | undefined;
  let developerInn: string | undefined;

  const devMatch = allText.match(
    /(?:застройщик|общество\s+с\s+ограниченной\s+ответственностью|ООО|АО|ПАО|специализированный\s+застройщик|СЗ)[\s\"«]+([^\"»\n]{3,60})[\"»]/i
  );
  if (devMatch) {
    developerName = devMatch[1].trim();
  }

  const innMatch = allText.match(/(?:ИНН\s*[:\s]*(\d{10}))\b/i);
  if (innMatch) {
    developerInn = innMatch[1];
  }

  // 8. Escrow Bank
  let escrowBankName: string | undefined;
  const escrowMatch =
    allText.match(
      /(?:эскроу[\-\s]*банк|расчетный\s+эскроу[\-\s]*банк|банк\s+эскроу|банк|эскроу[\-\s]*агент|счет\s+эскроу\s+в)[\s\:\-]+(ПАО\s+[А-Яа-яA-Za-z]+|АО\s+[А-Яа-яA-Za-z]+|ООО\s+[«\"][^»\"]+[»\"]|[«\"][^»\"]+[»\"]|Сбербанк|ВТБ|Альфа[\-\s]*Банк|ДОМ\.РФ)/i
    ) || allText.match(/\b(Сбербанк|ВТБ|Альфа\-Банк|Банк\s+ДОМ\.РФ|Газпромбанк|Совкомбанк)\b/i);
  if (escrowMatch) {
    escrowBankName = escrowMatch[1].replace(/[\"«»]/g, '').trim();
  }

  // 9. Registration Number in Rosreestr
  let registrationNumber: string | undefined;
  const regMatch = allText.match(
    /(?:номер\s+регистрации|государственная\s+регистрация|запись\s+в\s+ЕГРН)[\s\:\-]+([0-9\:\/\-]{10,40})/i
  );
  if (regMatch) {
    registrationNumber = regMatch[1].trim();
  }

  // =========================================================================
  // Risk Flags Scanner (Page-by-page with excerpts)
  // =========================================================================
  const riskFlags: RiskFlagItem[] = [];

  const RISK_DEFINITIONS = [
    {
      code: 'maternal_capital' as const,
      severity: 'high' as const,
      labelRu: 'Обнаружено упоминание материнского капитала',
      regex: /(?:материнск[а-яё]*(?:\s+семейн[а-яё]*)?\s+капитал[а-яё]*|семейн[а-яё]*\s+капитал[а-яё]*|256-ФЗ|СФР|ПФР)/iu,
    },
    {
      code: 'mortgage_encumbrance' as const,
      severity: 'medium' as const,
      labelRu: 'Обнаружено ипотечное обременение / залог',
      regex: /(?:кредитн[а-яё]*\s+договор[а-яё]*|ипотек[а-яё]*|залог\s+в\s+силу\s+закона|обременени[а-яё]*)/iu,
    },
    {
      code: 'developer_consent_fee' as const,
      severity: 'medium' as const,
      labelRu: 'Упоминание согласия застройщика или комиссии за уступку',
      regex: /(?:согласи[а-яё]*\s+застройщик[а-яё]*|комисси[а-яё]*\s+уступк[а-яё]*|вознаграждени[а-яё]*\s+застройщик[а-яё]*|плата\s+за\s+перевод\s+долга)/iu,
    },
    {
      code: 'arrest_or_prohibition' as const,
      severity: 'high' as const,
      labelRu: 'Арест или запрет регистрационных действий',
      regex: /(?:арест|запрет[а-яё]*\s+регистрацион[а-яё]*|пристав[а-яё]*|ФССП)/iu,
    },
  ];

  for (const page of pages) {
    for (const def of RISK_DEFINITIONS) {
      const match = page.fullText.match(def.regex);
      if (match && match.index !== undefined) {
        // Prevent duplicate risk flag codes across pages if already flagged
        const alreadyFlagged = riskFlags.some((rf) => rf.code === def.code && rf.pageNumber === page.pageNumber);
        if (!alreadyFlagged) {
          riskFlags.push({
            code: def.code,
            severity: def.severity,
            labelRu: def.labelRu,
            pageNumber: page.pageNumber,
            excerpt: cleanExcerpt(page.fullText, match.index, match[0].length),
          });
        }
      }
    }
  }

  // Calculate Confidence Score (0..100)
  let confidence = 30;
  if (cadastralNumber) confidence += 20;
  if (dduNumber) confidence += 15;
  if (areaSqm && areaSqm > 10) confidence += 15;
  if (fullPriceRub && fullPriceRub > 1000000) confidence += 15;
  if (paidAmountRub !== undefined) confidence += 5;
  confidence = Math.min(100, confidence);

  return {
    detectedDocType,
    dduNumber,
    dduDate,
    cadastralNumber,
    areaSqm,
    floor,
    fullPriceRub,
    paidAmountRub,
    developerName,
    developerInn,
    escrowBankName,
    registrationNumber,
    riskFlags,
    crossCheckWarnings: [],
    confidenceScore: confidence,
  };
}

/**
 * Runs cross-check comparison against declared lot parameters.
 * Flags deviations > 3% in area, DDU price, or cash paid.
 */
export function runCrossCheck(
  extracted: ExtractedRealEstateFields,
  lot: any
): CrossCheckWarning[] {
  const warnings: CrossCheckWarning[] = [];
  if (!lot) return warnings;

  // 1. Area Check
  if (lot.areaM2 && extracted.areaSqm) {
    const diff = Math.abs(lot.areaM2 - extracted.areaSqm);
    const pct = (diff / lot.areaM2) * 100;
    if (pct > 3.0) {
      warnings.push({
        field: 'areaM2',
        declaredValue: `${lot.areaM2} м²`,
        extractedValue: `${extracted.areaSqm} м²`,
        messageRu: `Расхождение в площади: заявлено ${lot.areaM2} м², в документе ${extracted.areaSqm} м² (отклонение ${pct.toFixed(1)}%).`,
      });
    }
  }

  // 2. DDU Price Check
  const declaredDdu = lot.dduContractPrice || lot.originalPurchasePriceRub;
  if (declaredDdu && extracted.fullPriceRub) {
    const diff = Math.abs(declaredDdu - extracted.fullPriceRub);
    const pct = (diff / declaredDdu) * 100;
    if (pct > 3.0) {
      warnings.push({
        field: 'dduContractPrice',
        declaredValue: `${declaredDdu.toLocaleString('ru-RU')} ₽`,
        extractedValue: `${extracted.fullPriceRub.toLocaleString('ru-RU')} ₽`,
        messageRu: `Расхождение в цене договора ДДУ: заявлено ${declaredDdu.toLocaleString('ru-RU')} ₽, в документе ${extracted.fullPriceRub.toLocaleString('ru-RU')} ₽ (отклонение ${pct.toFixed(1)}%).`,
      });
    }
  }

  // 3. Paid Amount Check
  const declaredPaid = lot.cashPaidBySeller;
  if (declaredPaid && extracted.paidAmountRub) {
    const diff = Math.abs(declaredPaid - extracted.paidAmountRub);
    const pct = (diff / declaredPaid) * 100;
    if (pct > 3.0) {
      warnings.push({
        field: 'cashPaidBySeller',
        declaredValue: `${declaredPaid.toLocaleString('ru-RU')} ₽`,
        extractedValue: `${extracted.paidAmountRub.toLocaleString('ru-RU')} ₽`,
        messageRu: `Расхождение в оплаченной сумме: заявлено ${declaredPaid.toLocaleString('ru-RU')} ₽, в документе ${extracted.paidAmountRub.toLocaleString('ru-RU')} ₽ (отклонение ${pct.toFixed(1)}%).`,
      });
    }
  }

  return warnings;
}
