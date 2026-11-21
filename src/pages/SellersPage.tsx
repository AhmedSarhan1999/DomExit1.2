import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { getStoredReferralCode, setStoredReferralCode } from '../utils/referralTracker';
import { SellerRequestsRepository } from '../dal/repositories/SellerRequestsRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { DevelopersRepository } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { StorageService } from '../dal/StorageService';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
import {
  getDistrictsForRegion,
  getRegionByCode,
} from '../data/russianGeography';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  sanitizeDigitsOnly,
  validateDduOrLotCode,
  validateIndividualInn,
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
import { usePublicChannelsStore } from '../stores/usePublicChannelsStore';
import { ConsentState } from '../components/compliance/ConsentCheckboxes';
import { UserConsentsRepository } from '../dal/repositories/UserConsentsRepository';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { AccreditedDeveloper, DocumentMetadata, Lot, RussianCityCode, PropertyDealTrack } from '../types';
import { DEFAULT_SETTLEMENT_BANKS } from '../data/russianBanks';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Send,
  Building,
  Home,
} from 'lucide-react';
import { GosuslugiEgrnGuide } from '../components/shared/GosuslugiEgrnGuide';

// Modular Subcomponents
import { SellerStepProperty } from '../components/sellers/SellerStepProperty';
import { SellerLiveAuditCard } from '../components/sellers/SellerLiveAuditCard';
import { SellerStepIdentity } from '../components/sellers/SellerStepIdentity';
import { SellerStepDocuments } from '../components/sellers/SellerStepDocuments';
import { SellerStepConfirmation } from '../components/sellers/SellerStepConfirmation';
import { SellerDemandRadarBanner } from '../components/sellers/SellerDemandRadarBanner';

export const SellersPage: React.FC = () => {
  const { language } = useLanguage();
  const { user, login, openAuthModal, updateUserProfile } = useAuth();
  const { channels } = usePublicChannelsStore();
  const navigate = useNavigate();

  // Wizard Step (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftLotCode, setDraftLotCode] = useState<string>(
    () => `U-${Math.floor(12000 + Math.random() * 87000)}`
  );

  // Geographic & Property Parameters (Phase 1 & 2)
  const [locationRegion, setLocationRegion] = useState<RussianCityCode>('spb');
  const [district, setDistrict] = useState<string>('Приморский район');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [metroName, setMetroName] = useState<string>('');
  const [metroTime, setMetroTime] = useState<string>('10');
  const [metroTransport, setMetroTransport] = useState<'walk' | 'transport'>('walk');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);

  // Field interaction tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  // Double-submit prevention lock
  const submitLockRef = useRef<boolean>(false);

  const [accreditedDevelopers, setAccreditedDevelopers] = useState<AccreditedDeveloper[]>([]);
  const [isAddingNewDeveloper, setIsAddingNewDeveloper] = useState<boolean>(false);
  const [developerName, setDeveloperName] = useState<string>('');
  const [developerInn, setDeveloperInn] = useState<string>('');
  const [complexName, setComplexName] = useState<string>('');
  const [dduCode, setDduCode] = useState<string>('');
  const [rooms, setRooms] = useState<Lot['rooms']>('1-room');
  const [areaM2, setAreaM2] = useState<string>('');
  const [floor, setFloor] = useState<string>('');
  const [totalFloors, setTotalFloors] = useState<string>('');
  const [exitRoute, setExitRoute] = useState<'ddu_assignment' | 'fast_cash' | 'trade_in_6'>(
    'ddu_assignment'
  );
  const [dealTrack, setDealTrack] = useState<PropertyDealTrack>('ddu_cession');

  // Financial Parameters
  const [contractPriceStr, setContractPriceStr] = useState<string>('');
  const [paidAmountStr, setPaidAmountStr] = useState<string>('');
  const [todayMarketPriceStr, setTodayMarketPriceStr] = useState<string>('');
  const [usedMatkap, setUsedMatkap] = useState<'no' | 'yes'>('no');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);
  const [penaltyRatePercent, setPenaltyRatePercent] = useState<number>(15);
  const [isNegotiable, setIsNegotiable] = useState<boolean>(false);
  const [sellerBanks, setSellerBanks] = useState<string[]>(DEFAULT_SETTLEMENT_BANKS);

  // Step 2 Seller Identity & Russian Validation
  const [sellerName, setSellerName] = useState<string>(user?.name || '');
  const [sellerPhone, setSellerPhone] = useState<string>(
    user?.phone ? formatRussianPhoneInput(user.phone) : '+7 ('
  );
  const [sellerInn, setSellerInn] = useState<string>(user?.inn || '');
  const [partnerRefCode, setPartnerRefCode] = useState<string>('');
  const [isPartnerLocked, setIsPartnerLocked] = useState<boolean>(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user?.name && !sellerName) setSellerName(user.name);
    if (user?.phone && (sellerPhone === '+7 (' || !sellerPhone)) setSellerPhone(formatRussianPhoneInput(user.phone));
    if (user?.inn && !sellerInn) setSellerInn(user.inn);
  }, [user]);

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam && refParam.trim()) {
      const cleanRef = refParam.trim().toUpperCase();
      setPartnerRefCode(cleanRef);
      setIsPartnerLocked(true);
      setStoredReferralCode(cleanRef);
    } else {
      const stored = getStoredReferralCode();
      if (stored) {
        setPartnerRefCode(stored);
        setIsPartnerLocked(true);
      }
    }
  }, [searchParams]);

  // Validation Error State
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 3 Cloud Document Vault & Photos
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [vaultDocs, setVaultDocs] = useState<DocumentMetadata[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [consents, setConsents] = useState<ConsentState>({
    pdProcessing: false,
    termsAgreed: false,
    ads: false,
  });

  // Step 4 Created IDs
  const [createdDealId, setCreatedDealId] = useState<string>('');
  const [createdLotCode, setCreatedLotCode] = useState<string>('');

  useEffect(() => {
    MarketSettingsRepository.getSettings().then((s) => {
      if (s?.developerPenaltyPercent) setPenaltyRatePercent(s.developerPenaltyPercent);
    });
    const loadDevs = () => {
      DevelopersRepository.getAllDevelopers().then((rawDevs) => {
        const devs = rawDevs.filter((d) => d.isActive !== false);
        setAccreditedDevelopers(devs);
        if (devs.length === 0) {
          setIsAddingNewDeveloper(true);
          setDeveloperName('');
          setDeveloperInn('');
        } else if (devs.length > 0 && !developerName) {
          setDeveloperName(devs[0].name);
          setDeveloperInn(devs[0].inn || '');
        }
      });
    };
    loadDevs();
    const unsub = DatabaseGateway.subscribe((col) => {
      if (!col || col === 'developers') loadDevs();
    });
    return () => unsub();
  }, []);

  const activeRegionConfig = getRegionByCode(locationRegion);

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

  const clientCode = user?.clientCode || (user?.id ? `DEX-${user.id.slice(-6)}` : `DEX-${String(Date.now()).slice(-6)}`);
  const currentUid = user?.id || '';

  const handleGoToStep2 = async () => {
    setStep1Error(null);

    const devCheck = validateTextEntityName(developerName, 'Наименование застройщика');
    if (!devCheck.valid) {
      markTouched('developerName');
      setStep1Error(language === 'ru' ? devCheck.messageRu! : devCheck.messageEn!);
      return;
    }

    if (isAddingNewDeveloper) {
      const cleanDevInn = developerInn.replace(/\D/g, '');
      if (cleanDevInn.length !== 10 && cleanDevInn.length !== 12) {
        markTouched('developerInn');
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
      markTouched('complexName');
      setStep1Error(language === 'ru' ? complexCheck.messageRu! : complexCheck.messageEn!);
      return;
    }

    if (usedMatkap === 'yes') {
      markTouched('usedMatkap');
      setStep1Error(
        language === 'ru'
          ? 'Объекты с использованием материнского капитала требуют предварительного разрешения органов опеки и не принимаются на платформу DomExit.'
          : 'Units bought with maternity capital require guardianship approval and are not accepted on DomExit.'
      );
      return;
    }

    const dduCheck = validateDduOrLotCode(dduCode);
    if (!dduCheck.valid) {
      markTouched('dduCode');
      setStep1Error(language === 'ru' ? dduCheck.messageRu! : dduCheck.messageEn!);
      return;
    }

    const parsedArea = Number(areaM2);
    const parsedFloor = Number(floor);
    const parsedTotalFloors = Number(totalFloors);

    if (!Number.isFinite(parsedArea) || parsedArea < 16 || parsedArea > 500) {
      markTouched('areaM2');
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
      markTouched('floor');
      markTouched('totalFloors');
      setStep1Error(
        language === 'ru'
          ? 'Проверьте корректность этажа и общей этажности корпуса (этаж не может превышать этажность дома).'
          : 'Floor must be between 1 and total building floors.'
      );
      return;
    }

    if (!financialValidation.valid) {
      markTouched('contractPrice');
      markTouched('paidAmount');
      setStep1Error(
        language === 'ru'
          ? financialValidation.paidErrorRu || financialValidation.contractErrorRu!
          : financialValidation.paidErrorEn || financialValidation.contractErrorEn!
      );
      return;
    }

    if (isAddingNewDeveloper) {
      if (!developerName.trim()) {
        markTouched('developerName');
        setStep1Error('Укажите наименование нового застройщика.');
        return;
      }
      if (!isValidInn(developerInn)) {
        markTouched('developerInn');
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
      markTouched('sellerName');
      setStep2Error(language === 'ru' ? nameCheck.messageRu! : nameCheck.messageEn!);
      return;
    }

    if (!isValidRussianPhone(sellerPhone)) {
      markTouched('sellerPhone');
      setStep2Error(
        language === 'ru'
          ? 'Введите телефон в едином российском формате: +7 (XXX) XXX-XX-XX.'
          : 'Phone must match Russian standard: +7 (XXX) XXX-XX-XX.'
      );
      return;
    }

    const innCheck = validateIndividualInn(sellerInn, true);
    if (!innCheck.valid) {
      markTouched('sellerInn');
      setStep2Error(language === 'ru' ? innCheck.messageRu! : innCheck.messageEn!);
      return;
    }

    if (user && !user.inn && sellerInn.trim() && updateUserProfile) {
      updateUserProfile({ inn: sellerInn.trim() }).catch((err) =>
        console.warn('[SellersPage] Non-fatal auto-save INN to profile:', err)
      );
    }

    const existingDocs = await StorageService.getDocumentsByEntity('lot', draftLotCode);
    setVaultDocs(existingDocs);
    setCurrentStep(3);
  };

  const handleAddCustomPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      setIsUploadingPhoto(true);
      try {
        const optimized = await optimizeImageFile(file);
        const { publicUrl } = await StorageService.uploadPhoto({
          file: optimized,
          fileName: file.name,
          lotCode: draftLotCode,
          contentType: optimized.type || 'image/webp',
        });
        setUploadedPhotos((prev) => [...prev, publicUrl]);
      } catch (err: any) {
        console.error('[SellersPage] Failed to upload photo to S3:', err);
        alert(
          language === 'ru'
            ? 'Сбой загрузки фото в облако S3. Пожалуйста, повторите попытку.'
            : 'Failed to upload photo to S3. Please try again.'
        );
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleSubmitFinal = async () => {
    setStep3Error(null);
    if (submitLockRef.current || isSubmitting) {
      return;
    }
    if (usedMatkap === 'yes') {
      setStep3Error(
        language === 'ru'
          ? 'Отправка заявки заблокирована: переуступка прав по ДДУ с использованием материнского капитала не поддерживается.'
          : 'Submission blocked: maternity capital exits are not accepted.'
      );
      return;
    }

    if (vaultDocs.length === 0) {
      setStep3Error(
        language === 'ru'
          ? 'Загрузите хотя бы основной документ (Скан договора ДДУ / Справку об оплате) в хранилище документов перед отправкой.'
          : 'Please upload at least your DDU scan in the Document Vault before submitting.'
      );
      return;
    }

    if (!consents.pdProcessing || !consents.termsAgreed) {
      setStep3Error(
        language === 'ru'
          ? 'Пожалуйста, подтвердите согласие на обработку персональных данных и согласие с условиями сервиса перед отправкой.'
          : 'Please accept personal data processing and terms of service before submitting.'
      );
      return;
    }

    submitLockRef.current = true;
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
            streetAddress: streetAddress.trim() || undefined,
            metroName: metroName.trim() || undefined,
            metroTime: metroTime ? Number(metroTime) || 10 : undefined,
            metroTransport,
            coordinates,
            todayDeveloperPrice: todayMarketPrice > 0 ? todayMarketPrice : undefined,
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
            dealTrack,
            exitRoute,
            isNegotiable,
            sellerBanks,
            documentIds: vaultDocs.map((d) => d.id),
            photos: uploadedPhotos,
            sellerUploadedPhotos: uploadedPhotos,
            matCapitalUsed: false,
            referredByPartnerCode: partnerRefCode.trim() || undefined,
          });

          if (isAddingNewDeveloper) {
            try {
              await DevelopersRepository.createAccreditationRequest({
                developerName: developerName.trim(),
                developerInn: developerInn.trim() || '7700000000',
                lotId: result.lot.id,
                lotCode: result.lot.lotCode,
                complexName: complexName.trim(),
                city: locationRegion,
                district,
                contractPriceRub: contractPrice,
                sellerName: sellerName.trim(),
                sellerClientCode: activeUser.clientCode || (activeUser.id ? `DEX-${activeUser.id.slice(-6)}` : `DEX-${String(Date.now()).slice(-6)}`),
                documentIds: vaultDocs.map((d) => d.id),
              });
            } catch (devErr) {
              console.warn('[SellersPage] Non-fatal developer accreditation submit:', devErr);
            }
          }

          if (uploadedPhotos.length > 0) {
            result.lot.sellerUploadedPhotos = uploadedPhotos;
            result.lot.sellerSubmittedImages = uploadedPhotos;
            result.lot.imageUrl = '';
            result.lot.images = [];
            result.lot.galleryImages = [];
            result.lot.approvedGalleryImages = [];
            if (todayMarketPrice > contractPrice) {
              result.lot.todayDeveloperPrice = todayMarketPrice;
            }
            await LotsRepository.update(result.lot);
          }

          // Strict Persistence Verification
          const verifiedLot = await LotsRepository.getByCode(result.lot.lotCode);
          if (!verifiedLot) {
            await LotsRepository.add(result.lot);
          }

          await login({
            ...activeUser,
            name: sellerName.trim(),
            phone: sellerPhone,
            inn: activeUser.inn || sellerInn.trim() || undefined,
            roles: activeUser.roles.includes('seller')
              ? activeUser.roles
              : [...activeUser.roles, 'seller'],
            activeRole: 'seller',
            activeDealId: result.dealId,
          });

          await UserConsentsRepository.recordConsent({
            userId: activeUser.id,
            phone: sellerPhone,
            email: activeUser.email,
            consents,
            context: 'seller_wizard_submission',
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
      submitLockRef.current = false;
    }
  };

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
                  ? 'Экспресс-аудит договоров цессии и рассрочки • 7 регионов РФ'
                  : 'Express Assignment Audit • 7 Russian Regions'}
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
                        ? 'Защищенное хранилище документов сделки'
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
                    ? 'Конфиденциальный сервис платформы. Точный этаж и номер квартиры маскируются в публичном каталоге.'
                    : 'Confidential service. Exact floor and apartment number are masked in the public catalog.'}
                </span>
              </div>
              <span className="font-mono font-bold text-indigo-800 bg-white px-2.5 py-0.5 rounded border border-sky-200">
                Резерв лота: #{draftLotCode}
              </span>
            </div>
          </div>

          {/* STEP 1: Geography, Property Details & Financial Truth Validation */}
          {currentStep === 1 && (
            <div className="flex flex-col lg:flex-row lg:items-start gap-6 xl:gap-8 w-full">
              <div className="w-full lg:flex-1 min-w-0">
                {/* Dual-Track Mode Switcher */}
                <div className="mb-6 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 inline-flex flex-wrap items-center gap-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setDealTrack('ddu_cession')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      dealTrack === 'ddu_cession'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Уступка ДДУ (214-ФЗ / Новостройка)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDealTrack('secondary_dkp');
                      if (!paidAmountStr && contractPriceStr) {
                        setPaidAmountStr(contractPriceStr);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      dealTrack === 'secondary_dkp'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 text-amber-600" />
                    <span>Вторичное жилье (ДКП / 218-ФЗ)</span>
                  </button>
                </div>

                {/* Real-time Liquidity Demand Radar Banner */}
                <SellerDemandRadarBanner
                  city={locationRegion}
                  priceRub={Number(contractPriceStr || 0)}
                  dealTrack={dealTrack}
                />

                <SellerStepProperty
                user={user}
                onOpenAuthModal={() => {
                  openAuthModal('Авторизуйтесь в личном кабинете для подачи заявки на выход из ДДУ');
                }}
                step1Error={step1Error}
                locationRegion={locationRegion}
                onRegionChange={handleRegionChange}
                district={district}
                onDistrictChange={setDistrict}
                streetAddress={streetAddress}
                onStreetAddressChange={setStreetAddress}
                onSelectAddressDetails={(details) => {
                  setStreetAddress(details.address);
                  if (details.coordinates) setCoordinates(details.coordinates);
                  if (details.nearestMetro) {
                    setMetroName(details.nearestMetro.name);
                    const travelMatch = details.nearestMetro.travelTimeText.match(/^(\d+)/);
                    if (travelMatch) setMetroTime(travelMatch[1]);
                    setMetroTransport(details.nearestMetro.mode === 'drive' ? 'transport' : 'walk');
                  }
                  if (details.district) {
                    const regionDistricts = getDistrictsForRegion(locationRegion);
                    const matchedDist = regionDistricts.find(
                      (d) =>
                        d.nameRu.toLowerCase().includes(details.district!.toLowerCase()) ||
                        details.district!.toLowerCase().includes(d.nameRu.toLowerCase())
                    );
                    if (matchedDist) setDistrict(matchedDist.nameRu);
                  }
                }}
                metroName={metroName}
                onMetroNameChange={setMetroName}
                metroTime={metroTime}
                onMetroTimeChange={setMetroTime}
                metroTransport={metroTransport}
                onMetroTransportChange={setMetroTransport}
                developerName={developerName}
                onDeveloperNameChange={setDeveloperName}
                developerInn={developerInn}
                onDeveloperInnChange={setDeveloperInn}
                isAddingNewDeveloper={isAddingNewDeveloper}
                onToggleAddingNewDeveloper={() => {
                  if (!isAddingNewDeveloper) {
                    setIsAddingNewDeveloper(true);
                    setDeveloperName('');
                    setDeveloperInn('');
                  } else {
                    setIsAddingNewDeveloper(false);
                    setDeveloperName(accreditedDevelopers[0]?.name || 'Сетл Групп');
                    setDeveloperInn(accreditedDevelopers[0]?.inn || '7810245481');
                  }
                }}
                accreditedDevelopers={accreditedDevelopers}
                complexName={complexName}
                onComplexNameChange={setComplexName}
                dduCode={dduCode}
                onDduCodeChange={setDduCode}
                rooms={rooms}
                onRoomsChange={setRooms}
                areaM2={areaM2}
                onAreaM2Change={setAreaM2}
                floor={floor}
                onFloorChange={setFloor}
                totalFloors={totalFloors}
                onTotalFloorsChange={setTotalFloors}
                contractPriceStr={contractPriceStr}
                onContractPriceStrChange={setContractPriceStr}
                paidAmountStr={paidAmountStr}
                onPaidAmountStrChange={setPaidAmountStr}
                todayMarketPriceStr={todayMarketPriceStr}
                onTodayMarketPriceStrChange={setTodayMarketPriceStr}
                contractPrice={contractPrice}
                paidAmount={paidAmount}
                financialValidation={financialValidation}
                exitRoute={exitRoute}
                onExitRouteChange={setExitRoute}
                usedMatkap={usedMatkap}
                onUsedMatkapChange={setUsedMatkap}
                isNegotiable={isNegotiable}
                onIsNegotiableChange={setIsNegotiable}
                sellerBanks={sellerBanks}
                onSellerBanksChange={setSellerBanks}
                agreeTerms={agreeTerms}
                onAgreeTermsChange={setAgreeTerms}
                touched={touched}
                markTouched={markTouched}
                onGoToStep2={handleGoToStep2}
              />
            </div>

            <div className="w-full lg:w-[380px] xl:w-[420px] lg:shrink-0 lg:sticky lg:top-24">
              <SellerLiveAuditCard
                contractPrice={contractPrice}
                paidAmount={paidAmount}
                todayMarketPrice={todayMarketPrice}
                penaltyRatePercent={penaltyRatePercent}
                activeRegionConfig={activeRegionConfig}
                district={district}
                cleanReturnDomExit={cleanReturnDomExit}
                devPenalty={devPenalty}
                netFamilyBenefit={netFamilyBenefit}
              />
            </div>
          </div>
          )}

          {/* STEP 2: Strict Seller Contact & ИНН Validation */}
          {currentStep === 2 && (
            <SellerStepIdentity
              sellerName={sellerName}
              onSellerNameChange={setSellerName}
              sellerPhone={sellerPhone}
              onSellerPhoneChange={setSellerPhone}
              sellerInn={sellerInn}
              onSellerInnChange={setSellerInn}
              partnerRefCode={partnerRefCode}
              onPartnerRefCodeChange={setPartnerRefCode}
              isPartnerLocked={isPartnerLocked}
              step2Error={step2Error}
              touched={touched}
              markTouched={markTouched}
              onBackToStep1={() => setCurrentStep(1)}
              onGoToStep3={handleGoToStep3}
            />
          )}

          {/* STEP 3: Production-Ready Cloud Document Vault */}
          {currentStep === 3 && (
            <SellerStepDocuments
              draftLotCode={draftLotCode}
              step3Error={step3Error}
              vaultDocs={vaultDocs}
              onOpenVault={() => setIsVaultOpen(true)}
              uploadedPhotos={uploadedPhotos}
              isUploadingPhoto={isUploadingPhoto}
              onAddCustomPhoto={handleAddCustomPhoto}
              onRemovePhoto={(index) => setUploadedPhotos((prev) => prev.filter((_, i) => i !== index))}
              consents={consents}
              onConsentsChange={setConsents}
              isSubmitting={isSubmitting}
              usedMatkap={usedMatkap}
              onBackToStep2={() => setCurrentStep(2)}
              onSubmitFinal={handleSubmitFinal}
            />
          )}

          {/* STEP 4: Live Confirmation */}
          {currentStep === 4 && (
            <SellerStepConfirmation
              createdDealId={createdDealId}
              createdLotCode={createdLotCode}
              cleanReturnDomExit={cleanReturnDomExit}
              activeRegionConfig={activeRegionConfig}
              complexName={complexName}
              district={district}
              sellerName={sellerName}
              sellerInn={sellerInn}
              vaultDocsCount={vaultDocs.length}
              onOpenSellerPortal={() => navigate('/portal?tab=seller')}
              onOpenTracker={(dealId) => navigate(`/client/tracker/${dealId}`)}
              onResetNewCalculation={() => {
                setDraftLotCode(`U-${Math.floor(12000 + Math.random() * 87000)}`);
                setVaultDocs([]);
                setCurrentStep(1);
              }}
            />
          )}
        </div>
      </section>

      {/* 3. Bottom 3 Guarantee Cards & Telegram Banner */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">Государственная регистрация</h4>
            <p className="text-xs text-slate-600">
              Сделка и уступка прав регистрируются в Росреестре с полной юридической защитой участников.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">Сбербанк / ВТБ аккредитив</h4>
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
            href={channels.telegramBotUrl || channels.telegramChannelUrl}
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
