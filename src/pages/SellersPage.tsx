import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { SellerRequestsRepository } from '../dal/repositories/SellerRequestsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { DevelopersRepository } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { SELLER_MANDATORY_DOC_SLOTS, StorageService } from '../dal/StorageService';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import {
  RUSSIAN_REGIONS,
  getDistrictsForRegion,
  getRegionByCode,
} from '../data/russianGeography';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  sanitizeDigitsOnly,
  validateDduOrLotCode,
  validateRussianInn,
  validateSellerFinancials,
  validateTextEntityName,
} from '../utils/validators';
import {
  isValidInn,
  getInnValidationError,
  withAsyncTimeout,
  ASYNC_NETWORK_TIMEOUT_MESSAGE,
} from '../utils/asyncGuard';
import { useAuth } from '../context/AuthContext';
import { AccreditedDeveloper, DocumentMetadata, Lot, RussianCityCode } from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Upload,
  AlertCircle,
  Clock,
  FileText,
  Check,
  Send,
  HardDrive,
  Eye,
  Loader2,
  Download,
  MapPin,
} from 'lucide-react';

export const SellersPage: React.FC = () => {
  const { language } = useLanguage();
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Wizard Step (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftLotCode, setDraftLotCode] = useState<string>(
    () => `U-${Math.floor(12000 + Math.random() * 87000)}`
  );

  // Geographic & Property Parameters (Phase 1)
  const [locationRegion, setLocationRegion] = useState<RussianCityCode>('spb');
  const [district, setDistrict] = useState<string>('Приморский район');
  const [accreditedDevelopers, setAccreditedDevelopers] = useState<AccreditedDeveloper[]>([]);
  const [isAddingNewDeveloper, setIsAddingNewDeveloper] = useState<boolean>(false);
  const [developerName, setDeveloperName] = useState<string>('Setl Group');
  const [developerInn, setDeveloperInn] = useState<string>('7810245481');
  const [complexName, setComplexName] = useState<string>('ЖК «Чистое Небо»');
  const [dduCode, setDduCode] = useState<string>('ДДУ-78/12-10599');
  const [rooms, setRooms] = useState<Lot['rooms']>('2-room');
  const [areaM2, setAreaM2] = useState<string>('62.5');
  const [floor, setFloor] = useState<string>('9');
  const [totalFloors, setTotalFloors] = useState<string>('24');
  const [exitRoute, setExitRoute] = useState<'ddu_assignment' | 'fast_cash' | 'trade_in_6'>(
    'ddu_assignment'
  );

  // Financial Parameters
  const [contractPriceStr, setContractPriceStr] = useState<string>('11400000');
  const [paidAmountStr, setPaidAmountStr] = useState<string>('2850000');
  const [todayMarketPriceStr, setTodayMarketPriceStr] = useState<string>('14500000');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);
  const [penaltyRatePercent, setPenaltyRatePercent] = useState<number>(15);

  // Step 2 Seller Identity & Strict Russian Validation
  const [sellerName, setSellerName] = useState<string>(
    user?.name || 'Александр Владимирович Белов'
  );
  const [sellerPhone, setSellerPhone] = useState<string>(
    user?.phone ? formatRussianPhoneInput(user.phone) : '+7 (911) 409-44-12'
  );
  const [sellerInn, setSellerInn] = useState<string>('781432994102');
  const [partnerRefCode, setPartnerRefCode] = useState<string>('');

  // Validation Error State
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 3 Cloud Document Vault & Photos (Phase 2)
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [vaultDocs, setVaultDocs] = useState<DocumentMetadata[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
  ]);

  // Step 4 Created IDs
  const [createdDealId, setCreatedDealId] = useState<string>('');
  const [createdLotCode, setCreatedLotCode] = useState<string>('');

  useEffect(() => {
    MarketSettingsRepository.getSettings().then((s) => {
      if (s?.developerPenaltyPercent) setPenaltyRatePercent(s.developerPenaltyPercent);
    });
    const loadDevs = () => {
      DevelopersRepository.getAccreditedDevelopers().then((devs) => {
        setAccreditedDevelopers(devs);
      });
    };
    loadDevs();
    const unsub = DatabaseGateway.subscribe((col) => {
      if (!col || col === 'developers') loadDevs();
    });
    return () => unsub();
  }, []);

  // Sync district list when region changes
  const activeRegionConfig = getRegionByCode(locationRegion);
  const regionDistricts = getDistrictsForRegion(locationRegion);

  const handleRegionChange = (newRegionCode: RussianCityCode) => {
    setLocationRegion(newRegionCode);
    const districts = getDistrictsForRegion(newRegionCode);
    if (districts.length > 0) {
      setDistrict(districts[0].nameRu);
    }
    const reg = getRegionByCode(newRegionCode);
    if (reg.majorDevelopers.length > 0) {
      setDeveloperName(reg.majorDevelopers[0]);
    }
  };

  const contractPrice = Number(contractPriceStr) || 0;
  const paidAmount = Number(paidAmountStr) || 0;
  const todayMarketPrice = Number(todayMarketPriceStr) || Math.round(contractPrice * 1.24);

  const financialValidation = validateSellerFinancials(paidAmount, contractPrice);
  const devPenalty = Math.round(contractPrice * (penaltyRatePercent / 100));
  const cleanReturnDomExit = paidAmount;
  const netFamilyBenefit = devPenalty;

  const clientCode = user?.clientCode || 'DEX-784105';
  const currentUid = user?.id || 'usr-seller-live';

  const handleGoToStep2 = () => {
    setStep1Error(null);

    const devCheck = validateTextEntityName(developerName, 'Наименование застройщика');
    if (!devCheck.valid) {
      setStep1Error(language === 'ru' ? devCheck.messageRu! : devCheck.messageEn!);
      return;
    }

    if (isAddingNewDeveloper) {
      const cleanDevInn = developerInn.replace(/\D/g, '');
      if (cleanDevInn.length !== 10 && cleanDevInn.length !== 12) {
        setStep1Error(
          language === 'ru'
            ? 'Для нового застройщика укажите корректный ИНН юридического лица (10 цифр).'
            : 'Please enter a valid 10-digit corporate INN for the new developer.'
        );
        return;
      }
    }

    const complexCheck = validateTextEntityName(complexName, 'Название жилого комплекса');
    if (!complexCheck.valid) {
      setStep1Error(language === 'ru' ? complexCheck.messageRu! : complexCheck.messageEn!);
      return;
    }

    const dduCheck = validateDduOrLotCode(dduCode);
    if (!dduCheck.valid) {
      setStep1Error(language === 'ru' ? dduCheck.messageRu! : dduCheck.messageEn!);
      return;
    }

    const parsedArea = Number(areaM2);
    const parsedFloor = Number(floor);
    const parsedTotalFloors = Number(totalFloors);

    if (!Number.isFinite(parsedArea) || parsedArea < 16 || parsedArea > 500) {
      setStep1Error(
        language === 'ru'
          ? 'Укажите корректную площадь квартиры (от 16 до 500 м²).'
          : 'Please enter a valid apartment area (16–500 m²).'
      );
      return;
    }

    if (
      !Number.isInteger(parsedFloor) ||
      !Number.isInteger(parsedTotalFloors) ||
      parsedFloor < 1 ||
      parsedTotalFloors < parsedFloor ||
      parsedTotalFloors > 110
    ) {
      setStep1Error(
        language === 'ru'
          ? 'Проверьте корректность этажа и общей этажности корпуса (этаж не может превышать этажность дома).'
          : 'Floor must be between 1 and total building floors.'
      );
      return;
    }

    if (!financialValidation.valid) {
      setStep1Error(
        language === 'ru'
          ? financialValidation.paidErrorRu || financialValidation.contractErrorRu!
          : financialValidation.paidErrorEn || financialValidation.contractErrorEn!
      );
      return;
    }

    if (isAddingNewDeveloper) {
      if (!developerName.trim()) {
        setStep1Error('Укажите наименование нового застройщика.');
        return;
      }
      if (!isValidInn(developerInn)) {
        setStep1Error(
          getInnValidationError(developerInn) ||
            'Укажите корректный ИНН застройщика (10 цифр для юрлиц или 12 для ИП).'
        );
        return;
      }
    } else {
      const matched = accreditedDevelopers.find((d) => d.name === developerName);
      if (matched && !developerInn) {
        setDeveloperInn(matched.inn);
      }
    }

    if (!agreeTerms) {
      setStep1Error(
        language === 'ru'
          ? 'Для продолжения подтвердите согласие на реализацию объекта по цене договора ДДУ без наценки.'
          : 'Please agree to sell at the original DDU contract price.'
      );
      return;
    }

    setCurrentStep(2);
  };

  const handleGoToStep3 = async () => {
    setStep2Error(null);

    const nameCheck = validateTextEntityName(sellerName, 'ФИО дольщика');
    if (!nameCheck.valid) {
      setStep2Error(language === 'ru' ? nameCheck.messageRu! : nameCheck.messageEn!);
      return;
    }

    if (!isValidRussianPhone(sellerPhone)) {
      setStep2Error(
        language === 'ru'
          ? 'Введите телефон в едином российском формате: +7 (XXX) XXX-XX-XX.'
          : 'Phone must match Russian standard: +7 (XXX) XXX-XX-XX.'
      );
      return;
    }

    const innCheck = validateRussianInn(sellerInn);
    if (!innCheck.valid) {
      setStep2Error(language === 'ru' ? innCheck.messageRu! : innCheck.messageEn!);
      return;
    }

    const existingDocs = await StorageService.getDocumentsByEntity('lot', draftLotCode);
    setVaultDocs(existingDocs);
    setCurrentStep(3);
  };

  const handleAddCustomPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setUploadedPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitFinal = async () => {
    setStep3Error(null);

    if (vaultDocs.length === 0) {
      setStep3Error(
        language === 'ru'
          ? 'Загрузите хотя бы основной документ (Скан договора ДДУ / Справку об оплате) через облачный сейф документов перед отправкой.'
          : 'Please upload at least your DDU scan in the Document Vault before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await withAsyncTimeout(
        (async () => {
          const activeUser = user
            ? user
            : await login({
                name: sellerName.trim(),
                phone: sellerPhone,
                roles: ['seller', 'buyer'],
                activeRole: 'seller',
              });

          const result = await SellerRequestsRepository.submitSellerRequest({
            uid: activeUser.id,
            clientCode: activeUser.clientCode,
            draftLotCode,
            sellerName: sellerName.trim(),
            sellerPhone,
            sellerInn: sellerInn.trim(),
            city: locationRegion,
            district,
            complexName: complexName.trim(),
            developer: developerName.trim(),
            developerInn: developerInn.trim() || undefined,
            dduNumber: dduCode.trim(),
            areaM2: Number(areaM2),
            rooms,
            floor: Number(floor),
            totalFloors: Number(totalFloors),
            contractPriceRub: contractPrice,
            paidAmountRub: paidAmount,
            exitRoute,
            documentIds: vaultDocs.map((d) => d.id),
            referredByPartnerCode: partnerRefCode.trim() || undefined,
          });

          if (uploadedPhotos.length > 0) {
            result.lot.imageUrl = uploadedPhotos[0];
            result.lot.galleryImages = uploadedPhotos;
            result.lot.sellerUploadedPhotos = uploadedPhotos;
            result.lot.approvedGalleryImages = uploadedPhotos.slice(0, 2);
            if (todayMarketPrice > contractPrice) {
              result.lot.todayDeveloperPrice = todayMarketPrice;
            }
            await LotsRepository.update(result.lot);
          }

          await login({
            ...activeUser,
            name: sellerName.trim(),
            phone: sellerPhone,
            roles: activeUser.roles.includes('seller')
              ? activeUser.roles
              : [...activeUser.roles, 'seller'],
            activeRole: 'seller',
            activeDealId: result.dealId,
          });

          setCreatedDealId(result.dealId);
          setCreatedLotCode(result.lot.lotCode);
          setCurrentStep(4);
        })(),
        15000
      );
    } catch (err: any) {
      setStep3Error(err?.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const mandatoryUploadedCount = SELLER_MANDATORY_DOC_SLOTS.filter((slot) =>
    vaultDocs.some((d) => d.category === slot.category && d.status !== 'rejected')
  ).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* 1. Header & 4 Guarantee Badges */}
      <section className="bg-white text-slate-900 pt-10 pb-12 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="space-y-2 max-w-3xl">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {language === 'ru'
                  ? 'Экспресс-аудит договоров цессии по 214-ФЗ • 7 регионов РФ'
                  : '214-FZ Express Assignment Audit • 7 Russian Regions'}
              </span>
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {language === 'ru'
                ? 'Хотите выйти из договора ДДУ? Рассчитаем всё с точностью до рубля'
                : 'Want to Exit DDU Contract? We Calculate Everything to the Exact Ruble'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {language === 'ru'
                ? 'Верните 100% внесенных денег наличными через банковский аккредитив без удержания штрафа девелопера (10%–15%) и без уплаты НДФЛ.'
                : 'Recover 100% of deposited cash via bank letter of credit without 10%-15% developer penalty and 0% personal income tax.'}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-900 block">100% ВОЗВРАТ</span>
              <span className="text-[11px] text-slate-500">Без скрытых комиссий</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-900 block">0 ₽ НДФЛ</span>
              <span className="text-[11px] text-slate-500">Уступка по цене ДДУ без наценки</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-900 block">7–14 ДНЕЙ</span>
              <span className="text-[11px] text-slate-500">Электронная регистрация Росреестра</span>
            </div>
            <div className="bg-emerald-50 text-emerald-950 p-3.5 rounded-xl font-bold border border-emerald-300 shadow-xs">
              <span className="font-black text-emerald-800 block">ГАРАНТИЯ 0%:</span>
              <span className="text-[11px] text-emerald-700 leading-tight block">
                100% бесплатно продавцу — комиссию 2.5% платит покупатель
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive 4-Step Operational Wizard */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>
                {language === 'ru'
                  ? `Шаг ${currentStep} из 4: ${
                      currentStep === 1
                        ? 'География, параметры объекта ДДУ и финансовый расчет'
                        : currentStep === 2
                        ? 'Верификация дольщика (ФИО, телефон РФ, ИНН)'
                        : currentStep === 3
                        ? 'Облачный сейф документов (Yandex S3 / 152-ФЗ)'
                        : 'Заявка зарегистрирована в реестре сделок'
                    }`
                  : `Step ${currentStep} of 4`}
              </span>
              <span className="text-emerald-600 font-extrabold">{currentStep * 25}%</span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${currentStep * 25}%` }}
              />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  {language === 'ru'
                    ? 'Конфиденциальный шлюз по ГОСТ Р 57580 и 152-ФЗ. Точный этаж и номер квартиры маскируются в публичном каталоге.'
                    : 'Encrypted gateway per GOST R 57580 & 152-FZ. Exact floor and apartment number are masked publicly.'}
                </span>
              </div>
              <span className="font-mono font-bold text-indigo-800 bg-white px-2.5 py-0.5 rounded border border-sky-200">
                Резерв лота: #{draftLotCode}
              </span>
            </div>
          </div>

          {/* STEP 1: Geography, Property Details & Financial Truth Validation */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-5">
                {step1Error && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{step1Error}</span>
                  </div>
                )}

                {/* Hierarchical Russian Region & District Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'ru' ? 'Город / Субъект РФ *' : 'Region / City *'}</span>
                    </label>
                    <select
                      value={locationRegion}
                      onChange={(e) => handleRegionChange(e.target.value as RussianCityCode)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      {RUSSIAN_REGIONS.map((reg) => (
                        <option key={reg.code} value={reg.code}>
                          {language === 'ru' ? reg.labelRu : reg.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {language === 'ru' ? 'Район / Локация *' : 'District *'}
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      {regionDistricts.map((dist) => (
                        <option key={dist.nameRu} value={dist.nameRu}>
                          {language === 'ru' ? dist.nameRu : dist.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Developer & Complex Name (Accredited Registry + Add New Developer Engine) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800">
                        {language === 'ru' ? 'Застройщик (Реестр 214-ФЗ) *' : 'Developer *'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAddingNewDeveloper) {
                            setIsAddingNewDeveloper(true);
                            setDeveloperName('');
                            setDeveloperInn('');
                          } else {
                            setIsAddingNewDeveloper(false);
                            setDeveloperName(accreditedDevelopers[0]?.name || 'Setl Group');
                            setDeveloperInn(accreditedDevelopers[0]?.inn || '7810245481');
                          }
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        {isAddingNewDeveloper
                          ? '← Выбрать из реестра аккредитованных'
                          : '+ Добавить нового застройщика'}
                      </button>
                    </div>

                    {!isAddingNewDeveloper ? (
                      <>
                        <select
                          value={developerName}
                          onChange={(e) => {
                            if (e.target.value === '__ADD_NEW__') {
                              setIsAddingNewDeveloper(true);
                              setDeveloperName('');
                              setDeveloperInn('');
                            } else {
                              setDeveloperName(e.target.value);
                              const matched = accreditedDevelopers.find(
                                (d) => d.name === e.target.value
                              );
                              if (matched) setDeveloperInn(matched.inn);
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                        >
                          {accreditedDevelopers.map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name} (ИНН {d.inn})
                            </option>
                          ))}
                          <option value="__ADD_NEW__">+ Добавить нового застройщика</option>
                        </select>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {activeRegionConfig.majorDevelopers.slice(0, 4).map((dev) => (
                            <button
                              key={dev}
                              type="button"
                              onClick={() => {
                                setIsAddingNewDeveloper(false);
                                setDeveloperName(dev);
                              }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                developerName === dev
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {dev}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2.5 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Наименование нового застройщика *
                          </label>
                          <input
                            type="text"
                            value={developerName}
                            onChange={(e) => setDeveloperName(e.target.value)}
                            placeholder="Например: СК «Северный Горизонт»"
                            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            ИНН застройщика (10 цифр) *
                          </label>
                          <input
                            type="text"
                            maxLength={12}
                            value={developerInn}
                            onChange={(e) => setDeveloperInn(sanitizeDigitsOnly(e.target.value))}
                            placeholder="7813654902"
                            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <p className="text-[10px] text-amber-900 font-medium leading-tight">
                          Объект будет опубликован без блокировки со статусом «Ожидает аккредитации банков». Запрос с ДДУ и справкой об оплате будет автоматически направлен в Сбербанк, ВТБ, Альфа-Банк и ДОМ.РФ.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {language === 'ru' ? 'Название Жилого Комплекса *' : 'Residential Complex *'}
                    </label>
                    <input
                      type="text"
                      value={complexName}
                      onChange={(e) => setComplexName(e.target.value)}
                      placeholder="ЖК «Чистое Небо»"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* DDU Number + Rooms + Area + Floors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Номер договора ДДУ *' : 'DDU Number *'}
                    </label>
                    <input
                      type="text"
                      value={dduCode}
                      onChange={(e) => setDduCode(e.target.value)}
                      placeholder="ДДУ-78/10566"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Комнатность' : 'Rooms'}
                    </label>
                    <select
                      value={rooms}
                      onChange={(e) => setRooms(e.target.value as Lot['rooms'])}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="studio">Студия</option>
                      <option value="1-room">1-комн.</option>
                      <option value="euro">Евро-2 / Евро-3</option>
                      <option value="2-room">2-комн.</option>
                      <option value="3-room">3-комн.+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Площадь (м²) *' : 'Area (m²) *'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={areaM2}
                      onChange={(e) =>
                        setAreaM2(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Этаж / Всего' : 'Floor / Total'}
                    </label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={floor}
                        onChange={(e) => setFloor(sanitizeDigitsOnly(e.target.value, 3))}
                        className="w-1/2 px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
                        placeholder="9"
                      />
                      <span className="text-slate-400 font-bold">/</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={totalFloors}
                        onChange={(e) => setTotalFloors(sanitizeDigitsOnly(e.target.value, 3))}
                        className="w-1/2 px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
                        placeholder="24"
                      />
                    </div>
                  </div>
                </div>

                {/* Strict Financial Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {language === 'ru'
                        ? 'Полная цена договора ДДУ (₽) *'
                        : 'Total DDU Contract Price (₽) *'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={contractPriceStr}
                      onChange={(e) => setContractPriceStr(sanitizeDigitsOnly(e.target.value, 10))}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold focus:outline-none ${
                        financialValidation.contractErrorRu
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-slate-300 focus:border-emerald-500'
                      }`}
                    />
                    <span className="text-[11px] text-slate-500 font-mono block mt-1">
                      {formatRubles(contractPrice)}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-800">
                        {language === 'ru'
                          ? 'Выплачено застройщику (₽) *'
                          : 'Paid to Developer (₽) *'}
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        2 – 50 млн ₽
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(sanitizeDigitsOnly(e.target.value, 9))}
                      className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-mono font-bold focus:outline-none ${
                        financialValidation.paidErrorRu
                          ? 'border-rose-500 bg-rose-50/40'
                          : 'border-emerald-500/80'
                      }`}
                    />
                    <span className="text-[11px] text-emerald-700 font-mono font-bold block mt-1">
                      На руки 100%: {formatRubles(paidAmount)} • Остаток долга:{' '}
                      {formatRubles(Math.max(0, contractPrice - paidAmount))}
                    </span>
                  </div>
                </div>

                {!financialValidation.valid && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold">
                    {language === 'ru'
                      ? financialValidation.paidErrorRu || financialValidation.contractErrorRu
                      : financialValidation.paidErrorEn || financialValidation.contractErrorEn}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {language === 'ru'
                        ? 'Текущая цена аналога у застройщика (₽)'
                        : 'Current Developer Price (₽)'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={todayMarketPriceStr}
                      onChange={(e) =>
                        setTodayMarketPriceStr(sanitizeDigitsOnly(e.target.value, 10))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {language === 'ru' ? 'Маршрут выхода из ДДУ' : 'Exit Route'}
                    </label>
                    <select
                      value={exitRoute}
                      onChange={(e) => setExitRoute(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ddu_assignment">Классическая уступка 214-ФЗ (100% возврат)</option>
                      <option value="fast_cash">Срочный выход за 5–7 дней (приоритетный пул)</option>
                      <option value="trade_in_6">Обмен / Перевод на Семейную ипотеку 6%</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                    />
                    <span className="leading-snug">
                      {language === 'ru'
                        ? 'Согласен на реализацию лота по цене старого договора ДДУ без наценки (0 ₽ НДФЛ) с расчетом через банковский аккредитив.'
                        : 'I agree to sell the lot at original DDU contract price with 0% markup via bank letter of credit.'}
                    </span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGoToStep2}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>
                      {language === 'ru'
                        ? 'Подтвердить расчет и перейти к данным дольщика'
                        : 'Confirm Calculation & Proceed'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Live Comparative Financial Audit */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {language === 'ru'
                      ? 'СРАВНИТЕЛЬНЫЙ ФИНАНСОВЫЙ АУДИТ — LIVE РАСЧЕТ'
                      : 'COMPARATIVE AUDIT — LIVE CALC'}
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="bg-[#FEF2F2] border border-rose-200 rounded-2xl p-4 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-rose-950">
                      {language === 'ru'
                        ? 'Односторонний разрыв с девелопером'
                        : 'Direct Cancellation with Developer'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold">
                      штраф {penaltyRatePercent}%
                    </span>
                  </div>
                  <div className="text-2xl font-black text-rose-600 tracking-tight font-mono">
                    -{formatRubles(devPenalty)}
                  </div>
                  <p className="text-[11px] text-rose-800/80">
                    {language === 'ru'
                      ? 'Прямая безвозвратная потеря из внесенных средств при расторжении'
                      : 'Direct non-refundable loss from deposited capital'}
                  </p>
                </div>

                <div className="bg-[#ECFDF5] border border-emerald-300 rounded-2xl p-4 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-950">
                      {language === 'ru'
                        ? 'Чистый возврат через DomExit'
                        : 'Clean Return via DomExit'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold">
                      100% средств
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 tracking-tight font-mono">
                    {formatRubles(cleanReturnDomExit)}
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    {language === 'ru'
                      ? 'Полная выплата с аккредитива Сбербанка / ВТБ в день регистрации Росреестра'
                      : 'Full payout from Sberbank / VTB escrow on Rosreestr registration day'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 space-y-3 shadow-lg">
                  <span className="text-xs text-emerald-100 font-semibold block uppercase tracking-wider">
                    {language === 'ru'
                      ? 'ВАША ЧИСТАЯ ВЫГОДА (Сохранение семейного капитала)'
                      : 'YOUR NET BENEFIT (Capital Preserved)'}
                  </span>
                  <div className="text-3xl font-black text-white tracking-tight font-mono">
                    +{formatRubles(netFamilyBenefit)}
                  </div>

                  <div className="space-y-1 pt-2 border-t border-emerald-500/50 text-[11px]">
                    <div className="flex justify-between text-emerald-100">
                      <span>Регион размещения:</span>
                      <span className="font-bold text-white">
                        {activeRegionConfig.shortLabelRu} • {district}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-100">
                      <span>Дисконт для нового покупателя:</span>
                      <span className="font-bold text-white">
                        {formatRubles(Math.max(0, todayMarketPrice - contractPrice))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-emerald-100 pt-1">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{language === 'ru' ? 'Средний срок закрытия:' : 'Avg. closing time:'}</span>
                    </span>
                    <span className="font-bold text-white">9 рабочих дней</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Strict Seller Contact & ИНН Validation */}
          {currentStep === 2 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {language === 'ru'
                    ? 'Идентификация правообладателя ДДУ (152-ФЗ)'
                    : 'DDU Holder Verification (152-FZ)'}
                </h3>
                <p className="text-xs text-slate-500">
                  Данные используются строго для автоматической сверки по базам ФССП и ЕФРСБ и подготовки согласия застройщика.
                </p>
              </div>

              {step2Error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{step2Error}</span>
                </div>
              )}

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ФИО правообладателя по договору ДДУ *
                  </label>
                  <input
                    type="text"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="Белов Александр Владимирович"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Телефон РФ (+7 (XXX) XXX-XX-XX) *
                    </label>
                    <input
                      type="tel"
                      value={sellerPhone}
                      onChange={(e) => setSellerPhone(formatRussianPhoneInput(e.target.value))}
                      placeholder="+7 (911) 409-44-12"
                      className={`w-full px-4 py-3 rounded-xl border bg-white text-sm font-mono font-bold focus:outline-none ${
                        isValidRussianPhone(sellerPhone)
                          ? 'border-emerald-400'
                          : 'border-slate-300 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ИНН налогоплательщика (12 или 10 цифр) *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={sellerInn}
                      onChange={(e) => setSellerInn(sanitizeDigitsOnly(e.target.value, 12))}
                      placeholder="781432994102"
                      className={`w-full px-4 py-3 rounded-xl border bg-white text-sm font-mono font-bold focus:outline-none ${
                        validateRussianInn(sellerInn).valid
                          ? 'border-emerald-400'
                          : 'border-slate-300 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Реферальный код партнера / брокера (необязательно)
                  </label>
                  <input
                    type="text"
                    value={partnerRefCode}
                    onChange={(e) => setPartnerRefCode(e.target.value.toUpperCase())}
                    placeholder="Например: PARTNER-SPB-12"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  ← Назад к параметрам ДДУ
                </button>
                <button
                  type="button"
                  onClick={handleGoToStep3}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center space-x-2 shadow-xs cursor-pointer"
                >
                  <span>Открыть сейф документов 214-ФЗ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Production-Ready Cloud Document Vault (Phase 2) */}
          {currentStep === 3 && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-900">
                  {language === 'ru'
                    ? 'Формирование юридического досье в Yandex Object Storage (S3)'
                    : 'Legal Dossier Upload (Yandex Object Storage S3)'}
                </h3>
                <p className="text-xs text-slate-500">
                  Загрузите обязательные документы дольщика по 214-ФЗ. Каждый файл сохраняется с SHA-256 подписью и доступен для мгновенного предпросмотра.
                </p>
              </div>

              {step3Error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{step3Error}</span>
                </div>
              )}

              {/* Vault Launcher Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-emerald-300">
                      s3://{StorageService.defaultBucket}/{draftLotCode}
                    </span>
                  </div>
                  <h4 className="text-base font-black">
                    Обязательный пакет продавца: {mandatoryUploadedCount} из 4 документов загружено
                  </h4>
                  <p className="text-xs text-slate-300">
                    Всего файлов в защищенном контейнере: <strong>{vaultDocs.length}</strong> (включая дополнительные документы).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVaultOpen(true)}
                  className="px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Открыть окно загрузки документов</span>
                </button>
              </div>

              {/* Live Checklist of 4 Mandatory Seller Documents */}
              <div className="space-y-2.5">
                {SELLER_MANDATORY_DOC_SLOTS.map((slot) => {
                  const found = vaultDocs.find((d) => d.category === slot.category);
                  return (
                    <div
                      key={slot.category}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        found
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <FileText
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            found ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-slate-900">{slot.titleRu}</div>
                          {found ? (
                            <div className="text-[11px] font-mono text-emerald-800 mt-0.5">
                              ✓ {found.name} ({(found.sizeBytes / 1024).toFixed(1)} КБ • На проверке)
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">{slot.hintRu}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {found ? (
                          <>
                            <button
                              type="button"
                              onClick={() => StorageService.downloadDocument(found)}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Скачать</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsVaultOpen(true)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Просмотр</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsVaultOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Загрузить →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Photo & Floorplan Upload Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Фотографии ЖК, вида из окна и планировки ({uploadedPhotos.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Куратор проверит отсутствие персональных данных и опубликует фото в каталоге
                    </p>
                  </div>
                  <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center space-x-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Добавить фото</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleAddCustomPhoto}
                      accept="image/*"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {uploadedPhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"
                    >
                      <img
                        src={photo}
                        alt={`Фото ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedPhotos((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 text-[10px] cursor-pointer"
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitFinal}
                  className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Сохранение в базе...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Отправить заявку на аудит (0% комиссии)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Live Confirmation & Direct Portal / Tracker Navigation */}
          {currentStep === 4 && (
            <div className="max-w-xl mx-auto py-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 text-xs font-bold font-mono">
                  Сделка #{createdDealId} • Лот #{createdLotCode}
                </span>
                <h3 className="text-2xl font-black text-slate-950">
                  {language === 'ru'
                    ? 'Заявка сохранена в живом реестре DomExit!'
                    : 'Request Saved in Live DomExit Registry!'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Зафиксирована сумма чистого возврата{' '}
                  <strong>{formatRubles(cleanReturnDomExit)}</strong>. Заявка поступила на стол
                  Владельца платформы для назначения профильного юриста-куратора по региону{' '}
                  <strong>{activeRegionConfig.shortLabelRu}</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Объект и регион:</span>
                  <span className="font-bold text-slate-900">
                    {complexName} ({activeRegionConfig.shortLabelRu}, {district})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Правообладатель / ИНН:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {sellerName} • ИНН {sellerInn}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Выплата на руки (100%):</span>
                  <span className="font-black text-emerald-700 font-mono">
                    {formatRubles(cleanReturnDomExit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Документов в облачном сейфе S3:</span>
                  <span className="font-bold text-indigo-700">{vaultDocs.length} шт.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/portal?tab=seller')}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                >
                  <span>Открыть кабинет продавца</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/client/tracker/${createdDealId}`)}
                  className="py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Трекер сделки 5 этапов
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftLotCode(`U-${Math.floor(12000 + Math.random() * 87000)}`);
                    setVaultDocs([]);
                    setCurrentStep(1);
                  }}
                  className="py-3.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Новый расчет
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Bottom 3 Guarantee Cards & Telegram Banner */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">214-ФЗ регламентирован</h4>
            <p className="text-xs text-slate-600">
              Сделка регистрируется государством в Росреестре строго по ст. 11 Федерального закона № 214-ФЗ.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">Сбербанк & ВТБ аккредитив</h4>
            <p className="text-xs text-slate-600">
              Деньги депонируются покупателем до подписания договора и выплачиваются продавцу автоматически.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <Lock className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">0 ₽ комиссий с продавца</h4>
            <p className="text-xs text-slate-600">
              Все расходы по юридическому оформлению и вознаграждению сервиса несет покупатель.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 border border-sky-200 text-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-slate-900">Сложная ситуация с ДДУ?</h3>
            <p className="text-xs text-slate-600 max-w-lg">
              Использован материнский капитал, есть просроченный платеж или застройщик отказывает в уступке? Дежурный юрист решит вопрос индивидуально.
            </p>
          </div>
          <a
            href="https://t.me/domexit_ru"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Консультация в Telegram</span>
          </a>
        </div>
      </section>

      {/* Production-Ready Cloud Document Vault Modal */}
      <DocumentVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        entityType="lot"
        entityId={draftLotCode}
        entityTitle={`${complexName} (${developerName})`}
        uploadedByUid={currentUid}
        clientCode={clientCode}
        mode="seller"
        canUpload={true}
        canReview={false}
        onDocumentsChanged={(docs) => setVaultDocs(docs)}
      />
    </div>
  );
};
