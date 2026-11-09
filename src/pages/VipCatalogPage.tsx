import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { Lot, RussianCityCode } from '../types';
import { formatRubles, formatPercent } from '../utils/formatters';
import { resolveLotGeoDetails } from '../data/russianGeography';
import {
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  ExternalLink,
  Lock,
  Building,
  MapPin,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';

export const VipCatalogPage: React.FC = () => {
  const { user } = useAuth();
  const [vipLots, setVipLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCity, setSelectedCity] = useState<'all' | RussianCityCode>('all');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Check VIP credentials: owner, employee, verified subscriber or master test emails
  const isVip = Boolean(
    user?.isVipSubscriber ||
      user?.role === 'owner' ||
      user?.activeRole === 'owner' ||
      user?.role === 'employee' ||
      user?.activeRole === 'employee' ||
      user?.email === 'amaas9499@gmail.com' ||
      user?.email === 'amaas9494@gmail.com'
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await LotsRepository.getVipLots();
        setVipLots(list);
      } catch (err) {
        console.error('Failed to load VIP lots:', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Live clock ticker every minute for countdowns
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const filteredLots = vipLots.filter((lot) => {
    if (selectedCity !== 'all' && lot.city !== selectedCity) return false;
    return true;
  });

  const getRemainingHoursAndMinutes = (lot: Lot) => {
    if (lot.vipEarlyAccessUntil) {
      const target = new Date(lot.vipEarlyAccessUntil).getTime();
      const diffMs = Math.max(0, target - currentTime);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return { hours, minutes };
    }
    return { hours: lot.earlyAccessHoursLeft || 48, minutes: 0 };
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/5 via-emerald-500/5 to-transparent pointer-events-none blur-3xl" />

      {/* Hero Header */}
      <div className="relative border-b border-slate-200 bg-white/90 backdrop-blur-md pt-12 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 fill-current text-amber-600" />
              <span>DomExit VIP Investors Club • Закрытый пул</span>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <Link
                to="/opportunities"
                className="text-slate-500 hover:text-slate-900 font-medium transition-colors flex items-center space-x-1"
              >
                <span>Открытый каталог</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              {isVip && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  ✓ VIP-доступ активен
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
              Закрытый каталог инвестиционных лотов
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
              Эксклюзивные переуступки по 214-ФЗ с максимальным дисконтом (до -35% от официального прайса застройщика) за 48 часов до общего доступа.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
        {/* If user is NOT a VIP resident -> Institutional Gate Card */}
        {!isVip ? (
          <div className="max-w-4xl mx-auto my-8">
            <div className="relative rounded-3xl bg-gradient-to-b from-white via-amber-50/20 to-white border border-amber-200/90 p-8 sm:p-12 shadow-xl overflow-hidden text-center space-y-8">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />

              <div className="inline-flex p-4 rounded-2xl bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
                <Lock className="w-10 h-10" />
              </div>

              <div className="space-y-3 max-w-2xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Ограниченный институциональный доступ
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
                  Доступ к закрытому каталогу ограничен — Только для резидентов VIP-клуба DomExit
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed pt-2">
                  Здесь публикуются объекты с максимальным дисконтом за 48 часов до общего каталога. Для подключения ежемесячного доступа или верификации свяжитесь с нами в Telegram.
                </p>
              </div>

              {/* 4 Privilege Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Ранний доступ за 48 часов</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Первоочередное право выбора и бронирования объектов до их появления на открытом портале.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    <span>Дисконт до 35%</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Экономия до 4 500 000 ₽ по сравнению с официальными прайс-листами девелоперов Санкт-Петербурга и Москвы.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center space-x-2 text-sky-800 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <span>Чистый аудит 214-ФЗ</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Все лоты прошли 42 пункта юридической проверки: отсутствие арестов ФССП, чистая кредитная история и согласие застройщика.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Инвестиционный куратор</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Персональный инвестиционный советник, мгновенное бронирование без очередей и приоритетное одобрение в банках.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <a
                  href="https://t.me/domexit_ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>Оформить VIP-доступ через Telegram</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>

                <Link
                  to="/opportunities"
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Перейти в открытый каталог</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* If user IS a VIP resident -> VIP Opportunities Pool with Live Countdown */
          <div className="space-y-8">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-600">Локация:</span>
                <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedCity('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      selectedCity === 'all'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Все ({vipLots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCity('spb')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      selectedCity === 'spb'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Санкт-Петербург
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCity('msk')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      selectedCity === 'msk'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Москва
                  </button>
                </div>
              </div>

              <div className="text-xs text-amber-800 font-bold flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Все объекты забронированы на 48 часов эксклюзивно для вас</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 space-y-3">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Загрузка VIP-пула лотов...</p>
              </div>
            ) : filteredLots.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <Sparkles className="w-10 h-10 text-amber-500/70 mx-auto" />
                <h3 className="text-lg font-bold text-slate-900">Пул закрытых предложений временно исчерпан</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Новые лоты упаковываются юристами DomExit прямо сейчас. Вы получите push-уведомление в момент добавления.
                </p>
                <Link
                  to="/opportunities"
                  className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 font-bold hover:underline pt-2"
                >
                  <span>Посмотреть открытый каталог</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLots.map((lot) => {
                  const geo = resolveLotGeoDetails(lot);
                  const savingsRub = Math.max(0, lot.todayDeveloperPrice - lot.dduContractPrice);
                  const savingsPercent =
                    lot.todayDeveloperPrice > 0 ? (savingsRub / lot.todayDeveloperPrice) * 100 : 0;
                  const { hours, minutes } = getRemainingHoursAndMinutes(lot);
                  const metroName = geo.metroStations?.[0]?.name;

                  return (
                    <div
                      key={lot.id}
                      className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-amber-400 transition-all flex flex-col group relative"
                    >
                      {/* Image and Badges */}
                      <div className="h-56 relative overflow-hidden bg-slate-100">
                        <img
                          src={lot.imageUrl}
                          alt={lot.complexName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-amber-500 text-white font-black text-xs shadow-md">
                            <Sparkles className="w-3 h-3 fill-current" />
                            <span>VIP РАННИЙ ДОСТУП</span>
                          </span>

                          <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-900 font-mono text-[11px] font-bold border border-slate-200 shadow-xs">
                            #{lot.lotCode}
                          </span>
                        </div>

                        {/* Live Countdown Ribbon */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-amber-200 text-xs shadow-md">
                          <div className="flex items-center space-x-1.5 text-amber-800 font-mono font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span>
                              До открытого каталога: {hours} ч. {minutes} мин.
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                            48ч окно
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{lot.developer}</span>
                            <span>{lot.areaM2} м² • {lot.deliveryDate}</span>
                          </div>
                          <h3 className="font-bold text-lg text-slate-900 group-hover:text-amber-700 transition-colors">
                            {lot.complexName}
                          </h3>
                          <div className="text-xs text-slate-500 flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{metroName ? `м. ${metroName}` : lot.district}</span>
                          </div>
                        </div>

                        {/* Financial Truth Block */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Цена переуступки:</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {formatRubles(lot.dduContractPrice)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Кэш продавцу:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {formatRubles(lot.cashPaidBySeller)}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-700">
                              Дисконт: -{formatPercent(savingsPercent)}
                            </span>
                            <span className="font-mono font-black text-emerald-700 text-sm">
                              +{formatRubles(savingsRub)}
                            </span>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <Link
                          to={`/opportunities/${lot.lotCode}`}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center space-x-1.5"
                        >
                          <span>Забронировать по VIP-приоритету</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
