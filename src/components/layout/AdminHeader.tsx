import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, Download, Plus, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DealsRepository } from '../../dal/repositories/DealsRepository';
import { FileManager } from '../../utils/fileManager';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onNewRequest?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';

  const handleExportRegistry = async () => {
    const deals = isEmployee
      ? await DealsRepository.getByEmployee(currentEmployeeId)
      : await DealsRepository.getAll();

    const csvHeader = 'ID Сделки;Код лота;ЖК;Застройщик;Этап;Возврат продавцу (RUB);Дисконт (RUB);Куратор\n';
    const csvRows = deals
      .map(
        (d) =>
          `${d.dealId};${d.lotCode};"${d.complexName || d.lotTitle}";"${d.developer}";${d.stage};${d.sellerReturnRub};${d.discountRub};"${d.curatorName}"`
      )
      .join('\n');

    const content = '\uFEFF' + csvHeader + csvRows;
    const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
    const dateStamp = new Date().toISOString().slice(0, 10);
    FileManager.downloadFile(
      dataUri,
      `DomExit_Deals_Registry_${isEmployee ? 'Curator' : 'Platform'}_${dateStamp}.csv`
    );

    setExportNotice(
      language === 'ru'
        ? `Выгружен реестр сделок (${deals.length} зап.) в формате CSV (UTF-8)`
        : `Exported deals registry (${deals.length} rows) as CSV`
    );
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>{title}</span>
          </h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center space-x-3">
          {/* Banking API indicator */}
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Сбер / ВТБ Эскроу API: Онлайн</span>
          </div>

          {/* Dual RU/EN language switcher in admin */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('ru')}
              className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                language === 'ru' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                language === 'en' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>

          {/* Notification Bell -> Archive Logs */}
          <Link
            to="/admin/archive-logs"
            title={language === 'ru' ? 'Журнал решений и уведомлений' : 'Audit Logs & Alerts'}
            className="relative p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
          </Link>

          {/* Export Report CTA */}
          <button
            type="button"
            onClick={handleExportRegistry}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Экспорт отчета' : 'Export Report'}</span>
          </button>

          {/* New Request Action */}
          <Link
            to="/sellers"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{language === 'ru' ? '+ Новая заявка ДДУ' : '+ New DDU Exit'}</span>
          </Link>
        </div>
      </div>

      {exportNotice && (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
