import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles, formatPercent } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { StorageService } from '../dal/StorageService';
import { Lot } from '../types';
import {
  Lock,
  QrCode,
  Send,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Upload,
} from 'lucide-react';

export const AdminPackagingPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [accessibleLots, setAccessibleLots] = useState<Lot[]>([]);
  const [hideFloor, setHideFloor] = useState<boolean>(true);
  const [previewTab, setPreviewTab] = useState<'web' | 'telegram'>('web');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Financial Truth Engine numeric inputs
  const [oldDduPrice, setOldDduPrice] = useState<number>(10972000);
  const [cashToSeller, setCashToSeller] = useState<number>(2485230);
  const [debtToDev, setDebtToDev] = useState<number>(8486770);
  const [todayDevPrice, setTodayDevPrice] = useState<number>(14200000);

  // Media materials state
  const [sellerPhotos, setSellerPhotos] = useState<string[]>([]);
  const [approvedPhotos, setApprovedPhotos] = useState<string[]>([]);
  const [isAccessDenied, setIsAccessDenied] = useState<boolean>(false);

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const operatorName =
    user?.name || (isEmployee ? 'Алексей Смирнов (Куратор)' : 'Виктор Сергеевич (CEO)');
  const operatorRole = isEmployee ? 'curator' : 'owner';

  const hydrateLotState = (data: Lot) => {
    setLot(data);
    setHideFloor(data.ownerDossier?.hideExactFloor ?? true);
    setOldDduPrice(data.dduContractPrice);
    setCashToSeller(data.cashPaidBySeller);
    setDebtToDev(data.remainingInstallmentDebt);
    setTodayDevPrice(data.todayDeveloperPrice);

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
  };

  useEffect(() => {
    async function load() {
      const pool = isEmployee
        ? await LotsRepository.getByAssignedEmployee(currentEmployeeId)
        : await LotsRepository.getAll({ includePendingApproval: true });

      setAccessibleLots(pool);
      setIsAccessDenied(false);

      const code = (lotId || 'U-10566').toUpperCase();

      if (isEmployee && lotId) {
        const globalLot = await LotsRepository.getByCode(code);
        if (globalLot && globalLot.assignedEmployeeId !== currentEmployeeId) {
          setIsAccessDenied(true);
          setLot(null);
          return;
        }
      }

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
  const maskedFloorText = lot?.ownerDossier?.floorRangeDisplay || '7–10 этаж';

  const handleTogglePhotoApproval = (photoUrl: string) => {
    setApprovedPhotos((prev) =>
      prev.includes(photoUrl) ? prev.filter((p) => p !== photoUrl) : [...prev, photoUrl]
    );
  };

  const handleUploadHdMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0] && lot) {
      const file = files[0];

      // Persist render inside Yandex Object Storage S3 Emulator
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
        setNotificationMsg(
          `HD-рендер «${file.name}» сохранен в облачном бакете S3 и отмечен для публикации!`
        );
        setTimeout(() => setNotificationMsg(null), 4000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveMediaPackage = async () => {
    if (!lot) return;
    await LotsRepository.updatePackagingPhotos(
      lot.lotCode,
      operatorName,
      approvedPhotos,
      sellerPhotos
    );
    setNotificationMsg(
      `Медиа-пакет сохранен: ${approvedPhotos.length} фото утверждено для открытого каталога.`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleSaveDraft = async () => {
    if (!lot) return;
    const updatedLot: Lot = {
      ...lot,
      dduContractPrice: oldDduPrice,
      cashPaidBySeller: cashToSeller,
      remainingInstallmentDebt: debtToDev,
      todayDeveloperPrice: todayDevPrice,
      serviceCommissionRub: buyerFee,
      ownerDossier: {
        ...lot.ownerDossier,
        hideExactFloor: hideFloor,
      },
    };
    await LotsRepository.update(updatedLot);
    setLot(updatedLot);
    setNotificationMsg('Черновик упаковки и параметры Financial Truth сохранены в базе DAL.');
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handlePublishLot = async () => {
    if (!lot) return;
    const updatedLot: Lot = {
      ...lot,
      dduContractPrice: oldDduPrice,
      cashPaidBySeller: cashToSeller,
      remainingInstallmentDebt: debtToDev,
      todayDeveloperPrice: todayDevPrice,
      serviceCommissionRub: buyerFee,
      status: 'available',
      approvalStatus: 'approved',
      currentStage: 3,
      approvedGalleryImages: approvedPhotos,
      galleryImages: approvedPhotos.length > 0 ? approvedPhotos : lot.galleryImages,
      imageUrl: approvedPhotos[0] || lot.imageUrl,
      ownerDossier: {
        ...lot.ownerDossier,
        hideExactFloor: hideFloor,
      },
    };
    await LotsRepository.update(updatedLot);
    setLot(updatedLot);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName,
      operatorRole,
      actionType: 'packaging_published',
      title: `Лот #${lot.lotCode} упакован по 152-ФЗ и опубликован в каталоге`,
      description: `Оператор: ${operatorName}. Одобрено ${approvedPhotos.length} фото. Кэш продавцу: ${formatRubles(cashToSeller)} (0% комиссии с продавца).`,
    });

    setNotificationMsg(`Лот #${lot.lotCode} опубликован в открытом каталоге DomExit!`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleSendVipTg = async () => {
    if (!lot) return;
    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName,
      operatorRole,
      actionType: 'vip_telegram_broadcast',
      title: `Эксклюзивный оффер по лоту #${lot.lotCode} отправлен в закрытый VIP TG-клуб`,
      description: `Оператор ${operatorName} запустил приоритетный ранний доступ (48 часов) для аккредитованных VIP-инвесторов.`,
    });

    setNotificationMsg(
      `Эксклюзивный оффер по лоту #${lot.lotCode} отправлен в закрытый VIP-клуб (ранний доступ 48ч)!`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={`Упаковка и публикация лота #${lot?.lotCode || '—'}`}
          subtitle="Студия анонимизации данных по 152-ФЗ и расчетный движок Financial Truth Engine"
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
          {isAccessDenied ? (
            <div className="bg-white border border-rose-200 rounded-3xl p-10 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Доступ ограничен
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Данный объект не закреплен за вашим профилем куратора. Для получения доступа обратитесь к Владельцу платформы.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin/pipeline"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
                >
                  <span>Вернуться в мою воронку</span>
                </Link>
              </div>
            </div>
          ) : !lot ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                Нет доступных объектов в вашем контуре ответственности
              </p>
              <p className="text-xs text-slate-500">
                Ожидайте закрепления лотов Владельцем платформы.
              </p>
            </div>
          ) : (
            <>
              {/* Top Bar with Lot Switcher, Readiness and Publish CTAs */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-4">
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
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {accessibleLots.map((l) => (
                      <option key={l.id} value={l.lotCode}>
                        #{l.lotCode} — {l.complexName}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-600">Готовность:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-xs">
                      {approvedPhotos.length > 0 ? '100% (Медиа готовы)' : '85%'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs transition-colors cursor-pointer"
                  >
                    Сохранить черновик
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishLot}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    Опубликовать на сайте
                  </button>
                  <button
                    type="button"
                    onClick={handleSendVipTg}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Отправить в VIP TG-клуб (за 48ч)</span>
                  </button>
                </div>
              </div>

              {/* 2-Column Packaging Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column (7 cols): 3 Editing Cards */}
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
                          value={lot.ownerDossier.fullNameMasked}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Контактный телефон:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier.phoneMasked}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Номер договора ДДУ:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier.dduNumber}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Точный номер квартиры:</label>
                        <input
                          type="text"
                          disabled
                          value={lot.ownerDossier.apartmentNumber}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                        />
                      </div>
                    </div>

                    {/* Floor Hiding Toggle */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={hideFloor}
                          onChange={(e) => setHideFloor(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">
                            Скрыть точный этаж от застройщика (отображать диапазон «{maskedFloorText}»)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Исключает риск санкций со стороны службы мониторинга девелопера {lot.developer}.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Card 2: Public Characteristics & Media Materials */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                      Публичные характеристики и медиаматериалы
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Жилой комплекс:</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">
                          {lot.complexName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Площадь:</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">
                          {lot.areaM2} м²
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Публичный этаж:</span>
                        <span className="font-bold text-emerald-700 mt-0.5 block">
                          {hideFloor ? maskedFloorText : `${lot.floor} из ${lot.totalFloors}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Срок сдачи:</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">
                          {lot.deliveryDate}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          План квартиры с авто-размытием персональных печатей (152-ФЗ)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          AI MASKED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Штампы БТИ и личные подписи дольщика на планировке обезличены для публикации в открытом реестре.
                      </p>
                    </div>

                    {/* Seller Photos & Curator Approval Studio */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Фотографии и отбор для каталога ({sellerPhotos.length})
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Отметьте фото для открытого каталога или загрузите HD-рендеры (Yandex S3)
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 border border-slate-200">
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>+ HD-рендер</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={handleUploadHdMedia}
                              accept="image/*"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleSaveMediaPackage}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            Сохранить медиа ({approvedPhotos.length})
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                        {sellerPhotos.map((photo, index) => {
                          const isApproved = approvedPhotos.includes(photo);
                          return (
                            <div
                              key={index}
                              className={`relative rounded-2xl overflow-hidden border-2 transition-all p-1 bg-white ${
                                isApproved
                                  ? 'border-emerald-500 shadow-xs'
                                  : 'border-slate-200 opacity-60'
                              }`}
                            >
                              <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 relative">
                                <img
                                  src={photo}
                                  alt={`Фото ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
                                  {index === 0 ? 'Планировка' : `Фото ${index + 1}`}
                                </span>
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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: The Financial Truth Engine */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          The Financial Truth Engine (Движок финансовой правды)
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          Формула: DomExit v2.4 • 0% наценки к ДДУ
                        </span>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1">
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
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
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
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          3. Остаток долга застройщику (₽):
                        </label>
                        <input
                          type="number"
                          step="50000"
                          value={debtToDev}
                          onChange={(e) => setDebtToDev(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          4. Официальная цена застройщика сегодня (₽):
                        </label>
                        <input
                          type="number"
                          step="50000"
                          value={todayDevPrice}
                          onChange={(e) => setTodayDevPrice(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white"
                        />
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
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200 text-xs text-slate-600">
                        <span>
                          Комиссия покупателя (2.5% по факту):{' '}
                          <strong className="text-slate-900">{formatRubles(buyerFee)}</strong>
                        </span>
                        <span className="text-emerald-700 font-bold">
                          Комиссия с продавца: 0 ₽ (100% возврат)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Live Preview, Smart QR Code, Checklist */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Живое превью лота ({previewTab === 'web' ? 'Каталог' : 'Telegram VIP'})
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
                      <div className="h-36 rounded-xl bg-slate-200 overflow-hidden relative">
                        <img
                          src={approvedPhotos[0] || lot.imageUrl}
                          alt="Превью"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-xs">
                          Документы проверены
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{lot.complexName}</h4>
                        <span className="text-[11px] text-slate-500">
                          {lot.areaM2} м² • {hideFloor ? maskedFloorText : `${lot.floor} этаж`} •{' '}
                          {lot.deliveryDate}
                        </span>
                      </div>

                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Кэш продавцу:</span>
                          <span className="font-bold text-slate-900">
                            {formatRubles(cashToSeller)}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Выгода покупателя:</span>
                          <span>+{formatRubles(buyerNetSavings)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Protected Smart QR Code Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Защищенный QR-код лота — Смарт-редирект
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 font-mono text-[10px] font-bold">
                        ГОСТ ЭЦП
                      </span>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="w-24 h-24 bg-slate-50 border border-slate-200 p-2 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                        <QrCode className="w-20 h-20 text-slate-800" />
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <span className="font-bold text-slate-900 block">
                          Верификационный паспорт
                        </span>
                        <p className="text-[11px] text-slate-500">
                          При сканировании открывает официальный цифровой сертификат проверки по 214-ФЗ.
                        </p>
                        <Link
                          to={`/verify/${lot.lotCode}`}
                          className="text-emerald-700 hover:text-emerald-800 hover:underline font-bold text-xs inline-flex items-center space-x-1"
                        >
                          <span>Открыть сертификат /verify/{lot.lotCode}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Launch Checklist Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
                      Чек-лист готовности к публикации
                    </h3>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center space-x-2 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Справка о взаиморасчетах сверена с {lot.developer}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Персональные данные обезличены по 152-ФЗ</span>
                      </div>
                      <div className="flex items-center space-x-2 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Финансовый баланс проверен (0% оверпрайса)</span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={handleSendVipTg}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Опубликовать в закрытый VIP TG-клуб (ранний доступ 48ч)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePublishLot}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 transition-colors shadow-xs cursor-pointer"
                      >
                        Опубликовать в открытом каталоге DomExit
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
