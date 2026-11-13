import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { ShieldCheck, Phone, Mail, MapPin, Send, Building2, MessageCircle, Bot } from 'lucide-react';
import { useCompanyProfileStore } from '../../stores/useCompanyProfileStore';
import { usePublicChannelsStore } from '../../stores/usePublicChannelsStore';
import { useFeatureFlagsStore } from '../../stores/useFeatureFlagsStore';

export const UnifiedFooter: React.FC = () => {
  const { language, t } = useLanguage();
  const { profile } = useCompanyProfileStore();
  const { channels } = usePublicChannelsStore();
  const { enableVipClub } = useFeatureFlagsStore();

  return (
    <footer className="bg-[#F8FAFC] border-t border-slate-200 text-slate-700 pt-16 pb-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* 4 Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Column 1: Brand & Overview */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">DomExit</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-300">
                {t.brandTagline}
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t.footer.legalDescription}
            </p>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {t.footer.navTitle}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/sellers" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {t.footer.urgentBuyout}
                </Link>
              </li>
              <li>
                <Link to="/opportunities" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {t.footer.verifiedCatalog}
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {t.footer.safeDealProtocol}
                </Link>
              </li>
              {enableVipClub && (
                <li>
                  <Link to="/vip-catalog" className="text-slate-600 hover:text-emerald-600 transition-colors">
                    {t.footer.investPools}
                  </Link>
                </li>
              )}
              <li>
                <Link to="/partners" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {language === 'ru' ? 'Партнерская сеть (бонус 30 000 ₽)' : 'Partner Network (30,000 ₽ bonus)'}
                </Link>
              </li>
              <li>
                <Link to="/knowledge" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {language === 'ru' ? 'База знаний (214-ФЗ, 140-ФЗ)' : 'Legal Knowledge Hub'}
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {language === 'ru' ? 'Частые вопросы (FAQ)' : 'FAQ & Legal Answers'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Service Offices */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {t.footer.officesTitle}
            </h4>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{profile.postalAddress}</span>
              </div>
              <div className="flex items-start space-x-2">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Офис урегулирования расчетов: Москва, Пресненская наб., 12 (Башня Федерация)</span>
              </div>
            </div>
          </div>

          {/* Column 4: Contact & Support */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {t.footer.supportTitle}
            </h4>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center space-x-2 text-slate-900 font-semibold">
                <Phone className="w-4 h-4 text-emerald-600" />
                <a href={`tel:${(channels.hotlinePhone || profile.officialPhone).replace(/\D/g, '')}`} className="hover:text-emerald-600 font-mono">
                  {channels.hotlinePhone || profile.officialPhone}
                </a>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Mail className="w-4 h-4 text-emerald-600" />
                <a href={`mailto:${channels.supportEmail || profile.privacyEmail}`} className="hover:text-emerald-600">
                  {channels.supportEmail || profile.privacyEmail}
                </a>
              </div>
            </div>

            {/* Social & Messaging Channels (Institutional Minimalist Style) */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-1">
              <a
                href={channels.telegramChannelUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">{t.footer.tgChannel}</span>
              </a>
              <a
                href={channels.telegramBotUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">Бот</span>
              </a>
              <a
                href={channels.vkCommunityUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
              >
                <span className="font-bold text-[11px] text-emerald-700 shrink-0">VK</span>
                <span className="truncate">ВКонтакте</span>
              </a>
              <a
                href={channels.maxProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">MAX</span>
              </a>
            </div>
          </div>

        </div>

        {/* Legal Disclaimer Divider & Official Entity Card */}
        <div className="pt-8 border-t border-slate-200 space-y-4 text-xs text-slate-500 leading-relaxed">
          <div className="bg-slate-100/70 rounded-2xl p-4 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800">
              {profile.fullName} ({profile.shortName})
            </div>
            <div>
              ОГРН: <span className="font-mono">{profile.ogrn}</span> • ИНН: <span className="font-mono">{profile.inn}</span> • КПП: <span className="font-mono">{profile.kpp}</span>
            </div>
            <div>
              Юридический адрес: {profile.legalAddress}
            </div>
            <div>
              Расчетный банк: {profile.bankName} (БИК: <span className="font-mono">{profile.bik}</span>, р/с: <span className="font-mono">{profile.checkingAccount}</span>)
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-3 text-[11px] text-slate-500 border-t border-slate-200/80">
            <div>
              © 2026 {profile.shortName}. Все права защищены. Сервис аккредитован для расчетов по 214-ФЗ.
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
              <Link to="/privacy" className="hover:text-emerald-700 underline">
                Политика 152-ФЗ
              </Link>
              <Link to="/terms" className="hover:text-emerald-700 underline">
                Пользовательское соглашение
              </Link>
              <Link to="/consent-pd" className="hover:text-emerald-700 underline">
                Согласие на обработку ПД
              </Link>
              <Link to="/consent-ads" className="hover:text-emerald-700 underline">
                Реклама (ФЗ-38)
              </Link>
              <Link to="/consent-distribution" className="hover:text-emerald-700 underline">
                Распространение ПД (ст. 10.1)
              </Link>
              <Link to="/legal/archive" className="hover:text-emerald-700 underline text-emerald-800 font-bold">
                Архив редакций (SHA-256)
              </Link>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};
