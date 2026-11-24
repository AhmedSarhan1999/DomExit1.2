import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Save,
  Loader2,
  Share2,
  Send,
  Bot,
  Globe,
  Phone,
  Mail,
  ShieldAlert,
  Plus,
  FileText,
  Lock,
  X,
  Copy,
} from 'lucide-react';
import { CompanyLegalProfile, PublicChannelsConfig, SecurityIncidentRecord } from '../../../types';
import { useCompanyProfileStore } from '../../../stores/useCompanyProfileStore';
import { usePublicChannelsStore } from '../../../stores/usePublicChannelsStore';
import { usePlatformSettingsStore } from '../../../stores/usePlatformSettingsStore';
import { SecurityIncidentsRepository } from '../../../dal/repositories/SecurityIncidentsRepository';
import { AuditLogsRepository } from '../../../dal/repositories/AuditLogsRepository';
import { withAsyncTimeout, ASYNC_NETWORK_TIMEOUT_MESSAGE } from '../../../utils/asyncGuard';

export interface LegalAndChannelsTabProps {
  operatorName: string;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
  section?: 'all' | 'legal_requisites' | 'pdn_incidents';
}

export const LegalAndChannelsTab: React.FC<LegalAndChannelsTabProps> = ({
  operatorName,
  showToast,
  showError,
  section = 'all',
}) => {
  // Global Stores
  const {
    profile: globalLegalProfile,
    updateProfile: updateGlobalLegalProfile,
  } = useCompanyProfileStore();

  const {
    channels: globalChannels,
    updateChannels: updateGlobalChannels,
  } = usePublicChannelsStore();

  // Local Form States
  const [legalForm, setLegalForm] = useState<CompanyLegalProfile>(globalLegalProfile);
  const [isSavingLegalForm, setIsSavingLegalForm] = useState<boolean>(false);
  const [legalSaveSuccess, setLegalSaveSuccess] = useState<boolean>(false);

  const [channelsForm, setChannelsForm] = useState<PublicChannelsConfig>(globalChannels);
  const [isSavingChannels, setIsSavingChannels] = useState<boolean>(false);
  const [channelsSaveSuccess, setChannelsSaveSuccess] = useState<boolean>(false);

  // Synchronize when store updates
  useEffect(() => {
    if (globalLegalProfile) {
      setLegalForm(globalLegalProfile);
    }
  }, [globalLegalProfile]);

  useEffect(() => {
    if (globalChannels) {
      setChannelsForm(globalChannels);
    }
  }, [globalChannels]);

  // Incidents State
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>([]);
  const [showAddIncidentModal, setShowAddIncidentModal] = useState<boolean>(false);
  const [newIncidentTitle, setNewIncidentTitle] = useState<string>('');
  const [newIncidentDesc, setNewIncidentDesc] = useState<string>('');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [newIncidentRecordsCount, setNewIncidentRecordsCount] = useState<number>(1);
  const [isReportingIncident, setIsReportingIncident] = useState<boolean>(false);
  const [selectedIncidentDraft, setSelectedIncidentDraft] = useState<SecurityIncidentRecord | null>(null);

  const [activePdnTab, setActivePdnTab] = useState<'active' | 'archived'>('active');

  const fetchPdnIncidents = async () => {
    try {
      const data = await SecurityIncidentsRepository.getPaginated({ category: 'pdn_breach_152fz' });
      setIncidents(data.items || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    }
  };

  // Load 152-FZ PDn breach incidents only
  useEffect(() => {
    fetchPdnIncidents();
  }, []);

  // Handle saving company legal requisites
  const handleSaveLegalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLegalForm(true);
    setLegalSaveSuccess(false);
    try {
      await withAsyncTimeout(
        (async () => {
          await updateGlobalLegalProfile(legalForm);
          await usePlatformSettingsStore.getState().saveLegalProfile(legalForm);
          await AuditLogsRepository.addLog({
            operatorName,
            operatorRole: 'owner',
            actionType: 'company_profile_updated',
            title: 'Обновлены официальные реквизиты компании',
            description: `Обновлены реквизиты ООО «ДОМЭКЗИТ» (ИНН ${legalForm.inn}, КПП ${legalForm.kpp}, ОГРН ${legalForm.ogrn}). Изменения применены ко всем 26 юридическим документам и сквозному интерфейсу.`,
          });
          setLegalSaveSuccess(true);
          showToast('Официальные юридические реквизиты компании сохранены и синхронизированы!');
          setTimeout(() => setLegalSaveSuccess(false), 4000);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSavingLegalForm(false);
    }
  };

  // Handle saving public social channels & platform contacts (Section 2)
  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingChannels(true);
    setChannelsSaveSuccess(false);
    try {
      await withAsyncTimeout(
        (async () => {
          await updateGlobalChannels(channelsForm);
          await usePlatformSettingsStore.getState().saveChannels(channelsForm);
          await AuditLogsRepository.addLog({
            operatorName,
            operatorRole: 'owner',
            actionType: 'company_profile_updated',
            title: 'Обновлены официальные каналы связи и социальные сети платформы',
            description: `Telegram: ${channelsForm.telegramChannelUrl}, Бот: ${channelsForm.telegramBotUrl}, MAX: ${channelsForm.maxProfileUrl}, Горячая линия: ${channelsForm.hotlinePhone}.`,
          });
          setChannelsSaveSuccess(true);
          showToast('Каналы связи и ссылки соцсетей сохранены и обновлены на всем сайте!');
          setTimeout(() => setChannelsSaveSuccess(false), 4000);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsSavingChannels(false);
    }
  };

  // Handle registering new security incident (Roskomnadzor 24h)
  const handleReportSecurityIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentTitle.trim() || !newIncidentDesc.trim()) {
      showError('Укажите название и подробное описание инцидента безопасности.');
      return;
    }
    setIsReportingIncident(true);
    try {
      await withAsyncTimeout(
        (async () => {
          const inc = await SecurityIncidentsRepository.reportIncident({
            title: newIncidentTitle.trim(),
            description: newIncidentDesc.trim(),
            severity: newIncidentSeverity,
            affectedRecordsCount: Number(newIncidentRecordsCount),
            companyInn: legalForm.inn,
            companyName: legalForm.shortName,
          });
          await fetchPdnIncidents();
          setShowAddIncidentModal(false);
          setNewIncidentTitle('');
          setNewIncidentDesc('');
          setSelectedIncidentDraft(inc);
          showToast(`Инцидент зафиксирован! Сформирован проект уведомления в Роскомнадзор (Срок: 24ч).`);
        })(),
        15000
      );
    } catch (err: any) {
      showError(err.message || ASYNC_NETWORK_TIMEOUT_MESSAGE);
    } finally {
      setIsReportingIncident(false);
    }
  };

  const handleUpdateIncidentStatus = async (
    inc: SecurityIncidentRecord,
    newStatus: 'investigating' | 'notified_rkn' | 'resolved'
  ) => {
    const updated: SecurityIncidentRecord = {
      ...inc,
      status: newStatus,
      reportedToRoskomnadzor:
        newStatus === 'notified_rkn' || newStatus === 'resolved' ? true : inc.reportedToRoskomnadzor,
      roskomnadzorNotificationDate:
        newStatus === 'notified_rkn' && !inc.roskomnadzorNotificationDate
          ? new Date().toISOString()
          : inc.roskomnadzorNotificationDate,
      resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : inc.resolvedAt,
    };
    setIncidents((prev) => prev.map((item) => (item.id === inc.id ? updated : item)));
    await SecurityIncidentsRepository.updateIncident(updated);
    await fetchPdnIncidents();
    showToast(
      `Статус инцидента «${inc.title}» обновлен: ${
        newStatus === 'notified_rkn'
          ? 'Уведомление в РКН отправлено'
          : newStatus === 'resolved'
          ? 'Инцидент закрыт'
          : 'На расследовании'
      }`
    );
  };

  const showLegalAndChannels = section === 'all' || section === 'legal_requisites';
  const showPdnIncidents = section === 'all' || section === 'pdn_incidents';

  const openPdnIncidents = incidents.filter((i) => i.status !== 'resolved');
  const resolvedPdnIncidents = incidents.filter((i) => i.status === 'resolved');
  const displayedIncidents = activePdnTab === 'active' ? openPdnIncidents : resolvedPdnIncidents;

  return (
    <div className="space-y-6">
      {/* SECTION A & B: COMPLIANCE, REQUISITES & PUBLIC CHANNELS */}
      {showLegalAndChannels && (
        <>
          {/* SECTION A: COMPLIANCE & LEGAL HUB: 152-FZ / 38-FZ / ROSKOMNADZOR (15 fields) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-black">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Правовой профиль и реквизиты компании
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  Роскомнадзор 2026 Ready
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Официальные банковские и юридические реквизиты. Динамически подставляются во все публичные документы платформы и сквозной подвал сайта.
              </p>
            </div>
          </div>

          {/* Public Legal Pages Quick Links */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to="/legal/privacy-policy"
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
            >
              <span>Политика конфиденциальности</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
            <Link
              to="/legal/terms-of-service"
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
            >
              <span>Условия и СБР</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
            <Link
              to="/legal/user-consent-pd"
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
            >
              <span>Согласие ПДн</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
            <Link
              to="/legal/ads-consent-38fz"
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
            >
              <span>Реклама 38-ФЗ</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
            <Link
              to="/legal/distribution-consent-10-1"
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1"
            >
              <span>Распространение 10.1</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>

        <form onSubmit={handleSaveLegalProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Полное наименование:
              </label>
              <input
                type="text"
                value={legalForm.fullName}
                onChange={(e) => setLegalForm({ ...legalForm, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Краткое наименование:
              </label>
              <input
                type="text"
                value={legalForm.shortName}
                onChange={(e) => setLegalForm({ ...legalForm, shortName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Форма собственности:
              </label>
              <select
                value={legalForm.entityType}
                onChange={(e) =>
                  setLegalForm({
                    ...legalForm,
                    entityType: e.target.value as 'ООО' | 'АО' | 'ИП',
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
              >
                <option value="ООО">ООО (Общество с ограниченной ответственностью)</option>
                <option value="АО">АО (Акционерное общество)</option>
                <option value="ИП">ИП (Индивидуальный предприниматель)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Генеральный директор:
              </label>
              <input
                type="text"
                value={legalForm.generalDirector}
                onChange={(e) => setLegalForm({ ...legalForm, generalDirector: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ОГРН:</label>
              <input
                type="text"
                value={legalForm.ogrn}
                onChange={(e) => setLegalForm({ ...legalForm, ogrn: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ИНН:</label>
              <input
                type="text"
                value={legalForm.inn}
                onChange={(e) => setLegalForm({ ...legalForm, inn: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">КПП:</label>
              <input
                type="text"
                value={legalForm.kpp}
                onChange={(e) => setLegalForm({ ...legalForm, kpp: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ответственный за ПДн (DPO):
              </label>
              <input
                type="text"
                value={legalForm.dpoName}
                onChange={(e) => setLegalForm({ ...legalForm, dpoName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Юридический адрес:
              </label>
              <input
                type="text"
                value={legalForm.legalAddress}
                onChange={(e) => setLegalForm({ ...legalForm, legalAddress: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Почтовый адрес:</label>
              <input
                type="text"
                value={legalForm.postalAddress}
                onChange={(e) => setLegalForm({ ...legalForm, postalAddress: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email для обращений по ПДн:
              </label>
              <input
                type="email"
                value={legalForm.privacyEmail}
                onChange={(e) => setLegalForm({ ...legalForm, privacyEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Официальный телефон:
              </label>
              <input
                type="text"
                value={legalForm.officialPhone}
                onChange={(e) => setLegalForm({ ...legalForm, officialPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Банк:</label>
              <input
                type="text"
                value={legalForm.bankName}
                onChange={(e) => setLegalForm({ ...legalForm, bankName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">БИК:</label>
              <input
                type="text"
                value={legalForm.bik}
                onChange={(e) => setLegalForm({ ...legalForm, bik: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Расчетный счет:
              </label>
              <input
                type="text"
                value={legalForm.checkingAccount}
                onChange={(e) => setLegalForm({ ...legalForm, checkingAccount: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Корреспондентский счет:
              </label>
              <input
                type="text"
                value={legalForm.correspondentAccount}
                onChange={(e) =>
                  setLegalForm({ ...legalForm, correspondentAccount: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:border-sky-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end items-center space-x-3 pt-3 border-t border-slate-100">
            {legalSaveSuccess && (
              <span className="text-emerald-600 font-bold text-xs flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Реквизиты сохранены и обновлены в документах!</span>
              </span>
            )}
            <button
              type="submit"
              disabled={isSavingLegalForm}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl font-bold transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
            >
              {isSavingLegalForm ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Сохранение в базе...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Сохранить реквизиты и обновить юридические документы</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION B: SOCIAL CHANNELS & PUBLIC LINKS HUB (7 fields) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Каналы связи и социальные сети платформы (Realtime Sync)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Сквозная синхронизация
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Официальные ссылки Telegram, MAX, VK и горячая линия. Обновляются мгновенно в шапке, подвале и контактах лотов.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
            Live Platform Links Hub
          </span>
        </div>

        <form onSubmit={handleSaveChannels} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Send className="w-3.5 h-3.5 text-sky-500" />
                <span>Официальный Telegram-канал:</span>
              </label>
              <input
                type="url"
                value={channelsForm.telegramChannelUrl}
                onChange={(e) =>
                  setChannelsForm({ ...channelsForm, telegramChannelUrl: e.target.value })
                }
                placeholder="https://t.me/domexit_official"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
                <span>Telegram-бот поддержки:</span>
              </label>
              <input
                type="url"
                value={channelsForm.telegramBotUrl}
                onChange={(e) =>
                  setChannelsForm({ ...channelsForm, telegramBotUrl: e.target.value })
                }
                placeholder="https://t.me/DomExitBot"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>Официальный профиль MAX:</span>
              </label>
              <input
                type="url"
                value={channelsForm.maxProfileUrl}
                onChange={(e) =>
                  setChannelsForm({ ...channelsForm, maxProfileUrl: e.target.value })
                }
                placeholder="https://max.ru/domexit"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Share2 className="w-3.5 h-3.5 text-blue-500" />
                <span>VK Сообщество:</span>
              </label>
              <input
                type="url"
                value={channelsForm.vkCommunityUrl}
                onChange={(e) =>
                  setChannelsForm({ ...channelsForm, vkCommunityUrl: e.target.value })
                }
                placeholder="https://vk.com/domexit_ru"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>Телефон горячей линии:</span>
              </label>
              <input
                type="text"
                value={channelsForm.hotlinePhone}
                onChange={(e) =>
                  setChannelsForm({ ...channelsForm, hotlinePhone: e.target.value })
                }
                placeholder="+7 (812) 409-32-00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Email службы поддержки:</span>
              </label>
              <input
                type="email"
                value={channelsForm.supportEmail}
                onChange={(e) =>
                  setChannelsForm({ ...channelsForm, supportEmail: e.target.value })
                }
                placeholder="info@domexit.ru"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end items-center space-x-3 pt-3 border-t border-slate-100">
            {channelsSaveSuccess && (
              <span className="text-emerald-600 font-bold text-xs flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Каналы связи сохранены и обновлены!</span>
              </span>
            )}
            <button
              type="submit"
              disabled={isSavingChannels}
              className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white rounded-xl font-bold transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
            >
              {isSavingChannels ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Сохранение в базе...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Сохранить каналы связи и обновить ссылки</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
        </>
      )}

      {/* SECTION C: 152-FZ OFFICIAL PDn BREACH REGISTER & PROTOCOL */}
      {showPdnIncidents && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 font-black">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Протокол инцидентов безопасности ПДн (ч. 3.1 ст. 21 № 152-ФЗ)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Роскомнадзор 24ч Дедлайн
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Официальный журнал регистрации неправомерной передачи или утечки персональных данных с генерацией уведомления регулятору.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddIncidentModal(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Зафиксировать инцидент ПДн (24ч)</span>
          </button>
        </div>

        {/* Sub-tabs: Active vs Archived */}
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
          <button
            type="button"
            onClick={() => setActivePdnTab('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activePdnTab === 'active'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Активные ({openPdnIncidents.length})
          </button>
          <button
            type="button"
            onClick={() => setActivePdnTab('archived')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activePdnTab === 'archived'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Архив (Решённые) ({resolvedPdnIncidents.length})
          </button>
        </div>

        {/* Incident Log Records */}
        <div className="space-y-3">
          {displayedIncidents.length === 0 ? (
            activePdnTab === 'active' ? (
              <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-emerald-900">
                  Нарушений и утечек ПДн не зафиксировано (0 инцидентов)
                </p>
                <p className="text-xs text-emerald-700">
                  Контур защищен по стандартам ч. 3.1 ст. 21 № 152-ФЗ с обязательной 24-часовой нотификацией в Роскомнадзор при сбое.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                В архиве нет закрытых инцидентов ПДн.
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            inc.severity === 'critical'
                              ? 'bg-rose-600 text-white'
                              : inc.severity === 'high'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-600 text-white'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{inc.title}</h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Зафиксирован: {new Date(inc.timestamp).toLocaleString('ru-RU')}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inc.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : inc.status === 'notified_rkn'
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                      }`}
                    >
                      {inc.status === 'resolved'
                        ? 'Инцидент закрыт ✓'
                        : inc.status === 'notified_rkn'
                        ? 'РКН уведомлен'
                        : 'На расследовании'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {inc.description}
                  </p>

                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Затронуто записей: <strong className="text-slate-800">{inc.affectedRecordsCount}</strong></span>
                    <span>{inc.reportedToRoskomnadzor ? '✓ Уведомлен Роскомнадзор' : '⚠ Требует отправки в РКН'}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIncidentDraft(inc)}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Черновик в РКН</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      {inc.status === 'investigating' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateIncidentStatus(inc, 'notified_rkn')}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Отметить отправку в РКН
                        </button>
                      )}
                      {inc.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateIncidentStatus(inc, 'resolved')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Закрыть инцидент
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 152-FZ Security Incident Registration Modal */}
      {showAddIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Регистрация инцидента безопасности ПДн
                  </h3>
                  <span className="text-[11px] font-bold text-rose-600">
                    ч. 3.1 ст. 21 № 152-ФЗ (Дедлайн уведомления РКН: 24 часа)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddIncidentModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportSecurityIncident} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Краткое наименование инцидента *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Несанкционированная попытка выгрузки базы контактов"
                  value={newIncidentTitle}
                  onChange={(e) => setNewIncidentTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Уровень критичности инцидента *:
                </label>
                <select
                  value={newIncidentSeverity}
                  onChange={(e) => setNewIncidentSeverity(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-rose-500"
                >
                  <option value="low">Низкий (Локальный сбой без компрометации)</option>
                  <option value="medium">Средний (Затронуты контактные данные без паспортов)</option>
                  <option value="high">Высокий (Компрометация чувствительных данных / ДДУ)</option>
                  <option value="critical">Критический (Массовая утечка или атака на контур)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ориентировочное число затронутых субъектов ПДн *:
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newIncidentRecordsCount}
                  onChange={(e) => setNewIncidentRecordsCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Подробное описание обстоятельств и причин инцидента *:
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Опишите хронологию событий, затронутые категории ПДн и принятые первичные меры локализации..."
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-rose-500 text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ⚖️ <strong>Внимание:</strong> После сохранения система автоматически сформирует официальный текст уведомления для направления в Федеральную службу по надзору в сфере связи, информационных технологий и массовых коммуникаций (Роскомнадзор).
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddIncidentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isReportingIncident}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {isReportingIncident ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Формирование протокола...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Зафиксировать и сформировать проект</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roskomnadzor 24h Notification Draft Viewer Modal */}
      {selectedIncidentDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Официальный черновик уведомления в Роскомнадзор
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    В соответствии с ч. 3.1 ст. 21 Федерального закона № 152-ФЗ
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncidentDraft(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto select-all border border-slate-800">
                {selectedIncidentDraft.roskomnadzorDraft}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  Дедлайн направления: {selectedIncidentDraft.deadline24h ? new Date(selectedIncidentDraft.deadline24h).toLocaleString('ru-RU') : '—'}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedIncidentDraft.roskomnadzorDraft || '');
                      showToast('Официальный текст уведомления скопирован в буфер обмена!');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопировать в буфер</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIncidentDraft(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Закрыть окно
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
