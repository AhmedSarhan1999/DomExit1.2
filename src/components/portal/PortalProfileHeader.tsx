import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  LogOut,
  Check,
  Copy,
  Heart,
  Users,
  ArrowRight,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

export type PortalTab = 'buyer' | 'seller' | 'favorites' | 'partner' | 'consents' | 'buybox';

export interface PortalProfileHeaderProps {
  user: UserProfile | null;
  displayName: string;
  displayClientCode: string;
  displayInitial: string;
  activeTab: PortalTab;
  onSelectTab: (tab: PortalTab) => void;
  buyerBidsCount: number;
  sellerLotsCount: number;
  favoritesCount: number;
  isPartnerApproved: boolean;
  onOpenProfileModal: () => void;
  onLogout: () => void;
}

export const PortalProfileHeader: React.FC<PortalProfileHeaderProps> = ({
  user,
  displayName,
  displayClientCode,
  displayInitial,
  activeTab,
  onSelectTab,
  buyerBidsCount,
  sellerLotsCount,
  favoritesCount,
  isPartnerApproved,
  onOpenProfileModal,
  onLogout,
}) => {
  const { language } = useLanguage();
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleCopyClientCode = () => {
    navigator.clipboard?.writeText(displayClientCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <section className="bg-white text-slate-900 pt-8 pb-8 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div
              onClick={onOpenProfileModal}
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              title="Редактировать профиль и аватар"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-[14px]"
                />
              ) : (
                <div className="w-full h-full bg-emerald-600 rounded-[14px] flex items-center justify-center font-bold text-white text-xl">
                  {displayInitial}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950">
                  {displayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                  Верифицированный профиль
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-500">
                  {user?.email || user?.phone || '+7 (911) 234-56-78'}
                </span>
                <span className="text-slate-300">•</span>
                <div className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/90 text-slate-900 border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shadow-xs">
                  <span className="text-slate-500 font-sans font-medium text-[11px]">
                    {language === 'ru' ? 'ID клиента:' : 'Client ID:'}
                  </span>
                  <span className="text-indigo-700 tracking-wide font-black">
                    {displayClientCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyClientCode}
                    className="p-1 hover:bg-white rounded transition-colors cursor-pointer text-slate-600 hover:text-indigo-600"
                    title={language === 'ru' ? 'Скопировать ID клиента' : 'Copy Client ID'}
                  >
                    {copiedCode ? (
                      <span className="text-emerald-600 text-[10px] font-sans flex items-center space-x-0.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>OK</span>
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Безопасный контур</span>
            </div>

            <button
              type="button"
              onClick={onOpenProfileModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ru' ? 'Мой профиль и безопасность' : 'Profile & Security'}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Выйти' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Portal Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pt-2">
          <button
            type="button"
            onClick={() => onSelectTab('buybox')}
            className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'buybox'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{language === 'ru' ? 'Buy-Box & Очередь' : 'Buy-Box & Queue'}</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
              SMART
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('buyer')}
            className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'buyer'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{language === 'ru' ? 'Мои заявки на покупку' : 'My Purchase Offers'}</span>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px]">
              {buyerBidsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('seller')}
            className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'seller'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{language === 'ru' ? 'Мои объекты на выход (0%)' : 'My Seller Exits'}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
              {sellerLotsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('favorites')}
            className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'favorites'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Избранное' : 'Favorites'}</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">
              {favoritesCount}
            </span>
          </button>

          {/* Partner Tab strictly conditionally rendered */}
          {isPartnerApproved && (
            <button
              type="button"
              onClick={() => onSelectTab('partner')}
              className={`pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'partner'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>{language === 'ru' ? 'Кабинет Партнера' : 'Partner Portal'}</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                PRO
              </span>
            </button>
          )}

          {activeTab === 'consents' && (
            <button
              type="button"
              onClick={() => onSelectTab('consents')}
              className="pb-3 px-3 sm:px-4 text-xs font-bold border-b-2 border-emerald-600 text-emerald-700 flex items-center space-x-2 cursor-pointer"
            >
              <span>152-ФЗ Согласия</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
