import React from 'react';
import {
  BarChart3,
  UserCheck,
  Sliders,
  Landmark,
  Users,
  Building2,
  Shield,
} from 'lucide-react';

export type OwnerTab =
  | 'overview'
  | 'sellers'
  | 'market'
  | 'banks'
  | 'users_rbac'
  | 'company_profile'
  | 'legal_cms';

export interface AdminTabBarProps {
  activeOwnerTab: OwnerTab;
  setActiveOwnerTab: (tab: OwnerTab) => void;
  pendingSellerCount: number;
  partnerBanksCount: number;
  usersAndStaffCount: number;
}

export const AdminTabBar: React.FC<AdminTabBarProps> = ({
  activeOwnerTab,
  setActiveOwnerTab,
  pendingSellerCount,
  partnerBanksCount,
  usersAndStaffCount,
}) => {
  return (
    <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
      <button
        type="button"
        onClick={() => setActiveOwnerTab('overview')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'overview'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        <span>1. Сводка и метрики</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveOwnerTab('sellers')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'sellers'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <UserCheck className="w-4 h-4" />
        <span>2. Заявки продавцов</span>
        {pendingSellerCount > 0 && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeOwnerTab === 'sellers'
                ? 'bg-white text-emerald-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {pendingSellerCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setActiveOwnerTab('market')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'market'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <Sliders className="w-4 h-4" />
        <span>3. Рыночные ставки и локации</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveOwnerTab('banks')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'banks'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <Landmark className="w-4 h-4" />
        <span>4. Банки-партнеры</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeOwnerTab === 'banks'
              ? 'bg-white text-emerald-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {partnerBanksCount}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setActiveOwnerTab('users_rbac')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'users_rbac'
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <Users className="w-4 h-4" />
        <span>5. Пользователи, штат и RBAC</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeOwnerTab === 'users_rbac'
              ? 'bg-white text-indigo-900'
              : 'bg-indigo-50 text-indigo-700'
          }`}
        >
          {usersAndStaffCount}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setActiveOwnerTab('company_profile')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'company_profile'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <Building2 className="w-4 h-4" />
        <span>6. Профиль компании и безопасность</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveOwnerTab('legal_cms')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'legal_cms'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
        }`}
      >
        <Shield className="w-4 h-4" />
        <span>7. Правовой CMS и Реестр (26 актов)</span>
      </button>
    </div>
  );
};
