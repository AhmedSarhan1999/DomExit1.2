import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { AuditLogEntry, Employee } from '../types';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  ShieldCheck,
  Building2,
  Clock,
  Download,
  X,
  ExternalLink,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const AdminArchiveLogsPage: React.FC = () => {
  const { language } = useLanguage();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    async function load() {
      const [allLogs, allEmps] = await Promise.all([
        AuditLogsRepository.getAllLogs(),
        EmployeesRepository.getAll(),
      ]);
      setLogs(allLogs);
      setEmployees(allEmps);
    }
    load();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText =
        log.title.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        (log.lotCode && log.lotCode.toLowerCase().includes(q)) ||
        (log.dealId && log.dealId.toLowerCase().includes(q)) ||
        log.operatorName.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    if (selectedOperator !== 'all') {
      if (log.operatorName !== selectedOperator) return false;
    }

    if (selectedActionType !== 'all') {
      if (log.actionType !== selectedActionType) return false;
    }

    return true;
  });

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getActionBadgeColor = (action?: string) => {
    switch (action) {
      case 'legal_approved':
      case 'packaging_published':
      case 'escrow_released':
      case 'credit_limit_granted':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'escrow_transferred_to_bank':
      case 'escrow_funds_deposited':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'deal_cancelled_relisted':
      case 'legal_rejected':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'doc_requested':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <AdminHeader
          title="Архив сделок и журнал решений"
          subtitle="Сквозной реестр юридических, банковских и операционных действий с фиксацией точного времени по ГОСТ"
        />

        <div className="p-4 sm:p-6 space-y-6 max-w-7xl">
          
          {/* Top Filter and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по коду лота (#U-10566), сделке, ФИО сотрудника или событию..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Operator Filter */}
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-800 focus:bg-white"
              >
                <option value="all">Все сотрудники и операторы</option>
                {Array.from(new Set(logs.map((l) => l.operatorName))).map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>

              {/* Action Type Filter */}
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-800 focus:bg-white"
              >
                <option value="all">Все типы решений</option>
                <option value="legal_approved">Юр. одобрение (42/42)</option>
                <option value="doc_requested">Запрос доп. документов</option>
                <option value="packaging_published">Публикация в каталоге</option>
                <option value="buyer_matched">Отбор покупателя</option>
                <option value="escrow_transferred_to_bank">Передача в банк</option>
                <option value="escrow_funds_deposited">Депонирование средств</option>
                <option value="escrow_released">Раскрытие аккредитива</option>
                <option value="deal_cancelled_relisted">Срыв сделки / Перевыставление</option>
                <option value="credit_limit_granted">Кредитный лимит банка</option>
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div>
                Найдено записей: <strong className="text-slate-900">{filteredLogs.length}</strong> из {logs.length}
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold text-[11px]">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Хронология: по убыванию даты (новейшие сверху)</span>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Точное время (Timestamp)</th>
                    <th className="py-3.5 px-4 font-bold">Лот / Сделка</th>
                    <th className="py-3.5 px-4 font-bold">Ответственный оператор</th>
                    <th className="py-3.5 px-4 font-bold">Принятое решение / Событие</th>
                    <th className="py-3.5 px-4 font-bold">Файлы / Приложения</th>
                    <th className="py-3.5 px-4 text-right font-bold">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Lot / Deal */}
                      <td className="py-3 px-4 font-mono">
                        {log.lotCode && (
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] mr-1.5">
                            #{log.lotCode}
                          </span>
                        )}
                        {log.dealId && (
                          <span className="text-[10px] text-slate-500 block sm:inline">
                            {log.dealId}
                          </span>
                        )}
                      </td>

                      {/* Operator */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{log.operatorName}</div>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {log.operatorRole === 'curator' ? 'Куратор отдела выходов' :
                           log.operatorRole === 'bank_officer' ? 'Офицер банка-партнера' :
                           log.operatorRole === 'owner' ? 'Владелец платформы' : 'Системный шлюз'}
                        </span>
                      </td>

                      {/* Decision & Title */}
                      <td className="py-3 px-4 max-w-md">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getActionBadgeColor(log.actionType)}`}>
                            {log.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {log.description}
                        </p>
                      </td>

                      {/* Attachments */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.attachments && log.attachments.length > 0 ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{log.attachments.length} файла</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Нет файлов</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          Подробнее
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* Log Detail Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Карточка операции и протокол решения
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Event Badge & Title */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs ${getActionBadgeColor(selectedLog.actionType)}`}>
                    {selectedLog.title}
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    ID: {selectedLog.id}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed pt-1">
                  {selectedLog.description}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Точное время операции:</span>
                  <strong className="text-slate-900 font-mono">{formatTimestamp(selectedLog.timestamp)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Ответственный оператор:</span>
                  <strong className="text-slate-900">{selectedLog.operatorName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Код объекта (Лот):</span>
                  <strong className="text-indigo-700 font-mono">
                    {selectedLog.lotCode ? `#${selectedLog.lotCode}` : 'Общий контур'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Номер сделки (CRM):</span>
                  <strong className="text-slate-800 font-mono">{selectedLog.dealId || 'N/A'}</strong>
                </div>
              </div>

              {/* Additional Context Metadata if available */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-2">
                  <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] block">
                    Параметры и числовые показатели:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-800">
                    {Object.entries(selectedLog.metadata).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-slate-500 block capitalize">{k}:</span>
                        <strong>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attached Scans and Documents */}
              {selectedLog.attachments && selectedLog.attachments.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                    Прикрепленные сканы и протоколы ({selectedLog.attachments.length}):
                  </span>
                  <div className="space-y-2">
                    {selectedLog.attachments.map((f, i) => (
                      <div
                        key={i}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{f.name}</span>
                        </div>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors flex items-center space-x-1 shrink-0"
                        >
                          <Download className="w-3 h-3" />
                          <span>Скачать</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Закрыть карточку
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
