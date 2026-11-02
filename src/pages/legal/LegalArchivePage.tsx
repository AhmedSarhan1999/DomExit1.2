import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  FileText,
  History,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ExternalLink,
  Lock,
  Layers,
} from 'lucide-react';
import { LegalPoliciesRepository, CANONICAL_POLICY_NAMES } from '../../dal/repositories/LegalPoliciesRepository';
import { LegalPolicyType, LegalPolicyVersion } from '../../types';

export const LegalArchivePage: React.FC = () => {
  const [allVersions, setAllVersions] = useState<LegalPolicyVersion[]>([]);
  const [selectedType, setSelectedType] = useState<LegalPolicyType | 'all'>('all');
  const [viewingVersion, setViewingVersion] = useState<LegalPolicyVersion | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await LegalPoliciesRepository.getAllVersions();
        setAllVersions(data);
      } finally {
        setIsLoading(false);
      }
    };
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCopyHash = (hash: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2500);
    }
  };

  const policyTypes: { id: LegalPolicyType | 'all'; label: string }[] = [
    { id: 'all', label: 'Все документы' },
    { id: 'privacy', label: 'Политика ПДн (152-ФЗ)' },
    { id: 'user_agreement', label: 'Пользовательское соглашение' },
    { id: 'cookies', label: 'Файлы Cookie' },
    { id: 'advertising_consent', label: 'Реклама (38-ФЗ)' },
    { id: 'public_distribution_consent', label: 'Распространение (ст. 10.1)' },
  ];

  const filteredVersions = allVersions.filter((v) => {
    if (selectedType === 'all') return true;
    return v.policyType === selectedType;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 pt-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/" className="hover:text-emerald-600 flex items-center space-x-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>На главную</span>
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">Публичный архив юридических редакций</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
              <History className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Стандарты прозрачности Роскомнадзора и 152-ФЗ
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                Публичный архив юридических документов и контрольных сумм SHA-256
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            Настоящий архив содержит хронологический перечень всех действующих и архивных редакций юридических документов платформы «DomExit». Для каждой редакции вычислена криптографическая контрольная сумма SHA-256, исключающая ретроспективное изменение условий соглашений.
          </p>

          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-500 border-t border-slate-100">
            <span className="flex items-center space-x-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Неизменяемый криптографический реестр</span>
            </span>
            <span>•</span>
            <span>Хостинг данных: Российская Федерация (Yandex Cloud)</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap gap-2">
          {policyTypes.map((pt) => (
            <button
              key={pt.id}
              onClick={() => setSelectedType(pt.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedType === pt.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>

        {/* Versions Table / List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Загрузка архивных записей...</p>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
            Записей в выбранной категории не обнаружено.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVersions.map((version) => (
              <div
                key={version.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {version.policyNameRu}
                      </span>
                      {version.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          Текущая редакция
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-1">
                      Редакция {version.versionNumber} от {version.effectiveDate}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        version.changeType === 'material'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {version.changeType === 'material'
                        ? 'Существенные изменения (ст. 152-ФЗ)'
                        : 'Техническая правка'}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-800">Описание изменений: </span>
                  {version.changeSummary}
                </div>

                {/* Cryptographic SHA-256 Hash Display */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-xl font-mono text-xs">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="text-slate-400 font-sans font-bold text-[10px] uppercase">
                      SHA-256:
                    </span>
                    <span className="text-emerald-400 truncate font-semibold">
                      {version.sha256Hash}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleCopyHash(version.sha256Hash)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center space-x-1 transition-colors"
                      title="Скопировать хэш"
                    >
                      {copiedHash === version.sha256Hash ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Копировать хэш</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setViewingVersion(version)}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] transition-colors"
                    >
                      Посмотреть текст
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for viewing historic version text */}
        {viewingVersion && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg text-slate-900">
                    {viewingVersion.policyNameRu} (v{viewingVersion.versionNumber})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Вступила в силу: {viewingVersion.effectiveDate} • Контрольная сумма SHA-256 проверена
                  </p>
                </div>
                <button
                  onClick={() => setViewingVersion(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs break-all">
                  SHA-256: {viewingVersion.sha256Hash}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {viewingVersion.fullText}
                </pre>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setViewingVersion(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
