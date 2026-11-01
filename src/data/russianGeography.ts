import { Lot, MetroStationInfo, RentalPotentialInfo, RussianCityCode } from '../types';

export interface DistrictGeoConfig {
  nameRu: string;
  nameEn: string;
  defaultStreetRu: string;
  coordinates: { lat: number; lng: number };
  avgMarketPricePerM2: number;
  avgMonthlyRentPerM2: number;
  avgDailyRentPerM2: number;
  metroStations: MetroStationInfo[];
}

export interface RussianRegionConfig {
  code: RussianCityCode;
  labelRu: string;
  labelEn: string;
  shortLabelRu: string;
  shortLabelEn: string;
  center: { lat: number; lng: number };
  defaultZoom: number;
  majorDevelopers: string[];
  districts: DistrictGeoConfig[];
}

export const RUSSIAN_REGIONS: RussianRegionConfig[] = [
  {
    code: 'spb',
    labelRu: 'Санкт-Петербург и Ленинградская область',
    labelEn: 'Saint Petersburg & Leningrad Oblast',
    shortLabelRu: 'Санкт-Петербург и ЛО',
    shortLabelEn: 'St. Petersburg',
    center: { lat: 59.955, lng: 30.315 },
    defaultZoom: 11,
    majorDevelopers: ['Setl Group', 'Группа ЛСР', 'ЦДС', 'КВС', 'Эталон', 'Главстрой СПб'],
    districts: [
      {
        nameRu: 'Приморский район',
        nameEn: 'Primorsky District',
        defaultStreetRu: 'Комендантский пр., уч. 4',
        coordinates: { lat: 60.0312, lng: 30.2328 },
        avgMarketPricePerM2: 265000,
        avgMonthlyRentPerM2: 1150,
        avgDailyRentPerM2: 75,
        metroStations: [
          { name: 'м. Комендантский пр.', lineColor: '#702785', travelTimeText: '12 мин. транспортом', mode: 'drive' },
          { name: 'м. Старая Деревня', lineColor: '#702785', travelTimeText: '15 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Московский район',
        nameEn: 'Moskovsky District',
        defaultStreetRu: 'Пулковское шоссе, д. 36',
        coordinates: { lat: 59.8405, lng: 30.3245 },
        avgMarketPricePerM2: 310000,
        avgMonthlyRentPerM2: 1350,
        avgDailyRentPerM2: 92,
        metroStations: [
          { name: 'м. Звёздная', lineColor: '#0078C9', travelTimeText: '10 мин. пешком', mode: 'walk' },
          { name: 'м. Московская', lineColor: '#0078C9', travelTimeText: '8 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Невский район',
        nameEn: 'Nevsky District',
        defaultStreetRu: 'Октябрьская набережная, д. 34',
        coordinates: { lat: 59.8984, lng: 30.4512 },
        avgMarketPricePerM2: 278000,
        avgMonthlyRentPerM2: 1180,
        avgDailyRentPerM2: 80,
        metroStations: [
          { name: 'м. Проспект Большевиков', lineColor: '#EA7125', travelTimeText: '11 мин. транспортом', mode: 'drive' },
          { name: 'м. Улица Дыбенко', lineColor: '#EA7125', travelTimeText: '14 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Василеостровский район',
        nameEn: 'Vasileostrovsky District',
        defaultStreetRu: 'Намывные территории В.О., б-р Головнина',
        coordinates: { lat: 59.9418, lng: 30.2071 },
        avgMarketPricePerM2: 335000,
        avgMonthlyRentPerM2: 1480,
        avgDailyRentPerM2: 105,
        metroStations: [
          { name: 'м. Приморская', lineColor: '#009A49', travelTimeText: '9 мин. транспортом', mode: 'drive' },
          { name: 'м. Горный институт', lineColor: '#EA7125', travelTimeText: '12 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Петроградский район',
        nameEn: 'Petrogradsky District',
        defaultStreetRu: 'Петровский пр., д. 26',
        coordinates: { lat: 59.9631, lng: 30.2682 },
        avgMarketPricePerM2: 465000,
        avgMonthlyRentPerM2: 1950,
        avgDailyRentPerM2: 140,
        metroStations: [
          { name: 'м. Чкаловская', lineColor: '#702785', travelTimeText: '8 мин. пешком', mode: 'walk' },
          { name: 'м. Крестовский остров', lineColor: '#702785', travelTimeText: '11 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Выборгский район',
        nameEn: 'Vyborgsky District',
        defaultStreetRu: 'пр. Энгельса, д. 107',
        coordinates: { lat: 60.0251, lng: 30.3264 },
        avgMarketPricePerM2: 258000,
        avgMonthlyRentPerM2: 1120,
        avgDailyRentPerM2: 72,
        metroStations: [
          { name: 'м. Озерки', lineColor: '#0078C9', travelTimeText: '7 мин. пешком', mode: 'walk' },
          { name: 'м. Удельная', lineColor: '#0078C9', travelTimeText: '10 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Всеволожский р-н (ЛО)',
        nameEn: 'Vsevolozhsky District (LO)',
        defaultStreetRu: 'г. Мурино, Воронцовский б-р, д. 18',
        coordinates: { lat: 60.0562, lng: 30.4315 },
        avgMarketPricePerM2: 185000,
        avgMonthlyRentPerM2: 890,
        avgDailyRentPerM2: 58,
        metroStations: [
          { name: 'м. Девяткино', lineColor: '#D6083B', travelTimeText: '10 мин. пешком', mode: 'walk' },
        ],
      },
    ],
  },
  {
    code: 'msk',
    labelRu: 'Москва и Московская область',
    labelEn: 'Moscow & Moscow Oblast',
    shortLabelRu: 'Москва и МО',
    shortLabelEn: 'Moscow',
    center: { lat: 55.7512, lng: 37.6184 },
    defaultZoom: 11,
    majorDevelopers: ['ПИК', 'Самолет', 'Донстрой', 'MR Group', 'ФСК', 'Level Group', 'Sminex'],
    districts: [
      {
        nameRu: 'Пресненский район',
        nameEn: 'Presnensky District',
        defaultStreetRu: 'Шелепихинская наб., вл. 34',
        coordinates: { lat: 55.7618, lng: 37.5234 },
        avgMarketPricePerM2: 545000,
        avgMonthlyRentPerM2: 2450,
        avgDailyRentPerM2: 165,
        metroStations: [
          { name: 'м. Шелепиха', lineColor: '#82C0C0', travelTimeText: '6 мин. пешком', mode: 'walk' },
          { name: 'м. Деловой центр', lineColor: '#0078BE', travelTimeText: '8 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Раменки',
        nameEn: 'Ramenki District',
        defaultStreetRu: 'Мичуринский пр-т, вл. 45',
        coordinates: { lat: 55.7005, lng: 37.4981 },
        avgMarketPricePerM2: 515000,
        avgMonthlyRentPerM2: 2250,
        avgDailyRentPerM2: 150,
        metroStations: [
          { name: 'м. Раменки', lineColor: '#FFD702', travelTimeText: '5 мин. пешком', mode: 'walk' },
          { name: 'м. Мичуринский проспект', lineColor: '#FFD702', travelTimeText: '9 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Арбат',
        nameEn: 'Arbat District',
        defaultStreetRu: 'Смоленская пл., д. 7',
        coordinates: { lat: 55.7485, lng: 37.5835 },
        avgMarketPricePerM2: 890000,
        avgMonthlyRentPerM2: 3400,
        avgDailyRentPerM2: 240,
        metroStations: [
          { name: 'м. Смоленская', lineColor: '#0078BE', travelTimeText: '5 мин. пешком', mode: 'walk' },
          { name: 'м. Арбатская', lineColor: '#0078BE', travelTimeText: '8 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Даниловский район',
        nameEn: 'Danilovsky District',
        defaultStreetRu: 'проспект Лихачёва, д. 14',
        coordinates: { lat: 55.6987, lng: 37.6435 },
        avgMarketPricePerM2: 455000,
        avgMonthlyRentPerM2: 2050,
        avgDailyRentPerM2: 138,
        metroStations: [
          { name: 'м. ЗИЛ (МЦК)', lineColor: '#EE2737', travelTimeText: '4 мин. пешком', mode: 'walk' },
          { name: 'м. Технопарк', lineColor: '#2DBE2C', travelTimeText: '9 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Южнопортовый район',
        nameEn: 'Yuzhnoportovy District',
        defaultStreetRu: 'Волгоградский пр-т, д. 32',
        coordinates: { lat: 55.7192, lng: 37.6865 },
        avgMarketPricePerM2: 385000,
        avgMonthlyRentPerM2: 1750,
        avgDailyRentPerM2: 118,
        metroStations: [
          { name: 'м. Волгоградский проспект', lineColor: '#800080', travelTimeText: '5 мин. пешком', mode: 'walk' },
          { name: 'м. Дубровка', lineColor: '#99CC00', travelTimeText: '11 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Хорошёво-Мнёвники',
        nameEn: 'Khoroshevo-Mnevniki',
        defaultStreetRu: 'Карамышевская наб., д. 52',
        coordinates: { lat: 55.7745, lng: 37.4682 },
        avgMarketPricePerM2: 470000,
        avgMonthlyRentPerM2: 2100,
        avgDailyRentPerM2: 140,
        metroStations: [
          { name: 'м. Народное Ополчение', lineColor: '#82C0C0', travelTimeText: '7 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Красногорск (МО)',
        nameEn: 'Krasnogorsk (MO)',
        defaultStreetRu: 'Ильинское шоссе, Павшинская пойма',
        coordinates: { lat: 55.8165, lng: 37.3672 },
        avgMarketPricePerM2: 265000,
        avgMonthlyRentPerM2: 1280,
        avgDailyRentPerM2: 85,
        metroStations: [
          { name: 'м. Мякинино', lineColor: '#0078BE', travelTimeText: '10 мин. пешком', mode: 'walk' },
          { name: 'МЦД Пенягино', lineColor: '#E31E24', travelTimeText: '7 мин. пешком', mode: 'walk' },
        ],
      },
    ],
  },
  {
    code: 'sochi',
    labelRu: 'Сочи и Краснодарский край',
    labelEn: 'Sochi & Krasnodar Krai',
    shortLabelRu: 'Сочи и Краснодар',
    shortLabelEn: 'Sochi & Krasnodar',
    center: { lat: 43.5855, lng: 39.7231 },
    defaultZoom: 11,
    majorDevelopers: ['Неометрия', 'ГК ТОЧНО', 'AVA Group', 'DOGMA', 'ССК'],
    districts: [
      {
        nameRu: 'Центральный район Сочи',
        nameEn: 'Central Sochi',
        defaultStreetRu: 'Курортный пр-т, д. 75',
        coordinates: { lat: 43.5815, lng: 39.7254 },
        avgMarketPricePerM2: 520000,
        avgMonthlyRentPerM2: 2200,
        avgDailyRentPerM2: 210,
        metroStations: [
          { name: 'Морской вокзал Сочи', lineColor: '#0EA5E9', travelTimeText: '7 мин. пешком', mode: 'walk' },
          { name: 'Ж/Д вокзал Сочи (Ласточка)', lineColor: '#EF4444', travelTimeText: '9 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Сириус (Федеральная территория)',
        nameEn: 'Sirius Federal Territory',
        defaultStreetRu: 'Олимпийский пр-т, д. 38',
        coordinates: { lat: 43.4052, lng: 39.9548 },
        avgMarketPricePerM2: 610000,
        avgMonthlyRentPerM2: 2500,
        avgDailyRentPerM2: 245,
        metroStations: [
          { name: 'ст. Имеретинский курорт', lineColor: '#0EA5E9', travelTimeText: '6 мин. пешком', mode: 'walk' },
          { name: 'Аэропорт Сочи (AER)', lineColor: '#6366F1', travelTimeText: '12 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Хостинский район',
        nameEn: 'Khostinsky District',
        defaultStreetRu: 'ул. Яна Фабрициуса, д. 24',
        coordinates: { lat: 43.5621, lng: 39.7765 },
        avgMarketPricePerM2: 445000,
        avgMonthlyRentPerM2: 1850,
        avgDailyRentPerM2: 185,
        metroStations: [
          { name: 'Парк Дендрарий', lineColor: '#10B981', travelTimeText: '8 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Прикубанский округ (Краснодар)',
        nameEn: 'Prikubansky District (Krasnodar)',
        defaultStreetRu: 'ул. Западный Обход, д. 42',
        coordinates: { lat: 45.0842, lng: 38.9185 },
        avgMarketPricePerM2: 165000,
        avgMonthlyRentPerM2: 850,
        avgDailyRentPerM2: 68,
        metroStations: [
          { name: 'Парк Галицкого (Краснодар)', lineColor: '#10B981', travelTimeText: '18 мин. транспортом', mode: 'drive' },
        ],
      },
    ],
  },
  {
    code: 'kazan',
    labelRu: 'Казань и Республика Татарстан',
    labelEn: 'Kazan & Republic of Tatarstan',
    shortLabelRu: 'Казань и РТ',
    shortLabelEn: 'Kazan',
    center: { lat: 55.7961, lng: 49.1064 },
    defaultZoom: 12,
    majorDevelopers: ['Унистрой', 'Ак Барс Дом', 'Суварстроит', 'СМУ-88', 'Комосстрой'],
    districts: [
      {
        nameRu: 'Ново-Савиновский район',
        nameEn: 'Novo-Savinovsky District',
        defaultStreetRu: 'ул. Сибгата Хакима, д. 51',
        coordinates: { lat: 55.8158, lng: 49.1185 },
        avgMarketPricePerM2: 275000,
        avgMonthlyRentPerM2: 1250,
        avgDailyRentPerM2: 95,
        metroStations: [
          { name: 'м. Козья слобода', lineColor: '#DC2626', travelTimeText: '9 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Вахитовский район',
        nameEn: 'Vakhitovsky District',
        defaultStreetRu: 'ул. Островского, д. 88',
        coordinates: { lat: 55.7812, lng: 49.1286 },
        avgMarketPricePerM2: 315000,
        avgMonthlyRentPerM2: 1420,
        avgDailyRentPerM2: 112,
        metroStations: [
          { name: 'м. Площадь Тукая', lineColor: '#DC2626', travelTimeText: '6 мин. пешком', mode: 'walk' },
          { name: 'м. Суконная слобода', lineColor: '#DC2626', travelTimeText: '8 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Советский район (Казань)',
        nameEn: 'Sovetsky District (Kazan)',
        defaultStreetRu: 'пр-т Альберта Камалеева, д. 32',
        coordinates: { lat: 55.7885, lng: 49.1892 },
        avgMarketPricePerM2: 228000,
        avgMonthlyRentPerM2: 1050,
        avgDailyRentPerM2: 78,
        metroStations: [
          { name: 'м. Горки', lineColor: '#DC2626', travelTimeText: '12 мин. транспортом', mode: 'drive' },
        ],
      },
    ],
  },
  {
    code: 'ekb',
    labelRu: 'Екатеринбург и Свердловская область',
    labelEn: 'Yekaterinburg & Sverdlovsk Oblast',
    shortLabelRu: 'Екатеринбург',
    shortLabelEn: 'Yekaterinburg',
    center: { lat: 56.8389, lng: 60.6057 },
    defaultZoom: 12,
    majorDevelopers: ['Брусника', 'УГМК-Застройщик', 'Атомстройкомплекс', 'PRINZIP', 'Кортрос'],
    districts: [
      {
        nameRu: 'Ленинский район (ЕКБ)',
        nameEn: 'Leninsky District (EKB)',
        defaultStreetRu: 'ул. Хохрякова, д. 64',
        coordinates: { lat: 56.8312, lng: 60.5945 },
        avgMarketPricePerM2: 225000,
        avgMonthlyRentPerM2: 1080,
        avgDailyRentPerM2: 82,
        metroStations: [
          { name: 'м. Геологическая', lineColor: '#16A34A', travelTimeText: '5 мин. пешком', mode: 'walk' },
          { name: 'м. Площадь 1905 года', lineColor: '#16A34A', travelTimeText: '9 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Верх-Исетский район',
        nameEn: 'Verkh-Isetsky District',
        defaultStreetRu: 'ул. Татищева, д. 58',
        coordinates: { lat: 56.8425, lng: 60.5582 },
        avgMarketPricePerM2: 192000,
        avgMonthlyRentPerM2: 960,
        avgDailyRentPerM2: 74,
        metroStations: [
          { name: 'м. Площадь 1905 года', lineColor: '#16A34A', travelTimeText: '11 мин. транспортом', mode: 'drive' },
        ],
      },
      {
        nameRu: 'Академический район',
        nameEn: 'Akademichesky District',
        defaultStreetRu: 'пр-т Академика Сахарова, д. 47',
        coordinates: { lat: 56.7824, lng: 60.5218 },
        avgMarketPricePerM2: 158000,
        avgMonthlyRentPerM2: 820,
        avgDailyRentPerM2: 60,
        metroStations: [
          { name: 'Скоростной трамвай Академический', lineColor: '#EF4444', travelTimeText: '4 мин. пешком', mode: 'walk' },
        ],
      },
    ],
  },
  {
    code: 'nsk',
    labelRu: 'Новосибирск и Новосибирская область',
    labelEn: 'Novosibirsk & Novosibirsk Oblast',
    shortLabelRu: 'Новосибирск',
    shortLabelEn: 'Novosibirsk',
    center: { lat: 55.0084, lng: 82.9357 },
    defaultZoom: 12,
    majorDevelopers: ['Брусника', 'ГК Расцветай', 'СибирьИнвест', 'КПД-Газстрой'],
    districts: [
      {
        nameRu: 'Октябрьский район (НСК)',
        nameEn: 'Oktyabrsky District (NSK)',
        defaultStreetRu: 'ул. Большевистская, д. 38 (Европейский берег)',
        coordinates: { lat: 54.9965, lng: 82.9562 },
        avgMarketPricePerM2: 195000,
        avgMonthlyRentPerM2: 980,
        avgDailyRentPerM2: 74,
        metroStations: [
          { name: 'м. Речной вокзал', lineColor: '#DC2626', travelTimeText: '8 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Центральный район (НСК)',
        nameEn: 'Central District (NSK)',
        defaultStreetRu: 'Красный проспект, д. 55',
        coordinates: { lat: 55.0352, lng: 82.9214 },
        avgMarketPricePerM2: 235000,
        avgMonthlyRentPerM2: 1150,
        avgDailyRentPerM2: 88,
        metroStations: [
          { name: 'м. Красный проспект', lineColor: '#DC2626', travelTimeText: '4 мин. пешком', mode: 'walk' },
          { name: 'м. Площадь Ленина', lineColor: '#DC2626', travelTimeText: '7 мин. пешком', mode: 'walk' },
        ],
      },
    ],
  },
  {
    code: 'nn',
    labelRu: 'Нижний Новгород и Нижегородская область',
    labelEn: 'Nizhny Novgorod & Oblast',
    shortLabelRu: 'Нижний Новгород',
    shortLabelEn: 'Nizhny Novgorod',
    center: { lat: 56.2965, lng: 43.9361 },
    defaultZoom: 12,
    majorDevelopers: ['Столица Нижний', 'ГК Каркас Монолит', 'ННДК', 'GloraX'],
    districts: [
      {
        nameRu: 'Нижегородский район',
        nameEn: 'Nizhegorodsky District',
        defaultStreetRu: 'Черниговская набережная, д. 12',
        coordinates: { lat: 56.3182, lng: 43.9885 },
        avgMarketPricePerM2: 245000,
        avgMonthlyRentPerM2: 1120,
        avgDailyRentPerM2: 86,
        metroStations: [
          { name: 'м. Горьковская', lineColor: '#DC2626', travelTimeText: '10 мин. пешком', mode: 'walk' },
        ],
      },
      {
        nameRu: 'Советский район (НН)',
        nameEn: 'Sovetsky District (NN)',
        defaultStreetRu: 'ул. Белинского, д. 63',
        coordinates: { lat: 56.3065, lng: 44.0124 },
        avgMarketPricePerM2: 210000,
        avgMonthlyRentPerM2: 990,
        avgDailyRentPerM2: 75,
        metroStations: [
          { name: 'м. Горьковская', lineColor: '#DC2626', travelTimeText: '12 мин. пешком', mode: 'walk' },
        ],
      },
    ],
  },
];

export function getRegionByCode(code: string): RussianRegionConfig {
  return RUSSIAN_REGIONS.find((r) => r.code === code) || RUSSIAN_REGIONS[0];
}

export function getDistrictsForRegion(code: string): DistrictGeoConfig[] {
  if (!code || code === 'all') {
    return RUSSIAN_REGIONS.flatMap((r) => r.districts);
  }
  return getRegionByCode(code).districts;
}

export function getDistrictGeo(cityCode: string, districtName: string): DistrictGeoConfig {
  const region = getRegionByCode(cityCode);
  const exact = region.districts.find(
    (d) =>
      d.nameRu.toLowerCase() === districtName.toLowerCase() ||
      districtName.toLowerCase().includes(d.nameRu.split(' ')[0].toLowerCase())
  );
  return exact || region.districts[0];
}

export interface ResolvedLotGeo {
  region: RussianRegionConfig;
  districtGeo: DistrictGeoConfig;
  streetAddress: string;
  coordinates: { lat: number; lng: number };
  ceilingHeightM: number;
  districtAvgPricePerM2: number;
  metroStations: MetroStationInfo[];
  rentalPotential: RentalPotentialInfo;
}

/**
 * Deterministically resolves rich geographical, transport, technical, and rental yield metadata
 * for any lot (whether seeded or dynamically submitted via /sellers).
 */
export function resolveLotGeoDetails(lot: Lot): ResolvedLotGeo {
  const region = getRegionByCode(lot.city);
  const districtGeo = getDistrictGeo(lot.city, lot.district);

  // Small deterministic jitter based on lotCode so multiple lots in the same district don't overlap on the exact pixel
  const hashNum = lot.lotCode
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const latOffset = ((hashNum % 19) - 9) * 0.0014;
  const lngOffset = (((hashNum * 7) % 19) - 9) * 0.0018;

  const coordinates = lot.coordinates || {
    lat: Number((districtGeo.coordinates.lat + latOffset).toFixed(5)),
    lng: Number((districtGeo.coordinates.lng + lngOffset).toFixed(5)),
  };

  const streetAddress = lot.streetAddress || districtGeo.defaultStreetRu;
  const ceilingHeightM = lot.ceilingHeightM || (lot.dduContractPrice / Math.max(lot.areaM2, 20) > 320000 ? 3.05 : 2.78);
  const districtAvgPricePerM2 = lot.districtAvgPricePerM2 || districtGeo.avgMarketPricePerM2;
  const metroStations =
    lot.metroStations && lot.metroStations.length > 0 ? lot.metroStations : districtGeo.metroStations;

  const rawMonthly = Math.round((lot.areaM2 * districtGeo.avgMonthlyRentPerM2) / 1000) * 1000;
  const longTermMonthlyRub = Math.max(35000, rawMonthly);
  const rawDaily = Math.round((lot.areaM2 * districtGeo.avgDailyRentPerM2) / 100) * 100;
  const shortTermDailyRub = Math.max(2800, rawDaily);
  const estimatedAnnualYieldPercent = Number(
    (((longTermMonthlyRub * 12) / Math.max(lot.dduContractPrice, 1)) * 100).toFixed(1)
  );

  const rentalPotential: RentalPotentialInfo = lot.rentalPotential || {
    longTermMonthlyRub,
    shortTermDailyRub,
    estimatedAnnualYieldPercent,
  };

  return {
    region,
    districtGeo,
    streetAddress,
    coordinates,
    ceilingHeightM,
    districtAvgPricePerM2,
    metroStations,
    rentalPotential,
  };
}
