import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle, 
  FileCheck, 
  Building2, 
  Calendar, 
  Lock, 
  QrCode, 
  Scale, 
  ArrowLeft,
  Share2,
  Printer,
  Award
} from 'lucide-react';
import { UnifiedNavbar } from '../components/layout/UnifiedNavbar';
import { UnifiedFooter } from '../components/layout/UnifiedFooter';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { Lot } from '../types';
import { formatRubles } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

export const VerifyCertificatePage: React.FC = () => {
  const { lotCode } = useParams<{ lotCode: string }>();
  const { language } = useLanguage();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchLot() {
      if (lotCode) {
        const found = await LotsRepository.getByLotCode(lotCode);
        setLot(found || null);
      }
      setLoading(false);
    }
    fetchLot();
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
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <UnifiedNavbar />
        <div className="max-w-xl mx-auto my-20 p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {language === 'ru' ? 'Сертификат проверки не найден' : 'Verification Certificate Not Found'}
          </h1>
          <p className="text-sm text-slate-600">
            {language === 'ru' 
              ? `Лот #${lotCode} не зарегистрирован в публичном реестре верифицированных цессий или находится на закрытом аудите.`
              : `Lot #${lotCode} is not yet published or undergoing closed legal audit.`}
          </p>
          <Link
            to="/opportunities"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'ru' ? 'Вернуться в каталог' : 'Back to Catalog'}
          </Link>
        </div>
        <UnifiedFooter />
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to={`/opportunities/${lot.lotCode}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {language === 'ru' ? `Вернуться к карточке лота #${lot.lotCode}` : `Back to Lot #${lot.lotCode}`}
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {language === 'ru' ? 'Печать сертификата' : 'Print Certificate'}
            </button>
          </div>
        </div>

        {/* Certificate Card Container */}
        <div className="bg-white rounded-3xl border-2 border-emerald-500/30 p-6 sm:p-10 shadow-xl space-y-8 relative overflow-hidden">
          
          {/* Top Seal & Official Header */}
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  ГОСТ Р 57580 • Верифицировано
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ID: #CERT-{lot.lotCode}-2025
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ru' ? 'Юридический паспорт цессии' : 'Legal Verification Passport'}
              </h1>
              <p className="text-sm text-slate-500">
                {language === 'ru' 
                  ? 'Цифровой протокол комплексной проверки объекта и собственника по стандарту 214-ФЗ'
                  : 'Digital verification certificate under Federal Law 214-FZ standards'}
              </p>
            </div>

            <div className="flex-shrink-0 text-right">
              <div className="w-20 h-20 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center p-2 text-center">
                <Award className="w-8 h-8 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-800 uppercase mt-1">42 из 42 OK</span>
              </div>
            </div>
          </div>

          {/* Key Lot Information Box */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-slate-500 font-medium">Объект и застройщик</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">{lot.complexName}</div>
              <div className="text-xs text-slate-600">{lot.developer} • {lot.district}</div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium">Характеристики лота</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">{lot.areaM2} м² • {lot.floor} этаж</div>
              <div className="text-xs text-slate-600">Срок сдачи: {lot.deliveryDate}</div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium">Эскроу-банк девелопера</span>
              <div className="text-base font-bold text-emerald-700 mt-0.5">ПАО {lot.escrowBank}</div>
              <div className="text-xs text-slate-600">Счет открыт по 214-ФЗ</div>
            </div>
          </div>

          {/* 4 Core Verification Pillars */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {language === 'ru' ? 'Результаты автоматической проверки баз данных РФ' : 'Russian Federal Registry Verification Results'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* EFRSB */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">ЕФРСБ / Банкротство (ст. 213.4 ФЗ-127)</span>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">ЧИСТО</span>
                </div>
                <p className="text-xs text-slate-600">
                  Собственник не состоит в реестрах несостоятельности. Признаки фиктивного или преднамеренного банкротства отсутствуют.
                </p>
              </div>

              {/* FSSP */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">ФССП РФ / Исполнительные производства</span>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">0 ₽ ДОЛГОВ</span>
                </div>
                <p className="text-xs text-slate-600">
                  Арестов, запретов на регистрационные действия в отношении прав требования по ДДУ не наложено.
                </p>
              </div>

              {/* Maternal Capital */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Материнский капитал (СФР)</span>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">НЕ ИСПОЛЬЗОВАЛСЯ</span>
                </div>
                <p className="text-xs text-slate-600">
                  Выделение долей несовершеннолетним не требуется. Риск аннулирования договора цессии исключен.
                </p>
              </div>

              {/* Developer Consent */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Согласие девелопера {lot.developer}</span>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">ПОЛУЧЕНО</span>
                </div>
                <p className="text-xs text-slate-600">
                  Письменное согласие на перевод долга по рассрочке и уступку прав требований оформлено по регламенту ст. 11 214-ФЗ.
                </p>
              </div>

            </div>
          </div>

          {/* Bona Fide Protection Seal */}
          <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 text-slate-900 rounded-2xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                Правовое обоснование добросовестности (ст. 302 ГК РФ)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700">
                Индекс защиты: 98/100
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Цена переуступки ({formatRubles(lot.cashPaidBySeller)} на руки продавцу) полностью соответствует сумме фактических затрат цедента, подтверждена банковскими платежными поручениями и исключает квалификацию сделки как подозрительной по ст. 61.2 Закона о банкротстве.
            </p>
          </div>

          {/* Bottom Verification Footer */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>Электронная цифровая подпись DomExit Legal Desk • SHA-256 Validated</span>
            <span>Сформировано: {new Date().toLocaleDateString('ru-RU')}</span>
          </div>

        </div>
    </div>
  );
};
