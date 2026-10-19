import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { ShieldCheck, Phone, Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';

export const UnifiedFooter: React.FC = () => {
  const { language, t } = useLanguage();

  return (
    <footer className="bg-[#F8FAFC] border-t border-slate-200 text-slate-700 pt-16 pb-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* 4 Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Column 1: Brand & Telegram */}
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
            <div>
              <a
                href="https://t.me/domexit_ru"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{t.footer.tgChannel}</span>
              </a>
            </div>
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
              <li>
                <Link to="/investors" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {t.footer.investPools}
                </Link>
              </li>
              <li>
                <Link to="/partners" className="text-slate-600 hover:text-emerald-600 transition-colors">
                  {language === 'ru' ? 'Партнерская сеть (бонус 30 000 ₽)' : 'Partner Network (30,000 ₽ bonus)'}
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
                <span>{t.footer.mskOffice}</span>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t.footer.spbOffice}</span>
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
                <a href="tel:+78005553429" className="hover:text-emerald-600">
                  {t.footer.hotline}
                </a>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Mail className="w-4 h-4 text-emerald-600" />
                <a href="mailto:deal@domexit.ru" className="hover:text-emerald-600">
                  {t.footer.email}
                </a>
              </div>
            </div>

            {/* Rosreestr Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.footer.rosreestrBadge}</span>
            </div>
          </div>

        </div>

        {/* Legal Disclaimer Divider & Paragraph */}
        <div className="pt-8 border-t border-slate-200/80 space-y-4 text-xs text-slate-500 leading-relaxed">
          <p>{t.footer.disclaimer}</p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
            <span>{t.footer.rightsReserved}</span>
            <div className="flex items-center space-x-4">
              <Link to="/how-it-works" className="hover:text-slate-600">214-ФЗ Регламент</Link>
              <Link to="/story" className="hover:text-slate-600">Комплаенс и защита</Link>
              <Link to="/investors" className="hover:text-slate-600">NDA & Конфиденциальность</Link>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};
