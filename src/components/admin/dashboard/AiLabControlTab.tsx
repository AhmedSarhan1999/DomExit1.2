/**
 * AiLabControlTab.tsx — AI Лаборатория (Beta)
 * Owner-only control panel for AI feature flags, connector status, and live sandbox.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, FlaskConical, Zap, Building2, Landmark, Globe, RefreshCw, Save, AlertTriangle, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { AiAgentBridgePanel } from './AiAgentBridgePanel';
import { AiLegislativeRadarPanel } from './AiLegislativeRadarPanel';

type FeatureKey =
  | 'dadataAutocomplete'
  | 'cbrAutoSync'
  | 'agentResearchBridge'
  | 'visionOcrPreAudit'
  | 'gptLegalCopilot'
  | 'avmValuation'
  | 'aiPackagingStudio'
  | 'legislativeRadar'
  | 'aiConciergeRag';

type Visibility = 'off' | 'owner_only' | 'staff_only' | 'public';

const VISIBILITY_LABELS: Record<Visibility, string> = {
  off: 'Выключено',
  owner_only: 'Только Владелец',
  staff_only: 'Сотрудники',
  public: 'Все клиенты',
};

interface AiLabControlTabProps {
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const AiLabControlTab: React.FC<AiLabControlTabProps> = ({ showToast, showError }) => {
  const [config, setConfig] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [connectors, setConnectors] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCbr, setSyncingCbr] = useState(false);
  const [syncingEiszh, setSyncingEiszh] = useState(false);

  // Local editable state
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [features, setFeatures] = useState<Record<FeatureKey, Visibility>>({} as any);

  // Sandbox state
  const [sandboxTab, setSandboxTab] = useState<'address' | 'party' | 'bank' | 'avm'>('address');
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  // AVM Sandbox inputs
  const [avmComplexName, setAvmComplexName] = useState('Чистое Небо');
  const [avmRegion, setAvmRegion] = useState('spb');
  const [avmAreaSqm, setAvmAreaSqm] = useState('38.5');
  const [avmDduPrice, setAvmDduPrice] = useState('6800000');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.aiLab.getConfig();
      setConfig(data.config);
      setCatalog(data.catalog || []);
      setConnectors(data.connectors || null);
      setMasterEnabled(data.config?.masterLabEnabled ?? false);
      setFeatures(data.config?.features ?? {});
    } catch (err: any) {
      showError('Ошибка загрузки конфигурации AI Lab: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.aiLab.updateConfig({ masterLabEnabled: masterEnabled, features });
      showToast('✅ Конфигурация AI Lab сохранена');
      await loadConfig();
    } catch (err: any) {
      showError('Ошибка сохранения: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCbrSync = async () => {
    setSyncingCbr(true);
    try {
      const result = await apiClient.aiLab.syncCbrRate();
      if (result.ok) {
        showToast(`✅ Ставка ЦБ РФ обновлена: ${result.keyRate}% (с ${result.effectiveDate}), источник: ${result.source}`);
        await loadConfig();
      } else {
        showError('Ошибка синхронизации ЦБ РФ: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (err: any) {
      showError('Ошибка запроса к ЦБ РФ: ' + err.message);
    } finally {
      setSyncingCbr(false);
    }
  };

  const handleEiszhSync = async () => {
    setSyncingEiszh(true);
    try {
      const res = await apiClient.aiLab.syncEiszh({ limitPerDeveloper: 2 });
      if (res.ok) {
        showToast(`✅ Синхронизация ЕИСЖС: проверено ${res.result?.developersChecked || 0} застройщиков, сохранено ${res.result?.syncedCount || 0} проектов`);
        await loadConfig();
      } else {
        showError('Ошибка синхронизации ЕИСЖС: ' + (res.error || 'Неизвестная ошибка'));
      }
    } catch (err: any) {
      showError('Ошибка запроса к ЕИСЖС: ' + err.message);
    } finally {
      setSyncingEiszh(false);
    }
  };

  const handleSandboxQuery = async () => {
    if (sandboxTab === 'avm') {
      if (!avmComplexName.trim() || !avmAreaSqm || !avmDduPrice) {
        showError('Укажите название ЖК, площадь (> 0) и цену ДДУ (> 0)');
        return;
      }
      setSandboxLoading(true);
      setSandboxResult(null);
      try {
        const res = await apiClient.aiLab.estimateAvm({
          complexName: avmComplexName.trim(),
          region: avmRegion,
          areaSqm: Number(avmAreaSqm),
          dduFullPriceRub: Number(avmDduPrice),
          paidToDeveloperRub: Number(avmDduPrice),
        });
        setSandboxResult(res);
      } catch (err: any) {
        setSandboxResult({ error: err.message });
      } finally {
        setSandboxLoading(false);
      }
      return;
    }

    if (!sandboxQuery.trim()) return;
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      let result: any;
      if (sandboxTab === 'address') result = await apiClient.aiLab.suggestAddress(sandboxQuery);
      else if (sandboxTab === 'party') result = await apiClient.aiLab.lookupParty(sandboxQuery);
      else result = await apiClient.aiLab.lookupBank(sandboxQuery);
      setSandboxResult(result);
    } catch (err: any) {
      setSandboxResult({ error: err.message });
    } finally {
      setSandboxLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Загрузка AI Лаборатории...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <FlaskConical className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">AI Лаборатория (Beta)</h2>
            <p className="text-xs text-slate-500">Управление AI-функциями платформы — видно только Владельцу</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Сохранение...' : 'Сохранить настройки'}</span>
        </button>
      </div>

      {/* Master Switch */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Режим AI-лаборатории</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Главный выключатель. Если выключен — ни одна AI-функция не работает для клиентов.
            </p>
            {masterEnabled && (
              <div className="mt-2 flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Только функции с режимом «Все клиенты» видны покупателям. Остальные скрыты.
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMasterEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${masterEnabled ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${masterEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Connector Status */}
      {connectors && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* DaData */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-sm text-slate-900">DaData.ru</span>
              {connectors.dadata.configured
                ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">Настроен</span>
                : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">Не настроен</span>
              }
            </div>
            <p className="text-xs text-slate-500">Free 10K/день — 0 ₽</p>
            <div className="text-xs text-slate-700">
              Использовано: <span className="font-bold">{connectors.dadata.dailyUsed}</span> / {connectors.dadata.dailySoftCap} (лимит)
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, (connectors.dadata.dailyUsed / connectors.dadata.dailySoftCap) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">Только бесплатные подсказки (suggestions.dadata.ru)</p>
          </div>

          {/* CBR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-sm text-slate-900">ЦБ РФ (cbr.ru)</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">0 ₽</span>
            </div>
            {connectors.cbr.currentKeyRate ? (
              <>
                <p className="text-2xl font-black text-emerald-700">{connectors.cbr.currentKeyRate}%</p>
                <p className="text-xs text-slate-500">С {connectors.cbr.effectiveDate || '—'}</p>
                {connectors.cbr.lastUpdatedAt && (
                  <p className="text-[10px] text-slate-400">
                    Обновлено: {new Date(connectors.cbr.lastUpdatedAt).toLocaleString('ru-RU')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Ставка не загружена</p>
            )}
            <button
              type="button"
              onClick={handleCbrSync}
              disabled={syncingCbr}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all disabled:opacity-50"
            >
              {syncingCbr ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>{syncingCbr ? 'Синхронизация...' : 'Синхронизировать ставку ЦБ РФ сейчас'}</span>
            </button>
          </div>

          {/* EISZH (Nash.Dom.RF) & AVM v1 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-sky-600" />
              <span className="font-bold text-sm text-slate-900">ЕИСЖС & AVM</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">0 ₽</span>
            </div>
            <div className="text-xs text-slate-700 space-y-0.5">
              <div>Проектов в базе: <span className="font-bold">{connectors.eiszhAvm?.eiszhProjectsCount || 0}</span></div>
              <div>Оценок AVM: <span className="font-bold">{connectors.eiszhAvm?.totalAvmEstimates || 0}</span></div>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {connectors.eiszhAvm?.eiszhLastSyncAt
                ? `Синхр: ${new Date(connectors.eiszhAvm.eiszhLastSyncAt).toLocaleDateString('ru-RU')}`
                : 'Синхронизация не выполнялась'}
            </p>
            <button
              type="button"
              onClick={handleEiszhSync}
              disabled={syncingEiszh}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {syncingEiszh ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>{syncingEiszh ? 'Синхронизация...' : 'Синхронизировать ЕИСЖС'}</span>
            </button>
          </div>

          {/* Agent Bridge */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-sm text-slate-900">Мост агентов</span>
              {connectors.agentBridge?.webhookSecretConfigured ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">HMAC OK</span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">Без секрета</span>
              )}
            </div>
            <p className="text-xs text-slate-500">n8n / Webhook / Telegram</p>
            <div className="text-xs text-slate-700">
              Ждут проверки:{' '}
              <span className="font-bold text-purple-700">
                {connectors.agentBridge?.pendingReviewCount || 0}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Шлюз 152-ФЗ Zero-PII активен</p>
          </div>

          {/* Yandex AI */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <span className="font-bold text-sm text-slate-900">Yandex Vision/GPT</span>
              {connectors.yandexAi.configured
                ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">Настроен</span>
                : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">Этап 03+</span>
              }
            </div>
            <p className="text-xs text-slate-500">OCR документов, GPT-копилот, AVM оценка</p>
            <p className="text-[10px] text-slate-400 italic">Доступно в дальнейших этапах AI Lab</p>
          </div>
        </div>
      )}

      {/* Feature Flags Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Управление функциями AI Lab</h3>
          <p className="text-xs text-slate-500 mt-0.5">Функции с 🔒 ещё не реализованы — доступно только «Выключено»</p>
        </div>
        <div className="divide-y divide-slate-100">
          {catalog.map((feat: any) => {
            const currentVal = features[feat.key as FeatureKey] || 'off';
            const isImplemented = feat.implemented;
            return (
              <div key={feat.key} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-900">{feat.labelRu}</span>
                    {isImplemented
                      ? <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">✓ Готово</span>
                      : <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">🔒 {feat.roadmapStep}</span>
                    }
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{feat.descriptionRu}</p>
                </div>
                <select
                  value={currentVal}
                  disabled={!isImplemented}
                  onChange={(e) =>
                    setFeatures((prev) => ({ ...prev, [feat.key]: e.target.value as Visibility }))
                  }
                  className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {Object.entries(VISIBILITY_LABELS).map(([val, label]) => (
                    <option key={val} value={val} disabled={!isImplemented && val !== 'off'}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Sandbox */}
      {connectors?.dadata?.configured && (
        <div className="bg-white border border-violet-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-violet-100 bg-violet-50">
            <h3 className="font-bold text-violet-900 text-sm flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Песочница DaData — тест (только для Владельца)</span>
            </h3>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['address', 'party', 'bank', 'avm'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setSandboxTab(tab); setSandboxQuery(''); setSandboxResult(null); }}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${sandboxTab === tab ? 'text-violet-700 border-b-2 border-violet-600 bg-violet-50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab === 'address' ? '🏠 Адрес' : tab === 'party' ? '🏢 ИНН (ЕГРЮЛ)' : tab === 'bank' ? '🏦 БИК (Банк)' : '⚡ AVM v1 Оценка'}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {sandboxTab === 'avm' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Название ЖК:</label>
                    <input
                      type="text"
                      value={avmComplexName}
                      onChange={(e) => setAvmComplexName(e.target.value)}
                      placeholder="ЖК Чистое Небо"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Регион:</label>
                    <select
                      value={avmRegion}
                      onChange={(e) => setAvmRegion(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="spb">Санкт-Петербург / ЛО</option>
                      <option value="msk">Москва / МО</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Площадь (м²):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={avmAreaSqm}
                      onChange={(e) => setAvmAreaSqm(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Цена ДДУ (₽):</label>
                    <input
                      type="number"
                      step="50000"
                      value={avmDduPrice}
                      onChange={(e) => setAvmDduPrice(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSandboxQuery}
                    disabled={sandboxLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
                  >
                    {sandboxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>⚡ Рассчитать AVM v1</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={sandboxQuery}
                  onChange={(e) => setSandboxQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSandboxQuery(); }}
                  placeholder={
                    sandboxTab === 'address' ? 'Санкт-Петербург Ланское...' :
                    sandboxTab === 'party' ? 'ИНН юр. лица (10 цифр)...' :
                    'БИК банка (9 цифр)...'
                  }
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <button
                  type="button"
                  onClick={handleSandboxQuery}
                  disabled={sandboxLoading || !sandboxQuery.trim()}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
                >
                  {sandboxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  <span>Запрос</span>
                </button>
              </div>
            )}

            {sandboxResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                {sandboxResult.error ? (
                  <div className="flex items-center space-x-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="text-xs font-bold">{sandboxResult.error}</span>
                  </div>
                ) : sandboxResult.ok === false ? (
                  <div className="flex items-center space-x-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold">Ошибка: {sandboxResult.errorCode}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold">
                        Успешно {sandboxResult.cached ? '(из кэша)' : '(новый запрос)'}
                      </span>
                    </div>
                    <pre className="text-[10px] text-slate-700 overflow-auto max-h-60 bg-white rounded-lg p-3 border border-slate-100">
                      {JSON.stringify(
                        sandboxTab === 'avm' ? sandboxResult.valuation :
                        sandboxTab === 'address' ? sandboxResult.items?.slice(0, 3) :
                        sandboxTab === 'party' ? sandboxResult.party :
                        sandboxResult.bank,
                        null, 2
                      )}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legislative Radar & Journal Drafts Panel */}
      <AiLegislativeRadarPanel
        connectors={connectors}
        showToast={showToast}
        showError={showError}
      />

      {/* Agent Research Bridge Panel */}
      <AiAgentBridgePanel
        connectors={connectors}
        showToast={showToast}
        showError={showError}
      />
    </div>
  );
};
