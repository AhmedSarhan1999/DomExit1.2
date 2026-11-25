import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles, formatPercent } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { StorageService } from '../dal/StorageService';
import { Lot, RussianCityCode, MetroStationInfo } from '../types';
import { RUSSIAN_BANKS, DEFAULT_SETTLEMENT_BANKS } from '../data/russianBanks';
import { showDownloadToast } from '../utils/downloadManager';
import {
  Lock,
  QrCode,
  Send,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Upload,
  MapPin,
  Building,
  Home,
  DollarSign,
  Star,
  Globe,
  Sparkles,
  EyeOff,
  Ban,
  Trash2,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { AddressAutocompleteInput } from '../components/maps/AddressAutocompleteInput';
import { compressImageToWebP } from '../utils/imageCompressor';

export const AdminPackagingPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleLots, setAccessibleLots] = useState<Lot[]>([]);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // 152-FZ Privacy & Floor
  const [hideFloor, setHideFloor] = useState<boolean>(true);
  const [floorRangeText, setFloorRangeText] = useState<string>('');

  // Spatial & Transport
  const [city, setCity] = useState<RussianCityCode>('spb');
  const [district, setDistrict] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [metroName, setMetroName] = useState<string>('');
  const [metroTime, setMetroTime] = useState<string>('');
  const [metroMode, setMetroMode] = useState<'walk' | 'drive'>('walk');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);

  // Technical Specs
  const [complexName, setComplexName] = useState<string>('');
  const [developer, setDeveloper] = useState<string>('');
  const [areaM2, setAreaM2] = useState<number>(0);
  const [rooms, setRooms] = useState<string>('1-room');
  const [floor, setFloor] = useState<number>(0);
  const [totalFloors, setTotalFloors] = useState<number>(0);
  const [ceilingHeightM, setCeilingHeightM] = useState<number>(2.78);
  const [finishing, setFinishing] = useState<string>('clean');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryYear, setDeliveryYear] = useState<number>(new Date().getFullYear() + 1);
  const [transactionType, setTransactionType] = useState<string>('installment_cession');
  const [constructionReadinessPercent, setConstructionReadinessPercent] = useState<number>(80);
  const [districtAvgPricePerM2, setDistrictAvgPricePerM2] = useState<number>(0);

  // Financial Truth Engine numeric inputs
  const [oldDduPrice, setOldDduPrice] = useState<number>(0);
  const [cashToSeller, setCashToSeller] = useState<number>(0);
  const [debtToDev, setDebtToDev] = useState<number>(0);
  const [todayDevPrice, setTodayDevPrice] = useState<number>(0);
  const [developerConsentFeeRub, setDeveloperConsentFeeRub] = useState<number>(0);
  const [developerConsentPolicy, setDeveloperConsentPolicy] = useState<'included_in_platform_fee' | 'paid_by_buyer'>('included_in_platform_fee');
  const [escrowBank, setEscrowBank] = useState<string>('Сбербанк');
  const [contractTemplateRequirement, setContractTemplateRequirement] = useState<'developer_template' | 'domexit_template'>('developer_template');
  const [isNegotiable, setIsNegotiable] = useState<boolean>(false);
  const [sellerBanks, setSellerBanks] = useState<string[]>(DEFAULT_SETTLEMENT_BANKS);

  // Media materials state
  const [sellerPhotos, setSellerPhotos] = useState<string[]>([]);
  const [approvedPhotos, setApprovedPhotos] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || (isEmployee ? user?.id || '' : '');
  const operatorName =
    user?.name || (isEmployee ? 'Куратор DomExit' : 'Ahmed Abdallah (Владелец / CEO)');

  const hydrateLotState = (data: Lot) => {
    setLot(data);

    // 152-FZ
    setHideFloor(data.ownerDossier?.hideExactFloor ?? true);
    const computedFloorRange =
      data.floor > 0
        ? `${Math.max(1, data.floor - 1)}–${Math.min(
            data.totalFloors || data.floor + 2,
            data.floor + 1
          )} этаж`
        : '';
    setFloorRangeText(data.ownerDossier?.floorRangeDisplay || computedFloorRange);

    // Spatial
    setCity(data.city || 'spb');
    setDistrict(data.district || '');
    setStreetAddress(data.streetAddress || '');
    setCoordinates(data.coordinates);
    if (data.metroStations && data.metroStations.length > 0) {
      const cleanStation = (data.metroStations[0].name || '').replace(/^м\.\s*/i, '').replace(/^метро\s*/i, '');
      setMetroName(cleanStation);
      setMetroTime(data.metroStations[0].travelTimeText || '');
      setMetroMode(data.metroStations[0].mode || 'walk');
    } else {
      setMetroName('');
      setMetroTime('');
      setMetroMode('walk');
    }

    // Technical
    setComplexName(data.complexName || '');
    setDeveloper(data.developer || '');
    setAreaM2(data.areaM2 || 0);
    setRooms(data.rooms || '1-room');
    setFloor(data.floor || 0);
    setTotalFloors(data.totalFloors || 0);
    setCeilingHeightM(data.ceilingHeightM || 2.78);
    setFinishing(data.finishing || 'clean');
    setDeliveryDate(data.deliveryDate || '');
    setDeliveryYear(data.deliveryYear || 2026);
    setTransactionType(data.transactionType || 'installment_cession');
    setConstructionReadinessPercent(data.constructionReadinessPercent || 80);
    setDistrictAvgPricePerM2(data.districtAvgPricePerM2 || 0);

    // Financial
    setOldDduPrice(data.dduContractPrice || 0);
    setCashToSeller(data.cashPaidBySeller || 0);
    setDebtToDev(data.remainingInstallmentDebt || 0);
    setTodayDevPrice(data.todayDeveloperPrice || 0);
    setDeveloperConsentFeeRub(data.developerConsentFeeRub || 0);
    setDeveloperConsentPolicy(data.developerConsentPolicy || 'included_in_platform_fee');
    setEscrowBank(data.escrowBank || 'Сбербанк');
    setContractTemplateRequirement(data.contractTemplateRequirement || 'developer_template');
    setIsNegotiable(Boolean(data.isNegotiable || (data as any).is_negotiable));
    const banks = (data as any).seller_banks || data.sellerBanks;
    setSellerBanks(Array.isArray(banks) && banks.length > 0 ? banks : DEFAULT_SETTLEMENT_BANKS);

    // Media: Distinct seller raw submissions vs admin-approved public photos
    const sPhotos =
      data.sellerSubmittedImages && data.sellerSubmittedImages.length > 0
        ? data.sellerSubmittedImages
        : data.sellerUploadedPhotos && data.sellerUploadedPhotos.length > 0
        ? data.sellerUploadedPhotos
        : [];
    setSellerPhotos(sPhotos);

    const aPhotos =
      data.images && data.images.length > 0
        ? data.images
        : data.approvedGalleryImages && data.approvedGalleryImages.length > 0
        ? data.approvedGalleryImages
        : data.galleryImages && data.galleryImages.length > 0
        ? data.galleryImages
        : [];
    setApprovedPhotos(aPhotos);
    setCoverImageUrl(data.imageUrl || aPhotos[0] || '');
  };

  useEffect(() => {
    async function load() {
      const isOwner = user?.role === 'owner' || user?.activeRole === 'owner';
      const isEmp = user?.activeRole === 'employee' && !isOwner;
      let pool = isEmp
        ? await LotsRepository.getByAssignedEmployee(currentEmployeeId)
        : await LotsRepository.getAll({ includePendingApproval: true });

      const code = (lotId || '').toUpperCase();
      let matched: Lot | null = code
        ? pool.find((l) => l.lotCode.toUpperCase() === code || l.id.toUpperCase() === code) || null
        : pool[0] || null;

      if (!matched && code) {
        matched = (await LotsRepository.getByCode(code)) || null;
        if (matched && !pool.some((p) => p.lotCode.toUpperCase() === matched!.lotCode.toUpperCase())) {
          pool = [matched, ...pool];
        }
      }

      const seenPoolCodes = new Set<string>();
      pool = pool.filter((l) => {
        const c = (l.lotCode || l.id || '').toUpperCase();
        if (!c || seenPoolCodes.has(c)) return false;
        seenPoolCodes.add(c);
        return true;
      });

      setAccessibleLots(pool);

      if (matched) {
        hydrateLotState(matched);
      } else {
        setLot(null);
      }
    }
    load();
  }, [lotId, isEmployee, currentEmployeeId, user]);

  const grossSavings = Math.max(0, todayDevPrice - oldDduPrice);
  const consentBuyerDeduction =
    developerConsentPolicy === 'paid_by_buyer' ? Number(developerConsentFeeRub || 0) : 0;
  const buyerNetSavings = Math.max(0, grossSavings - consentBuyerDeduction);
  const buyerDiscountPercent =
    todayDevPrice > 0 ? (buyerNetSavings / todayDevPrice) * 100 : 0;
  const buyerFee = Math.round(oldDduPrice * 0.025);
  const dduPricePerM2 = Math.round(oldDduPrice / Math.max(areaM2, 1));
  const devPricePerM2 = Math.round(todayDevPrice / Math.max(areaM2, 1));

  const handleTogglePhotoApproval = (photoUrl: string) => {
    setApprovedPhotos((prev) => {
      if (prev.includes(photoUrl)) {
        const next = prev.filter((p) => p !== photoUrl);
        if (coverImageUrl === photoUrl) {
          setCoverImageUrl(next[0] || '');
        }
        return next;
      } else {
        const next = [...prev, photoUrl];
        if (!coverImageUrl) {
          setCoverImageUrl(photoUrl);
        }
        return next;
      }
    });
  };

  const handleSetCoverPhoto = (photoUrl: string) => {
    setCoverImageUrl(photoUrl);
    setApprovedPhotos((prev) => {
      const filtered = prev.filter((p) => p !== photoUrl);
      return [photoUrl, ...filtered];
    });
    setNotificationMsg('Главная фотография обложки обновлена (будет первой в каталоге)!');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleDeletePhoto = (photoUrl: string) => {
    if (!confirm('Удалить эту фотографию из галереи объекта?')) return;
    setApprovedPhotos((prev) => {
      const next = prev.filter((p) => p !== photoUrl);
      if (coverImageUrl === photoUrl) {
        setCoverImageUrl(next[0] || '');
      }
      return next;
    });
    setSellerPhotos((prev) => prev.filter((p) => p !== photoUrl));
    setNotificationMsg('Фотография удалена.');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleMovePhoto = (photoUrl: string, direction: 'left' | 'right') => {
    setApprovedPhotos((prev) => {
      const index = prev.indexOf(photoUrl);
      if (index === -1) return prev;
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      if (targetIndex === 0 || index === 0) {
        setCoverImageUrl(next[0]);
      }
      return next;
    });
  };

  const handleUploadHdMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && lot) {
      try {
        setNotificationMsg('Загрузка фото в Yandex S3...');
        const newAddedUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const rawFile = files[i];
          const compressed = await compressImageToWebP(rawFile, { maxWidth: 1600, quality: 0.82 });
          const fileToUpload = compressed.file;
          const savedDoc = await StorageService.uploadDocument({
            file: fileToUpload,
            category: 'additional',
            categoryLabelRu: `HD-фото упаковки: ${fileToUpload.name}`,
            entityType: 'lot',
            entityId: lot.lotCode,
            uploadedByUid: user?.id || 'curator-packaging',
            clientCode: user?.clientCode || 'DEX-STAFF',
          });

          const uploadedUrl = savedDoc.cloudUrl || savedDoc.file_url || savedDoc.url || savedDoc.previewDataUrl || '';
          if (uploadedUrl) {
            newAddedUrls.push(uploadedUrl);
          }
        }

        if (newAddedUrls.length > 0) {
          setSellerPhotos((prev) => [...prev, ...newAddedUrls]);
          setApprovedPhotos((prev) => [...prev, ...newAddedUrls]);
          setCoverImageUrl((prev) => prev || newAddedUrls[0]);
          setNotificationMsg(`Загружено ${newAddedUrls.length} фото в Yandex S3 и включено в каталог!`);
        }
        setTimeout(() => setNotificationMsg(null), 4000);
      } catch (err) {
        console.error('Packaging media upload error:', err);
        showDownloadToast('Ошибка загрузки файла в хранилище. Пожалуйста, повторите попытку.', 'error');
      }
    }
  };

  const buildUpdatedLotData = (): Lot => {
    if (!lot) throw new Error('No active lot');

    const cleanMetroTime = metroTime.trim();
    const formattedMetroTime = cleanMetroTime
      ? cleanMetroTime.includes('мин')
        ? cleanMetroTime
        : `${cleanMetroTime} мин. ${metroMode === 'walk' ? 'пешком' : 'транспортом'}`
      : metroMode === 'walk'
      ? '10 мин. пешком'
      : '10 мин. транспортом';

    const metroList: MetroStationInfo[] = metroName.trim()
      ? [
          {
            name: metroName.trim(),
            travelTimeText: formattedMetroTime,
            mode: metroMode,
            lineColor: city === 'msk' ? '#ED1B35' : '#0078C9',
          },
        ]
      : lot.metroStations || [];

    const effectiveCover = coverImageUrl || approvedPhotos[0] || lot.imageUrl;

    return {
      ...lot,
      complexName,
      developer,
      city,
      district,
      streetAddress,
      coordinates: coordinates || lot.coordinates,
      areaM2,
      rooms: rooms as any,
      floor,
      totalFloors,
      ceilingHeightM,
      finishing: finishing as any,
      deliveryDate,
      deliveryYear,
      transactionType: transactionType as any,
      constructionReadinessPercent,
      districtAvgPricePerM2,
      metroStations: metroList,
      dduContractPrice: oldDduPrice,
      cashPaidBySeller: cashToSeller,
      remainingInstallmentDebt: debtToDev,
      todayDeveloperPrice: todayDevPrice,
      serviceCommissionRub: buyerFee,
      developerConsentFeeRub,
      developerConsentPolicy,
      escrowBank,
      contractTemplateRequirement,
      isNegotiable,
      is_negotiable: isNegotiable,
      sellerBanks,
      seller_banks: sellerBanks,
      imageUrl: effectiveCover,
      images: approvedPhotos,
      approvedGalleryImages: approvedPhotos,
      galleryImages: approvedPhotos.length > 0 ? approvedPhotos : (effectiveCover ? [effectiveCover] : []),
      sellerUploadedPhotos: sellerPhotos,
      sellerSubmittedImages: sellerPhotos,
      ownerDossier: {
        ...lot.ownerDossier,
        hideExactFloor: hideFloor,
        floorRangeDisplay: floorRangeText,
      },
    };
  };

  const handleSaveDraft = async () => {
    if (!lot) return;
    const isLive = lot.isPublished || lot.status === 'available' || lot.status === 'in_deal';
    const updatedLot = buildUpdatedLotData();
    if (isLive) {
      updatedLot.isPublished = true;
      updatedLot.isApproved = true;
      if (updatedLot.status === 'draft') updatedLot.status = 'available';
    }
    await LotsRepository.update(updatedLot);
    setLot(updatedLot);
    setNotificationMsg(
      isLive
        ? 'Объявление моментально обновлено и синхронизировано с каталогом!'
        : 'Черновик упаковки успешно сохранен (без изменения статуса публикации).'
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handlePublishOpenCatalog = async () => {
    if (!lot) return;
    const updatedLot = buildUpdatedLotData();
    const result = await LotsRepository.publishToOpenCatalog(
      lot.lotCode,
      operatorName,
      updatedLot
    );
    if (result) {
      setLot(result);
      setNotificationMsg(
        `Лот #${lot.lotCode} успешно опубликован в ОТКРЫТОМ каталоге DomExit!`
      );
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  const handleUnpublishLot = async () => {
    if (!lot) return;
    if (!confirm(`Снять лот #${lot.lotCode} с публикации в каталоге?`)) return;
    try {
      const updated = await LotsRepository.unpublishLot(lot.lotCode, operatorName);
      if (updated) {
        setLot(updated);
        setNotificationMsg(`Лот #${lot.lotCode} снят с публикации и переведен в черновик.`);
        setTimeout(() => setNotificationMsg(null), 5000);
      }
    } catch (e: any) {
      alert(`Ошибка: ${e?.message || 'Сбой'}`);
    }
  };

  const handleBlockLot = async () => {
    if (!lot) return;
    const reason = prompt(
      'Укажите причину блокировки лота (будет сохранена в журнале и отображена продавцу):',
      'Нарушение условий размещения (недостоверные данные)'
    );
    if (!reason) return;
    try {
      const updated = await LotsRepository.blockLot(lot.lotCode, reason.trim(), operatorName);
      if (updated) {
        setLot(updated);
        setNotificationMsg(`Лот #${lot.lotCode} заблокирован.`);
        setTimeout(() => setNotificationMsg(null), 5000);
      }
    } catch (e: any) {
      alert(`Ошибка: ${e?.message || 'Сбой'}`);
    }
  };

  const handleDeleteLotAndDeal = async () => {
    if (!lot) return;
    if (
      !confirm(
        `ВНИМАНИЕ! Безвозвратно удалить лот #${lot.lotCode}, связанную сделку и заявки из базы данных платформы?`
      )
    )
      return;
    try {
      await LotsRepository.deleteLotAndDeal(lot.lotCode, operatorName);
      navigate('/admin/dashboard', { replace: true });
    } catch (e: any) {
      alert(`Ошибка при удалении: ${e?.message || 'Сбой'}`);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Студия упаковки и публикации лота #${lot?.lotCode || '—'}`}
          subtitle="Полное редактирование карточки объекта, конфиденциальность данных и финансовые расчеты"
        />

        {notificationMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              <span>{notificationMsg}</span>
            </div>
            <button
              onClick={() => setNotificationMsg(null)}
              className="text-white/80 hover:text-white ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-6 space-y-6 max-w-[1600px] w-full">
          {!lot ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                Нет доступных объектов в вашем контуре ответственности
              </p>
              <p className="text-xs text-slate-500">
                Ожидайте утверждения и назначения лотов Владельцем платформы.
              </p>
            </div>
          ) : (
            <>
              {/* Top Bar with Lot Switcher, Current Status, and 3 Primary Action Buttons */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/opportunities"
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>В каталог</span>
                  </Link>

                  <select
                    value={lot.lotCode}
                    onChange={(e) => navigate(`/admin/packaging/${e.target.value}`)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {accessibleLots.map((l) => (
                      <option key={l.id} value={l.lotCode}>
                        #{l.lotCode} — {l.complexName} ({l.district})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">Статус:</span>
                    {lot.isPublished ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-emerald-600" />
                        <span>Опубликован (Открытый)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs">
                        Черновик (Не опубликован)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      lot.isPublished || lot.status === 'available' || lot.status === 'in_deal'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {lot.isPublished || lot.status === 'available' || lot.status === 'in_deal' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Сохранить и обновить объявление</span>
                      </>
                    ) : (
                      <span>Сохранить черновик</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishOpenCatalog}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Опубликовать в открытом каталоге</span>
                  </button>
                </div>
              </div>

              {/* Admin Moderation & Governance Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Модерация и удаление объекта:
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    #{lot.lotCode}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(lot.isPublished || lot.status === 'available') && (
                    <button
                      type="button"
                      onClick={handleUnpublishLot}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Снять с публикации</span>
                    </button>
                  )}

                  {lot.status !== 'blocked' && (
                    <button
                      type="button"
                      onClick={handleBlockLot}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Заблокировать лот</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDeleteLotAndDeal}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить лот и сделку</span>
                  </button>
                </div>
              </div>

              {/* 2-Column Packaging Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column (7 cols): Editable Sections */}
                <div className="lg:col-span-7 space-y-6">

                  {/* Card 1: 152-ФЗ Protected Owner Dossier */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs relative">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2 text-rose-600">
                        <Lock className="w-4 h-4" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Закрытое досье собственника (Конфиденциально)
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                        Скрыто от публики
                      </span>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      Данные ниже видны только штатным юристам DomExit для подготовки цессии. Покупатель видит только номер лота #{lot.lotCode}.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1">ФИО Собственника:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier?.fullNameMasked || '***'}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Контактный телефон:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier?.phoneMasked || '***'}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Номер договора ДДУ:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier?.dduNumber || 'ДДУ-***'}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Точный номер квартиры:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier?.apartmentNumber || '***'}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Floor Hiding Toggle and Range */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={hideFloor}
                          onChange={(e) => setHideFloor(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">
                            Скрыть точный этаж от службы мониторинга застройщика {developer || lot.developer}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Вместо точного этажа покупателю будет отображаться безопасный диапазон.
                          </span>
                        </div>
                      </label>

                      {hideFloor && (
                        <div className="pt-2">
                          <label className="block text-slate-500 text-xs mb-1 font-semibold">
                            Безопасный диапазон этажа для публичного показа:
                          </label>
                          <input
                            type="text"
                            value={floorRangeText}
                            onChange={(e) => setFloorRangeText(e.target.value)}
                            placeholder="Например: 7–10 этаж"
                            className="w-full sm:w-1/2 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Spatial & Transport Data */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-900">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Географические и транспортные данные
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Город:</label>
                        <select
                          value={city}
                          onChange={(e) => setCity(e.target.value as RussianCityCode)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                        >
                          <option value="spb">Санкт-Петербург</option>
                          <option value="msk">Москва</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Район:</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="Приморский район"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-500 mb-1 font-semibold">Улица и номер дома (адрес):</label>
                        <AddressAutocompleteInput
                          value={streetAddress}
                          onChange={setStreetAddress}
                          cityCode={city}
                          placeholder="Комендантский пр., д. 58"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 text-xs"
                          onSelectAddress={(details) => {
                            setStreetAddress(details.address);
                            if (details.coordinates) {
                              setCoordinates(details.coordinates);
                            }
                            if (details.nearestMetro) {
                              setMetroName(details.nearestMetro.name);
                              const travelMatch = details.nearestMetro.travelTimeText.match(/^(\d+)/);
                              if (travelMatch) {
                                setMetroTime(travelMatch[1]);
                              }
                              setMetroMode(details.nearestMetro.mode);
                            }
                            if (details.district && !district) {
                              setDistrict(details.district);
                            }
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Ближайшая станция метро:</label>
                        <input
                          type="text"
                          value={metroName}
                          onChange={(e) => setMetroName(e.target.value)}
                          placeholder="Комендантский пр."
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-500 mb-1 font-semibold">Время в пути:</label>
                          <input
                            type="text"
                            value={metroTime}
                            onChange={(e) => setMetroTime(e.target.value)}
                            placeholder="10 мин."
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1 font-semibold">Способ:</label>
                          <select
                            value={metroMode}
                            onChange={(e) => setMetroMode(e.target.value as 'walk' | 'drive')}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                          >
                            <option value="walk">Пешком</option>
                            <option value="drive">На транспорте</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Technical Specifications */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-900">
                      <Home className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Технические спецификации лота
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Жилой комплекс (ЖК):</label>
                        <input
                          type="text"
                          value={complexName}
                          onChange={(e) => setComplexName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Застройщик:</label>
                        <input
                          type="text"
                          value={developer}
                          onChange={(e) => setDeveloper(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Площадь (м²):</label>
                        <input
                          type="number"
                          step="0.1"
                          value={areaM2}
                          onChange={(e) => setAreaM2(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Количество комнат:</label>
                        <select
                          value={rooms}
                          onChange={(e) => setRooms(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                        >
                          <option value="studio">Студия</option>
                          <option value="1-room">1-комнатная</option>
                          <option value="2-room">2-комнатная</option>
                          <option value="3-room">3-комнатная</option>
                          <option value="4-room">4-комнатная</option>
                          <option value="euro">Европланировка</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Фактический этаж / Всего:</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={floor}
                            onChange={(e) => setFloor(Number(e.target.value))}
                            className="w-1/2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                            placeholder="Этаж"
                          />
                          <span className="text-slate-400">из</span>
                          <input
                            type="number"
                            value={totalFloors}
                            onChange={(e) => setTotalFloors(Number(e.target.value))}
                            className="w-1/2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                            placeholder="Всего"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Высота потолков (м):</label>
                        <input
                          type="number"
                          step="0.05"
                          value={ceilingHeightM}
                          onChange={(e) => setCeilingHeightM(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Тип отделки:</label>
                        <select
                          value={finishing}
                          onChange={(e) => setFinishing(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                        >
                          <option value="without">Без отделки (черновая)</option>
                          <option value="whitebox">Подчистовая (White box)</option>
                          <option value="clean">Чистовая отделка</option>
                          <option value="turnkey">Под ключ с меблировкой</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Срок сдачи (текст):</label>
                        <input
                          type="text"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          placeholder="4 кв. 2026 г."
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Год сдачи:</label>
                        <input
                          type="number"
                          value={deliveryYear}
                          onChange={(e) => setDeliveryYear(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Тип сделки:</label>
                        <select
                          value={transactionType}
                          onChange={(e) => setTransactionType(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                        >
                          <option value="installment_cession">Переуступка прав по ДДУ (Рассрочка)</option>
                          <option value="mortgage_cession">Переуступка с ипотекой</option>
                          <option value="direct_sale_140fz">Прямая продажа по 140-ФЗ</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Готовность корпуса (%):</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={constructionReadinessPercent}
                          onChange={(e) => setConstructionReadinessPercent(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">Средняя цена района (₽/м²):</label>
                        <input
                          type="number"
                          step="5000"
                          value={districtAvgPricePerM2}
                          onChange={(e) => setDistrictAvgPricePerM2(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 4: The Financial Truth Engine */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                            The Financial Truth Engine (Движок финансовой правды)
                          </h3>
                          <span className="text-[11px] text-slate-500">
                            Формула: DomExit v2.4 • 0% наценки к ДДУ • 100% возврат продавцу
                          </span>
                        </div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">
                          1. Цена в договоре ДДУ (₽):
                        </label>
                        <input
                          type="number"
                          step="50000"
                          value={oldDduPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setOldDduPrice(val);
                            setDebtToDev(Math.max(0, val - cashToSeller));
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Сумма переуступки по договору: {formatRubles(dduPricePerM2)}/м²
                        </span>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">
                          2. Выплачено продавцом (Кэш на руки ₽):
                        </label>
                        <input
                          type="number"
                          step="50000"
                          value={cashToSeller}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setCashToSeller(val);
                            setDebtToDev(Math.max(0, oldDduPrice - val));
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-emerald-500 text-emerald-700 font-mono font-bold focus:bg-white"
                        />
                        <span className="text-[10px] text-emerald-600 mt-1 block">
                          0% комиссии с продавца — получает всю внесенную сумму
                        </span>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">
                          3. Остаток долга застройщику (₽):
                        </label>
                        <input
                          type="number"
                          step="50000"
                          value={debtToDev}
                          onChange={(e) => setDebtToDev(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Переходит покупателю (рассрочка или ипотека)
                        </span>
                      </div>

                      <div>
                        <label className="block text-slate-500 mb-1 font-semibold">
                          4. Официальная цена застройщика сегодня (₽):
                        </label>
                        <input
                          type="number"
                          step="50000"
                          value={todayDevPrice}
                          onChange={(e) => setTodayDevPrice(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Прайс отдела продаж: {formatRubles(devPricePerM2)}/м²
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-emerald-800 uppercase tracking-wider">
                          РАСЧЕТНАЯ ЧИСТАЯ ВЫГОДА ПОКУПАТЕЛЯ:
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-xs shadow-xs">
                          Дисконт -{formatPercent(buyerDiscountPercent)}
                        </span>
                      </div>
                      <div className="text-3xl font-black text-emerald-700 tracking-tight font-mono">
                        +{formatRubles(buyerNetSavings)}
                      </div>
                      {/* Curator Administrative Packaging Fields */}
                      <div className="pt-3 border-t border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-slate-800 mb-1 font-bold">
                              5. Плата застройщика за согласование уступки / перевод долга (₽):
                            </label>
                            <input
                              type="number"
                              step="5000"
                              value={developerConsentFeeRub}
                              onChange={(e) => setDeveloperConsentFeeRub(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-800 mb-1 font-bold text-xs">
                              Политика покрытия сбора застройщика:
                            </label>
                            <select
                              value={developerConsentPolicy}
                              onChange={(e) => setDeveloperConsentPolicy(e.target.value as any)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:border-emerald-500"
                            >
                              <option value="included_in_platform_fee">Включено в сбор платформы 2.5% (0 ₽ для покупателя)</option>
                              <option value="paid_by_buyer">Оплачивается покупателем по тарифу застройщика</option>
                            </select>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              {developerConsentPolicy === 'included_in_platform_fee'
                                ? 'Для покупателя сбор равен 0 ₽ (DomExit компенсирует его из своей комиссии 2.5%).'
                                : 'Покупатель оплачивает тариф застройщика напрямую сверх комиссии платформы.'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-slate-800 mb-1 font-bold">
                              6. Требование к договору уступки:
                            </label>
                            <select
                              value={contractTemplateRequirement}
                              onChange={(e) => setContractTemplateRequirement(e.target.value as any)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:border-emerald-500"
                            >
                              <option value="developer_template">Типовой шаблон застройщика (Обязательное условие ДДУ)</option>
                              <option value="domexit_template">Типовой шаблон юристов DomExit</option>
                            </select>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              Юридический отдел готовит проект договора по регламенту застройщика.
                            </span>
                          </div>

                          <div>
                            <label className="block text-slate-800 mb-1 font-bold text-xs">
                              7. Банк эскроу-счета / расчетов:
                            </label>
                            <select
                              value={escrowBank}
                              onChange={(e) => setEscrowBank(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:border-emerald-500"
                            >
                              <option value="Сбербанк">ПАО Сбербанк</option>
                              <option value="ВТБ">Банк ВТБ (ПАО)</option>
                              <option value="Альфа-Банк">АО «Альфа-Банк»</option>
                              <option value="Банк ДОМ.РФ">АО «Банк ДОМ.РФ»</option>
                              <option value="Газпромбанк">Банк ГПБ (АО)</option>
                              <option value="Промсвязьбанк">ПАО «Промсвязьбанк»</option>
                              <option value="Совкомбанк">ПАО «Совкомбанк»</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Internal Net Margin & Warning */}
                      {(() => {
                        const netPlatformMargin = developerConsentPolicy === 'included_in_platform_fee'
                          ? buyerFee - developerConsentFeeRub
                          : buyerFee;
                        const isHighFeeWarning = developerConsentPolicy === 'included_in_platform_fee' && (developerConsentFeeRub > buyerFee * 0.5 || netPlatformMargin < 0);

                        return (
                          <div className="pt-2 border-t border-emerald-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                              <span>
                                Комиссия покупателя (2.5% по факту сделки):{' '}
                                <strong className="text-slate-900">{formatRubles(buyerFee)}</strong>
                              </span>
                              <span className="text-emerald-700 font-bold">
                                Чистая маржа платформы:{' '}
                                <strong className={netPlatformMargin < 0 ? 'text-rose-600 font-mono font-black' : 'text-emerald-800 font-mono font-black'}>
                                  {formatRubles(netPlatformMargin)}
                                </strong>
                              </span>
                            </div>

                            {isHighFeeWarning && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center space-x-2">
                                <span>⚠️</span>
                                <span>
                                  Внимание: Регламентный сбор застройщика ({formatRubles(developerConsentFeeRub)}) превышает 50% сбора платформы ({formatRubles(buyerFee)}){netPlatformMargin < 0 ? ' и делает маржу сделки отрицательной!' : '!'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Commercial Conditions: Negotiation & Settlement Banks */}
                    <div className="pt-4 border-t border-slate-200/80 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <span>Возможен ли торг по цене уступки?</span>
                            {isNegotiable && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                Активен бейдж «Возможен торг»
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Отображать покупателям индикатор готовности продавца к дисконту на карточке и странице лота
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNegotiable}
                            onChange={(e) => setIsNegotiable(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <label className="block text-xs font-bold text-slate-800">
                          Банки продавца для проведения аккредитивных расчетов:
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Отметьте уполномоченные банки, в которых покупатель сможет открыть аккредитив по данному лоту:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                          {RUSSIAN_BANKS.map((b) => {
                            const isSelected = sellerBanks.includes(b.name);
                            return (
                              <label
                                key={b.id}
                                className={`flex items-center space-x-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSellerBanks((prev) => [...prev, b.name]);
                                    } else {
                                      setSellerBanks((prev) => prev.filter((name) => name !== b.name));
                                    }
                                  }}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                                />
                                <span className="truncate">{b.shortName || b.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Multi-Photo Admin Curation & Media Manager */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    {(() => {
                      const allAvailablePhotos = Array.from(new Set([...approvedPhotos, ...sellerPhotos]));
                      const approvedCount = approvedPhotos.length;
                      const hiddenCount = allAvailablePhotos.length - approvedCount;

                      return (
                        <>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                  Медиа-пакет и галерея объекта ({allAvailablePhotos.length})
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  В каталоге: {approvedCount}
                                </span>
                                {hiddenCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Скрыто: {hiddenCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Управляйте показом: одобряйте проверенные кадры, назначайте обложку и меняйте порядок в каталоге.
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <label className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors flex items-center space-x-1.5 shadow-xs">
                                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Загрузить фото в S3</span>
                                <input
                                  type="file"
                                  className="hidden"
                                  multiple
                                  onChange={handleUploadHdMedia}
                                  accept="image/*"
                                />
                              </label>

                              {allAvailablePhotos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setApprovedPhotos(allAvailablePhotos);
                                    if (!coverImageUrl) setCoverImageUrl(allAvailablePhotos[0]);
                                    setNotificationMsg('Все фотографии одобрены для показа в каталоге!');
                                    setTimeout(() => setNotificationMsg(null), 3000);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                                  title="Одобрить все фото"
                                >
                                  Одобрить все
                                </button>
                              )}
                            </div>
                          </div>

                          {allAvailablePhotos.length === 0 ? (
                            <div className="py-10 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 space-y-2">
                              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                              <span className="text-xs font-bold text-slate-700 block">
                                Фотографии объекта еще не загружены
                              </span>
                              <span className="text-[11px] text-slate-500 block max-w-sm mx-auto">
                                Нажмите «Загрузить фото в S3», чтобы добавить рендеры и фотографии корпуса с вашего устройства.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                              {allAvailablePhotos.map((photo, index) => {
                                const isApproved = approvedPhotos.includes(photo);
                                const isCover = (coverImageUrl === photo) || (!coverImageUrl && approvedPhotos[0] === photo);
                                const approvedIndex = approvedPhotos.indexOf(photo);
                                const isFromSeller = sellerPhotos.includes(photo);

                                return (
                                  <div
                                    key={index}
                                    className={`relative rounded-2xl overflow-hidden border-2 transition-all p-2 bg-white flex flex-col justify-between ${
                                      isCover
                                        ? 'border-amber-500 shadow-md ring-2 ring-amber-300'
                                        : isApproved
                                        ? 'border-emerald-500 shadow-xs'
                                        : 'border-slate-200 opacity-60 hover:opacity-100'
                                    }`}
                                  >
                                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 relative group">
                                      <img
                                        src={photo}
                                        alt={`Фото ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
                                        }}
                                      />
                                      
                                      <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                                        <span className="bg-black/75 text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
                                          {isFromSeller ? 'От продавца' : 'Студия'}
                                        </span>
                                        {isApproved && (
                                          <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                                            Позиция #{approvedIndex + 1}
                                          </span>
                                        )}
                                      </div>

                                      {isCover && (
                                        <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] px-2.5 py-0.5 rounded-full font-black shadow-xs flex items-center space-x-1">
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          <span>Обложка</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Action Toolbar for this Photo */}
                                    <div className="pt-2 space-y-1.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePhotoApproval(photo)}
                                          className={`text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition-colors cursor-pointer ${
                                            isApproved
                                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          }`}
                                        >
                                          {isApproved ? (
                                            <>
                                              <EyeOff className="w-3 h-3 text-slate-500" />
                                              <span>Скрыть</span>
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="w-3 h-3 text-emerald-600" />
                                              <span>Одобрить</span>
                                            </>
                                          )}
                                        </button>

                                        {!isCover && isApproved && (
                                          <button
                                            type="button"
                                            onClick={() => handleSetCoverPhoto(photo)}
                                            className="text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer flex items-center space-x-1"
                                            title="Сделать главной обложкой карточки"
                                          >
                                            <Star className="w-2.5 h-2.5 fill-amber-500" />
                                            <span>Обложка</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleDeletePhoto(photo)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="Удалить фотографию"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Reordering Controls in Approved Queue */}
                                      {isApproved && approvedPhotos.length > 1 && (
                                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                                          <span>Порядок в галерее:</span>
                                          <div className="flex items-center space-x-1">
                                            <button
                                              type="button"
                                              onClick={() => handleMovePhoto(photo, 'left')}
                                              disabled={approvedIndex === 0}
                                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                              title="Переместить влево"
                                            >
                                              <ChevronLeft className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMovePhoto(photo, 'right')}
                                              disabled={approvedIndex === approvedPhotos.length - 1}
                                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                              title="Переместить вправо"
                                            >
                                              <ChevronRight className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Right Column (5 cols): Live Preview, Smart QR Code, Checklist & Action Buttons */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Live Preview Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs sticky top-6">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Живое превью лота (Веб-витрина)
                      </h3>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="h-44 rounded-xl bg-slate-200 overflow-hidden relative">
                        <img
                          src={coverImageUrl || approvedPhotos[0] || lot.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
                          alt="Превью"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-xs">
                          Документы проверены
                        </span>
                        <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-black/70 text-white font-mono text-[10px]">
                          #{lot.lotCode}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-slate-900">{complexName || lot.complexName}</h4>
                        <div className="text-xs text-slate-600 mt-0.5 space-y-0.5">
                          <div>
                            {district && <span>{district}, </span>}
                            {streetAddress && <span>{streetAddress}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {areaM2} м² • {hideFloor ? floorRangeText : `${floor} этаж`} • {deliveryDate}
                          </div>
                          {metroName && (
                            <div className="text-[11px] text-emerald-700 font-semibold">
                              м. {metroName.replace(/^м\.\s*/i, '')} {metroTime ? `• ${metroTime}` : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">ДДУ контракт:</span>
                          <span className="font-bold text-slate-900">
                            {formatRubles(oldDduPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Кэш продавцу (0% ком.):</span>
                          <span className="font-bold text-emerald-700">
                            {formatRubles(cashToSeller)}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-100">
                          <span>Выгода покупателя:</span>
                          <span>+{formatRubles(buyerNetSavings)} (-{formatPercent(buyerDiscountPercent)})</span>
                        </div>
                      </div>
                    </div>

                    {/* QR Passport Preview */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3 text-xs">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <QrCode className="w-10 h-10 text-slate-800" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block">
                          Юридический паспорт лота #{lot.lotCode}
                        </span>
                        <Link
                          to={`/verify/${lot.lotCode}`}
                          target="_blank"
                          className="text-emerald-700 hover:underline font-bold inline-flex items-center space-x-1 text-[11px]"
                        >
                          <span>Проверить сертификат</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Action Buttons in Preview Column */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={handlePublishOpenCatalog}
                        className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <span>Опубликовать в открытом каталоге</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs border transition-colors shadow-xs cursor-pointer flex items-center justify-center space-x-1.5 ${
                          lot.isPublished || lot.status === 'available' || lot.status === 'in_deal'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {lot.isPublished || lot.status === 'available' || lot.status === 'in_deal' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Сохранить и обновить объявление</span>
                          </>
                        ) : (
                          <span>Сохранить черновик</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
