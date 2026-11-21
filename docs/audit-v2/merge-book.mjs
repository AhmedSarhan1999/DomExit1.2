import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const auditDir = __dirname;
const rootDir = path.resolve(auditDir, '../..');
const outputFile = path.join(rootDir, 'docs', 'DOMEXIT_MASTER_BOOK_V2.md');

const chapters = [
  { file: '01_EXECUTIVE_AND_CLOUD_TOPOLOGY.md', title: 'Глава 1: Исполнительное резюме и облачная топология DomExit 2.0' },
  { file: '02_DATABASE_SCHEMA_AND_DAL.md', title: 'Глава 2: Схема базы данных YDB, Data Access Layer (DAL) и архитектура сохранности' },
  { file: '03_BACKEND_API_AND_RBAC_MATRIX.md', title: 'Глава 3: Спецификация Backend API и ролевая матрица доступа (RBAC)' },
  { file: '04_AUTH_SESSIONS_AND_STORAGE.md', title: 'Глава 4: Аутентификация, сессии и объектное хранилище S3' },
  { file: '05_TELEGRAM_OPERATING_SYSTEM.md', title: 'Глава 5: Операционная система Telegram (Telegram OS)' },
  { file: '06_FRONTEND_PAGES_AND_USER_JOURNEYS.md', title: 'Глава 6: Фронтенд-архитектура, страницы и пользовательские сценарии (User Journeys)' },
  { file: '07_FINANCIAL_LOGIC_AND_BUSINESS_RULES.md', title: 'Глава 7: Финансовый движок, математические модели и бизнес-правила' },
  { file: '08_VALIDATION_QUOTAS_AND_ANOMALY_AUDIT.md', title: 'Глава 8: Аудит валидации данных, ролевых квот и обнаружения аномалий' },
  { file: '09_PHASE5_PLUS_INTEGRATION_BLUEPRINT.md', title: 'Глава 9: Стратегический план интеграции Фазы 5 и развития платформы' },
  { file: '10_TECH_DEBT_AND_CLEANUP_LEDGER.md', title: 'Глава 10: Реестр технического долга, оптимизации и подготовки к Фазе 5' },
];

console.log('Начало сборки Master Architecture & Audit Book V2...');

let combinedContent = '';

// Master Header
combinedContent += `# КНИГА АРХИТЕКТУРНОГО И ОПЕРАЦИОННОГО АУДИТА ПЛАТФОРМЫ DOMEXIT (ВЕРСИЯ 2.0)\n\n`;
combinedContent += `> **Статус документа:** Master Architecture & Security Audit Book (Single Source of Truth)\n`;
combinedContent += `> **Дата выпуска:** 21 ноября 2026 года\n`;
combinedContent += `> **Юрисдикция инфраструктуры:** 100% Российская Федерация (Yandex Cloud, Москва, ru-central1)\n`;
combinedContent += `> **Соответствие нормативным требованиям:** 152-ФЗ «О персональных данных», 38-ФЗ «О рекламе», 214-ФЗ «Об участии в долевом строительстве»\n\n`;

combinedContent += `## Оглавление (Table of Contents)\n\n`;

chapters.forEach((ch, idx) => {
  const num = idx + 1;
  const anchor = `glava-${num}`;
  combinedContent += `${num}. [${ch.title}](#${anchor})\n`;
});

combinedContent += `\n---\n\n`;

// Process each chapter
chapters.forEach((ch, idx) => {
  const num = idx + 1;
  const filePath = path.join(auditDir, ch.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Файл главы не найден: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  // Add chapter anchor for TOC
  combinedContent += `<a name="glava-${num}"></a>\n\n`;
  combinedContent += raw;
  combinedContent += `\n\n---\n\n`;
});

// Secrets Check before writing
const forbiddenTokens = [
  'y0_AgAAAA', // Yandex OAuth token prefix
  'AQVN', // Yandex SA key prefix
  '9086206027:', // Telegram token prod
  '9045097336:', // Telegram token staging
];

for (const token of forbiddenTokens) {
  if (combinedContent.includes(token)) {
    throw new Error(`ОШИБКА БЕЗОПАСНОСТИ: В скомпилированном тексте обнаружен секретный токен: ${token}`);
  }
}

// Write output file
fs.writeFileSync(outputFile, combinedContent, 'utf-8');

// Compute statistics
const totalLines = combinedContent.split('\n').length;
const totalWords = combinedContent.trim().split(/\s+/).length;
const estimatedPages = Math.round(totalWords / 350);

console.log('✅ Сборка успешно завершена!');
console.log(`📁 Выходной файл: ${outputFile}`);
console.log(`📊 Статистика книги:`);
console.log(`   - Глав: ${chapters.length}`);
console.log(`   - Всего строк: ${totalLines.toLocaleString('ru-RU')}`);
console.log(`   - Всего слов: ${totalWords.toLocaleString('ru-RU')}`);
console.log(`   - Расчетное количество страниц: ~${estimatedPages} стр.`);
