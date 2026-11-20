import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const STAGING_URL = manifest.staging.apiGatewayUrl;

const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ownerEmail = envVars.BOOTSTRAP_OWNER_EMAIL?.trim();
const ownerPassword = envVars.BOOTSTRAP_OWNER_PASSWORD?.trim();

async function seedData() {
  console.log('--- Logging in as Master Owner on Staging API Gateway ---');
  const loginRes = await fetch(`${STAGING_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }

  const cookie = loginRes.headers.get('set-cookie');
  console.log('Logged in successfully. Auth cookie obtained.');

  const headers = {
    'Content-Type': 'application/json',
    Cookie: cookie,
  };

  // 1. Seed Market Settings
  console.log('\n[1] Seeding market_settings...');
  const marketSettings = {
    id: 'market_parameters',
    cbrKeyRatePercent: 21.0,
    familyMortgageRatePercent: 6.0,
    developerPenaltyPercent: 15.0,
    buyerCommissionPercent: 2.5,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Ahmed Abdallah (Master Owner)',
    districtYieldConfigs: {
      'Приморский район': {
        districtNameRu: 'Приморский район',
        city: 'spb',
        dailyRentPercentOfMarket: 0.05,
        monthlyRentPercentOfMarket: 0.65,
        annualGrowthPercent: 11.5,
        updatedAt: new Date().toISOString(),
      },
      'Московский район': {
        districtNameRu: 'Московский район',
        city: 'spb',
        dailyRentPercentOfMarket: 0.055,
        monthlyRentPercentOfMarket: 0.68,
        annualGrowthPercent: 12.2,
        updatedAt: new Date().toISOString(),
      },
      'Пресненский район': {
        districtNameRu: 'Пресненский район',
        city: 'msk',
        dailyRentPercentOfMarket: 0.07,
        monthlyRentPercentOfMarket: 0.78,
        annualGrowthPercent: 14.5,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  const marketRes = await fetch(`${STAGING_URL}/api/data/market_settings/market_parameters`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(marketSettings),
  });
  console.log('market_settings seed status:', marketRes.status);

  // 2. Seed Company Profile
  console.log('\n[2] Seeding platform_settings (company_legal_profile)...');
  const companyProfile = {
    id: 'company_legal_profile',
    fullName: 'Общество с ограниченной ответственностью «ДОМЭКЗИТ»',
    shortName: 'ООО «ДОМЭКЗИТ» (DomExit LLC)',
    entityType: 'ООО',
    inn: '7814892015',
    kpp: '781401001',
    ogrn: '1267800045120',
    legalAddress: '197342, Россия, г. Санкт-Петербург, Ланское шоссе, д. 14, корп. 1, лит. А, пом. 12-Н',
    postalAddress: '197342, г. Санкт-Петербург, Ланское шоссе, д. 14, корп. 1',
    generalDirector: 'Абдаллах Ахмед Мохамед',
    dpoName: 'Абдаллах Ахмед Мохамед',
    privacyEmail: 'privacy@domexit.ru',
    officialPhone: '+7 (812) 900-00-00',
    bankName: 'Северо-Западный банк ПАО Сбербанк г. Санкт-Петербург',
    bik: '044030653',
    checkingAccount: '40702810955000012345',
    correspondentAccount: '30101810500000000653',
    updatedAt: new Date().toISOString(),
  };

  const compRes = await fetch(`${STAGING_URL}/api/data/platform_settings/company_legal_profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(companyProfile),
  });
  console.log('company_legal_profile seed status:', compRes.status);

  // 3. Seed Employee
  console.log('\n[3] Seeding employees...');
  const employee1 = {
    id: 'emp-1',
    name: 'Алексей Смирнов',
    email: 'amaas9494@gmail.com',
    role: 'Ведущий куратор отдела выходов',
    phone: '+7 (921) 888-11-22',
    telegram: '@domexit_smirnov',
    whatsapp: '+7 (921) 888-11-22',
    maxProfile: '+7 (921) 888-11-22',
    bio: '12 лет в сфере уступки прав по 214-ФЗ и аккредитивов. Экс-руководитель юридического блока строительного холдинга.',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    activeLotsCount: 1,
    closedDealsCount: 18,
    avgSpeedDays: 8.5,
    status: 'active',
    permissions: ['legal_audit', 'packaging', 'matchmaker', 'closing'],
  };

  const empRes = await fetch(`${STAGING_URL}/api/data/employees/emp-1`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(employee1),
  });
  console.log('employee seed status:', empRes.status);

  console.log('\n=== Baseline data successfully seeded on domexit-ydb-staging! ===');
}

seedData().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
