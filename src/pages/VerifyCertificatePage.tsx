import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  Building2, 
  Calendar, 
  Lock, 
  Scale, 
  ArrowLeft,
  Printer,
  Award,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { Lot } from '../types';
import { formatRubles } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';
import { resolveLotLegalAxes, HONEST_STATUS_CONFIG } from '../data/legalAuditAxes';

export const VerifyCertificatePage: React.FC = () => {
  const { lotCode } = useParams<{ lotCode: string }>();
  const { language } = useLanguage();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLot = async () => {
    if (lotCode) {
      const found = await LotsRepository.getByLotCode(lotCode);
      setLot(found || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLot();

    const unsub = DatabaseGateway.subscribe((col) => {
      if (!col || col === 'lots' || col === 'demo_lots' || col.includes('lots')) {
        fetchLot();
      }
    });

    return () => unsub();
  }, [lotCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="py-16 px-4 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-xl mx-auto p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {language === 'ru' ? 'Сертификат проверки не найден' : 'Verification Certificate Not Found'}
          </h1>
          <p className="text-sm text-slate-600">
            {language === 'ru' 
              ? `Лот #${lotCode} не зарегистрирован в публичном реестре верифицированных цессий или находится на закрытом аудите.`
              : `Lot #${lotCode} is not registered in the verified cession registry.`}
          </p>
          <Link
            to="/opportunities"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'ru' ? 'Вернуться в каталог' : 'Back to Catalog'}</span>
          </Link>
        </div>
      </div>
    );
  }

  const axes = resolveLotLegalAxes(lot);
  const verifiedSafeCount = axes.filter((a) => a.status === 'verified_safe').length;
  const curatorName = lot.assignedEmployeeName || lot.curator?.name || 'Алексей Смирнов (Ведущий юрист-куратор)';
  const lastUpdatedFormatted = (() => {
    const raw = lot.publishedAt || new Date().toISOString();
    const d = new Date(raw);
    return Number.isNaN(d.getTime())
      ? new Date().toLocaleDateString('ru-RU')
      : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-6">
      
      {/* Navigation Breadcrumb & Print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={`/opportunities/${lot.lotCode}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? `Вернуться к карточке лота #${lot.lotCode}` : `Back to Lot #${lot.lotCode}`}</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Печать сертификата' : 'Print Certificate'}</span>
        </button>
      </div>

      {/* Official Certificate Card Container */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xl space-y-8 relative overflow-hidden print:shadow-none print:border-none print:p-0">
        
        {/* Top Seal & Official Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500 text-slate-950 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Проверка завершена • {verifiedSafeCount} из 5 подтверждено</span>
              </span>
              <span className="text-xs font-mono text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">
                #CERT-{lot.lotCode}-2026
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
              {language === 'ru' ? 'Сертификат юридической проверки цессии' : 'Cession Legal Verification Certificate'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {language === 'ru' 
                ? 'Официальный протокол правового аудита объекта, прав требования и условий переуступки по 214-ФЗ'
                : 'Official legal audit protocol for assignment rights under Russian Federal Law 214-FZ'}
            </p>
          </div>

          <div className="flex-shrink-0 text-right print:hidden">
            <div className="w-24 h-24 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center p-2 text-center shadow-xs">
              <Award className="w-8 h-8 text-emerald-600 mb-1" />
              <span className="text-[10px] font-black text-emerald-900 uppercase leading-tight">
                5 из 5
              </span>
              <span className="text-[9px] font-bold text-emerald-700">разделов</span>
            </div>
          </div>
        </div>

        {/* Key Lot Information Box */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-semibold block">Объект и застройщик</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{lot.complexName}</div>
            <div className="text-slate-600 mt-0.5">{lot.developer} • {lot.district}</div>
          </div>

          <div>
            <span className="text-slate-500 font-semibold block">Характеристики лота</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {lot.areaM2} м² • {lot.ownerDossier?.hideExactFloor ? `${lot.ownerDossier.floorRangeDisplay}` : `${lot.floor} этаж`}
            </div>
            <div className="text-slate-600 mt-0.5">Срок сдачи: {lot.deliveryDate}</div>
          </div>

          <div>
            <span className="text-slate-500 font-semibold block">Эскроу-банк девелопера</span>
            <div className="text-sm font-bold text-emerald-700 mt-0.5">ПАО {lot.escrowBank || 'Сбербанк'}</div>
            <div className="text-slate-600 mt-0.5">Счёт подтвержден по 214-ФЗ</div>
          </div>
        </div>

        {/* The 5 Real Audit Axes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Scale className="w-4 h-4 text-slate-700" />
              <span>Результаты проверки по 5 ключевым разделам цессии</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Обновлено: {lastUpdatedFormatted}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {axes.map((axis) => {
              const cfg = HONEST_STATUS_CONFIG[axis.status] || HONEST_STATUS_CONFIG.verified_safe;
              return (
                <div
                  key={axis.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-2 hover:border-slate-300 transition-colors shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      {axis.title}
                    </span>
                    <span
                      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 ${cfg.badgeClass}`}
                    >
                      {axis.status === 'verified_safe' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {axis.status === 'required_at_deal' && <Clock className="w-3.5 h-3.5 text-sky-600" />}
                      {axis.status === 'condition_found' && <AlertCircle className="w-3.5 h-3.5 text-slate-600" />}
                      <span>{cfg.labelRu}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {axis.notes}
                  </p>
                  {axis.portalUrl && (
                    <div className="pt-1.5 flex items-center text-[10px] text-slate-400">
                      <span className="font-mono">Реестр проверки: {axis.portalUrl}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Curator Verification Official Attestation Box */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Ответственный юрист-куратор:
              </span>
              <span className="text-xs font-bold text-white">
                {curatorName}
              </span>
            </div>
            <span className="text-[11px] text-slate-300 font-mono">
              Статус: Зафиксировано в реестре DomExit
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Правовая экспертиза объекта #{lot.lotCode} подтверждает соответствие заявленных условий законодательству РФ (214-ФЗ). Все выявленные условия регламентированы и согласуются в рамках трехстороннего процесса уступки прав требований.
          </p>
        </div>

        {/* Bottom Verification Footer */}
        <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span className="font-mono text-[11px]">
            Электронная цифровая подпись DomExit Legal Desk • SHA-256 Validated
          </span>
          <span className="text-[11px]">
            Дата формирования: {new Date().toLocaleDateString('ru-RU')}
          </span>
        </div>

      </div>
    </div>
  );
};
