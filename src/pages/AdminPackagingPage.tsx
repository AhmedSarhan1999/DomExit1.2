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
} from 'lucide-react';

export const AdminPackagingPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleLots, setAccessibleLots] = useState<Lot[]>([]);
  const [previewTab, setPreviewTab] = useState<'web' | 'telegram'>('web');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // 152-FZ Privacy & Floor
  const [hideFloor, setHideFloor] = useState<boolean>(true);
  const [floorRangeText, setFloorRangeText] = useState<string>('7–10 этаж');

  // Spatial & Transport
  const [city, setCity] = useState<RussianCityCode>('spb');
  const [district, setDistrict] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [metroName, setMetroName] = useState<string>('');
  const [metroTime, setMetroTime] = useState<string>('12 мин.');
  const [metroMode, setMetroMode] = useState<'walk' | 'drive'>('walk');

  // Technical Specs
  const [complexName, setComplexName] = useState<string>('');
  const [developer, setDeveloper] = useState<string>('');
  const [areaM2, setAreaM2] = useState<number>(42);
  const [rooms, setRooms] = useState<string>('1-room');
  const [floor, setFloor] = useState<number>(8);
  const [totalFloors, setTotalFloors] = useState<number>(24);
  const [ceilingHeightM, setCeilingHeightM] = useState<number>(2.78);
  const [finishing, setFinishing] = useState<string>('clean');
  const [deliveryDate, setDeliveryDate] = useState<string>('4 кв. 2026 г.');
  const [deliveryYear, setDeliveryYear] = useState<number>(2026);
  const [transactionType, setTransactionType] = useState<string>('installment_cession');
  const [constructionReadinessPercent, setConstructionReadinessPercent] = useState<number>(85);
  const [districtAvgPricePerM2, setDistrictAvgPricePerM2] = useState<number>(285000);

  // Financial Truth Engine numeric inputs
  const [oldDduPrice, setOldDduPrice] = useState<number>(10972000);
  const [cashToSeller, setCashToSeller] = useState<number>(2485230);
  const [debtToDev, setDebtToDev] = useState<number>(8486770);
  const [todayDevPrice, setTodayDevPrice] = useState<number>(14200000);
  const [developerConsentFeeRub, setDeveloperConsentFeeRub] = useState<number>(50000);
  const [contractTemplateRequirement, setContractTemplateRequirement] = useState<'developer_template' | 'domexit_template'>('developer_template');

  // Media materials state
  const [sellerPhotos, setSellerPhotos] = useState<string[]>([]);
  const [approvedPhotos, setApprovedPhotos] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const operatorName =
    user?.name || (isEmployee ? 'Алексей Смирнов (Куратор)' : 'Ahmed Abdallah (Владелец / CEO)');

  const hydrateLotState = (data: Lot) => {
    setLot(data);

    // 152-FZ
    setHideFloor(data.ownerDossier?.hideExactFloor ?? true);
    setFloorRangeText(data.ownerDossier?.floorRangeDisplay || '7–10 этаж');

    // Spatial
    setCity(data.city || 'spb');
    setDistrict(data.district || '');
    setStreetAddress(data.streetAddress || '');
    if (data.metroStations && data.metroStations.length > 0) {
      setMetroName(data.metroStations[0].name);
      setMetroTime(data.metroStations[0].travelTimeText || '12 мин. пешком');
      setMetroMode(data.metroStations[0].mode || 'walk');
    } else {
      setMetroName('Комендантский пр.');
      setMetroTime('12 мин. пешком');
      setMetroMode('walk');
    }

    // Technical
    setComplexName(data.complexName || '');
    setDeveloper(data.developer || '');
    setAreaM2(data.areaM2 || 42);
    setRooms(data.rooms || '1-room');
    setFloor(data.floor || 8);
    setTotalFloors(data.totalFloors || 24);
    setCeilingHeightM(data.ceilingHeightM || 2.78);
    setFinishing(data.finishing || 'clean');
    setDeliveryDate(data.deliveryDate || '4 кв. 2026 г.');
    setDeliveryYear(data.deliveryYear || 2026);
    setTransactionType(data.transactionType || 'installment_cession');
    setConstructionReadinessPercent(data.constructionReadinessPercent || 85);
    setDistrictAvgPricePerM2(data.districtAvgPricePerM2 || 285000);

    // Financial
    setOldDduPrice(data.dduContractPrice || 10000000);
    setCashToSeller(data.cashPaidBySeller || 2000000);
    setDebtToDev(data.remainingInstallmentDebt || 8000000);
    setTodayDevPrice(data.todayDeveloperPrice || 13500000);
    setDeveloperConsentFeeRub(data.developerConsentFeeRub || 50000);
    setContractTemplateRequirement(data.contractTemplateRequirement || 'developer_template');

    // Media
    const sPhotos =
      data.sellerUploadedPhotos && data.sellerUploadedPhotos.length > 0
        ? data.sellerUploadedPhotos
        : data.galleryImages || [
            'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
          ];
    setSellerPhotos(sPhotos);

    const aPhotos =
      data.approvedGalleryImages && data.approvedGalleryImages.length > 0
        ? data.approvedGalleryImages
        : sPhotos.slice(0, 2);
    setApprovedPhotos(aPhotos);
    setCoverImageUrl(data.imageUrl || aPhotos[0] || sPhotos[0] || '');
  };

  useEffect(() => {
    async function load() {
      const pool = isEmployee
        ? await LotsRepository.getByAssignedEmployee(currentEmployeeId)
        : await LotsRepository.getAll({ includePendingApproval: true });

      setAccessibleLots(pool);

      const code = (lotId || 'U-10566').toUpperCase();
      const matched =
        pool.find((l) => l.lotCode.toUpperCase() === code || l.id.toUpperCase() === code) ||
        pool[0];

      if (matched) {
        hydrateLotState(matched);
      } else {
        setLot(null);
      }
    }
    load();
  }, [lotId, isEmployee, currentEmployeeId]);

  const buyerNetSavings = Math.max(0, todayDevPrice - oldDduPrice);
  const buyerDiscountPercent =
    todayDevPrice > 0 ? (buyerNetSavings / todayDevPrice) * 100 : 0;
  const buyerFee = Math.round(oldDduPrice * 0.025);
  const dduPricePerM2 = Math.round(oldDduPrice / Math.max(areaM2, 1));
  const devPricePerM2 = Math.round(todayDevPrice / Math.max(areaM2, 1));

  const handleTogglePhotoApproval = (photoUrl: string) => {
    setApprovedPhotos((prev) =>
      prev.includes(photoUrl) ? prev.filter((p) => p !== photoUrl) : [...prev, photoUrl]
    );
  };

  const handleSetCoverPhoto = (photoUrl: string) => {
    setCoverImageUrl(photoUrl);
    if (!approvedPhotos.includes(photoUrl)) {
      setApprovedPhotos((prev) => [...prev, photoUrl]);
    }
    setNotificationMsg('Главная фотография обложки обновлена!');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleUploadHdMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0] && lot) {
      const file = files[0];

      const savedDoc = await StorageService.uploadDocument({
        file,
        category: 'additional',
        categoryLabelRu: `HD-рендер упаковки: ${file.name}`,
        entityType: 'lot',
        entityId: lot.lotCode,
        uploadedByUid: user?.id || 'curator-packaging',
        clientCode: user?.clientCode || 'DEX-STAFF',
      });

      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto =
          typeof reader.result === 'string'
            ? reader.result
            : savedDoc.previewDataUrl || lot.imageUrl;
        setSellerPhotos((prev) => [...prev, newPhoto]);
        setApprovedPhotos((prev) => [...prev, newPhoto]);
        if (!coverImageUrl) setCoverImageUrl(newPhoto);
        setNotificationMsg(
          `HD-рендер «${file.name}» загружен и включен в фото-пакет!`
        );
        setTimeout(() => setNotificationMsg(null), 4000);
      };
      reader.readAsDataURL(file);
    }
  };

  const buildUpdatedLotData = (): Lot => {
    if (!lot) throw new Error('No active lot');

    const metroList: MetroStationInfo[] = metroName
      ? [
          {
            name: metroName,
            travelTimeText: metroTime.includes('мин') ? metroTime : `${metroTime} мин. ${metroMode === 'walk' ? 'пешком' : 'транспортом'}`,
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
      contractTemplateRequirement,
      imageUrl: effectiveCover,
      approvedGalleryImages: approvedPhotos,
      galleryImages: approvedPhotos.length > 0 ? approvedPhotos : [effectiveCover],
      sellerUploadedPhotos: sellerPhotos,
      ownerDossier: {
        ...lot.ownerDossier,
        hideExactFloor: hideFloor,
        floorRangeDisplay: floorRangeText,
      },
    };
  };

  const handleSaveDraft = async () => {
    if (!lot) return;
    const updatedLot = buildUpdatedLotData();
    await LotsRepository.update(updatedLot);
    setLot(updatedLot);
    setNotificationMsg('Черновик упаковки успешно сохранен (без изменения статуса публикации).');
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

  const handlePublishVipCatalog = async () => {
    if (!lot) return;
    const updatedLot = buildUpdatedLotData();
    const result = await LotsRepository.publishToVipCatalog(
      lot.lotCode,
      operatorName,
      updatedLot
    );
    if (result) {
      setLot(result);
      setNotificationMsg(
        `Лот #${lot.lotCode} опубликован в ЗАКРЫТОМ VIP-каталоге (ранний доступ 48 часов)!`
      );
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Студия упаковки и публикации лота #${lot?.lotCode || '—'}`}
          subtitle="Полное редактирование карточки, изоляция персональных данных (152-ФЗ) и Financial Truth Engine"
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
                    {lot.isPublished && !lot.isVipExclusive ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-emerald-600" />
                        <span>Опубликован (Открытый)</span>
                      </span>
                    ) : lot.isVipExclusive ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>В закрытом VIP (48ч)</span>
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
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
                  >
                    Сохранить черновик
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishOpenCatalog}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Опубликовать в открытом каталоге</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishVipCatalog}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Отправить в закрытый VIP-каталог (на 48 часов)</span>
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
                          Закрытое досье собственника (152-ФЗ Защищено)
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
                        <input
                          type="text"
                          value={streetAddress}
                          onChange={(e) => setStreetAddress(e.target.value)}
                          placeholder="Комендантский пр., д. 58"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
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
                            placeholder="12 мин."
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
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Покрывается покупателем в рамках агентского сопровождения 2.5% (расчет через аккредитив).
                          </span>
                        </div>

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
                            <option value="domexit_template">Шаблон юристов DomExit (Стандарт 214-ФЗ / 140-ФЗ)</option>
                          </select>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Юридический отдел готовит проект договора по регламенту застройщика.
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200 text-xs text-slate-600">
                        <span>
                          Комиссия покупателя (2.5% по факту сделки):{' '}
                          <strong className="text-slate-900">{formatRubles(buyerFee)}</strong>
                        </span>
                        <span className="text-emerald-700 font-bold">
                          Комиссия с продавца: 0 ₽
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Media Gallery & Cover Image Selection */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Галерея, планировка и главная обложка ({sellerPhotos.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Кликните звездочку, чтобы сделать фото главной обложкой. Отметьте фото для каталога.
                        </p>
                      </div>

                      <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 border border-slate-200">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>+ Загрузить HD-файл</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleUploadHdMedia}
                          accept="image/*"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sellerPhotos.map((photo, index) => {
                        const isApproved = approvedPhotos.includes(photo);
                        const isCover = coverImageUrl === photo;
                        return (
                          <div
                            key={index}
                            className={`relative rounded-2xl overflow-hidden border-2 transition-all p-1 bg-white ${
                              isCover
                                ? 'border-amber-500 shadow-md ring-2 ring-amber-300'
                                : isApproved
                                ? 'border-emerald-500 shadow-xs'
                                : 'border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 relative group">
                              <img
                                src={photo}
                                alt={`Фото ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
                                {index === 0 ? 'Планировка' : `Фото ${index + 1}`}
                              </span>
                              {isCover && (
                                <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-xs flex items-center space-x-0.5">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  <span>Обложка</span>
                                </span>
                              )}
                            </div>

                            <div className="pt-2 px-1 flex items-center justify-between">
                              <label className="flex items-center space-x-1.5 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isApproved}
                                  onChange={() => handleTogglePhotoApproval(photo)}
                                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                                />
                                <span
                                  className={`text-[11px] font-bold ${
                                    isApproved ? 'text-emerald-700' : 'text-slate-500'
                                  }`}
                                >
                                  {isApproved ? 'В каталог' : 'Исключено'}
                                </span>
                              </label>

                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCoverPhoto(photo)}
                                  className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                                  title="Сделать главной обложкой карточки"
                                >
                                  Сделать главной
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Live Preview, Smart QR Code, Checklist & Action Buttons */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Live Preview Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs sticky top-6">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Живое превью лота ({previewTab === 'web' ? 'Веб-витрина' : 'Telegram VIP'})
                      </h3>
                      <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setPreviewTab('web')}
                          className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                            previewTab === 'web'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-500'
                          }`}
                        >
                          Веб-витрина
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewTab('telegram')}
                          className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                            previewTab === 'telegram'
                              ? 'bg-white text-sky-600 shadow-xs'
                              : 'text-slate-500'
                          }`}
                        >
                          Telegram VIP
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="h-44 rounded-xl bg-slate-200 overflow-hidden relative">
                        <img
                          src={coverImageUrl || approvedPhotos[0] || lot.imageUrl}
                          alt="Превью"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-xs">
                          152-ФЗ Документы проверены
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
                              м. {metroName} • {metroTime}
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
                          ГОСТ-паспорт лота #{lot.lotCode}
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
                        onClick={handlePublishVipCatalog}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Отправить в закрытый VIP-каталог (на 48 часов)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 transition-colors shadow-xs cursor-pointer"
                      >
                        Сохранить черновик
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
