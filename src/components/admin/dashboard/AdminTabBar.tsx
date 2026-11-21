import React from 'react';
import {
  BarChart3,
  UserCheck,
  Sliders,
  Users,
  ShieldCheck,
} from 'lucide-react';

export type OwnerTab =
  | 'overview'
  | 'sellers'
  | 'market'
  | 'users_rbac'
  | 'system_cms';

export interface AdminTabBarProps {
  activeOwnerTab: OwnerTab;
  setActiveOwnerTab: (tab: OwnerTab) => void;
  pendingSellerCount: number;
  usersAndStaffCount: number;
}

export const AdminTabBar: React.FC<AdminTabBarProps> = ({
  activeOwnerTab,
  setActiveOwnerTab,
  pendingSellerCount,
  usersAndStaffCount,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      {/* TAB 1 */}
      <button
        type="button"
        onClick={() => setActiveOwnerTab('overview')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'overview'
            ? 'bg-emerald-600 text-white shadow-2xs'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        <span>1. Сводка и метрики</span>
      </button>

      {/* TAB 2 */}
      <button
        type="button"
        onClick={() => setActiveOwnerTab('sellers')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'sellers'
            ? 'bg-emerald-600 text-white shadow-2xs'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
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

      {/* TAB 3 */}
      <button
        type="button"
        onClick={() => setActiveOwnerTab('market')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'market'
            ? 'bg-emerald-600 text-white shadow-2xs'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
        }`}
      >
        <Sliders className="w-4 h-4" />
        <span>3. Рынок и ставки</span>
      </button>

      {/* TAB 4 */}
      <button
        type="button"
        onClick={() => setActiveOwnerTab('users_rbac')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'users_rbac'
            ? 'bg-indigo-600 text-white shadow-2xs'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
        }`}
      >
        <Users className="w-4 h-4" />
        <span>4. Штат и RBAC</span>
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

      {/* TAB 5 */}
      <button
        type="button"
        onClick={() => setActiveOwnerTab('system_cms')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 cursor-pointer ${
          activeOwnerTab === 'system_cms'
            ? 'bg-emerald-600 text-white shadow-2xs'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
        }`}
      >
        <ShieldCheck className="w-4 h-4" />
        <span>5. Система, Telegram и CMS</span>
      </button>
    </div>
  );
};
