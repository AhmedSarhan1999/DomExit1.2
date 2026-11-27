/**
 * JournalListPage.tsx — DomExit Journal (/journal)
 * Fast, SEO-optimized public magazine list page for assignment and DDU market insights.
 *
 * Gated by AI Lab feature flag 'publicJournalSeo' (owner-only until released to public).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Clock,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Loader2,
  Tag,
  Lock,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { useAiFeatureFlags } from '../hooks/useAiFeatureFlags';
import { UnifiedNavbar } from '../components/layout/UnifiedNavbar';
import { UnifiedFooter } from '../components/layout/UnifiedFooter';

const CATEGORY_NAMES: Record<string, string> = {
  all: 'Все темы',
  ddu_214fz: '214-ФЗ и ДДУ',
  mortgage_cbr: 'Ипотека и ставка ЦБ',
  tax_ndfl: 'Налоги и НДФЛ',
  matkapital: 'Материнский капитал',
  bankruptcy_127fz: 'Банкротство 127-ФЗ',
  court_practice: 'Судебная практика',
  rosreestr_egrn: 'Росреестр и ЕГРН',
};

export const JournalListPage: React.FC = () => {
  const { isFeatureEnabled, loading: flagsLoading } = useAiFeatureFlags();
  const isJournalAllowed = isFeatureEnabled('publicJournalSeo');

  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useSeoMeta({
    title: 'DomExit Журнал — Переуступка ДДУ, законы 214-ФЗ, ипотека и налоги',
    description:
      'Экспертный журнал платформы DomExit: разбор законов 214-ФЗ, безопасная переуступка прав, налоги при продаже ДДУ, ключевая ставка ЦБ и судебная практика в СПб и Москве.',
    canonicalUrl: 'https://domexit.ru/journal',
    ogType: 'website',
  });

  const loadArticles = useCallback(
    async (reset = true) => {
      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const params: any = { limit: 12 };
        if (selectedCategory !== 'all') params.category = selectedCategory;
        if (!reset && nextCursor) params.cursor = nextCursor;

        const res = await apiClient.aiLab.getPublicJournalArticles(params);
        if (res.ok) {
          if (reset) {
            setArticles(res.items || []);
          } else {
            setArticles((prev) => [...prev, ...(res.items || [])]);
          }
          setNextCursor(res.nextCursor || null);
          setHasMore(Boolean(res.hasMore));
        }
      } catch (err) {
        console.warn('Failed loading journal articles:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, nextCursor]
  );

  useEffect(() => {
    if (isJournalAllowed) {
      loadArticles(true);
    }
  }, [selectedCategory, isJournalAllowed]);

  // Client-side quick search filter
  const filteredArticles = articles.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.titleRu || '').toLowerCase().includes(q) ||
      (a.subtitleRu || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <UnifiedNavbar />

      <main className="flex-1 pb-16">
        {/* Hero Header */}
        <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white pt-12 pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto space-y-4 text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>DomExit Журнал</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Всё о переуступках ДДУ, законах и налогах
            </h1>
            <p className="text-slate-300 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Практические разборы 214-ФЗ, налоговых изменений НДФЛ, решений Верховного Суда и ипотечных программ для безопасных сделок в СПб и Москве.
            </p>

            {/* Quick Search */}
            <div className="max-w-md mx-auto pt-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по темам, законам или статьям..."
                  className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Access Gate: Owner only mode notice */}
        {!flagsLoading && !isJournalAllowed ? (
          <div className="max-w-xl mx-auto my-16 p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Журнал готовится к открытию</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              В данный момент раздел «DomExit Журнал» наполняется экспертными материалами. Доступ открыт для владельца платформы через AI Лабораторию.
            </p>
            <Link
              to="/opportunities"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
            >
              <span>Смотреть доступные лоты ДДУ</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6">
            {/* Category Filter Pills */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200/80 mb-8 flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
              {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === key
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Articles Grid */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-xs">Загрузка статей DomExit Журнала...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">Статей в выбранной теме пока нет</h4>
                <p className="text-xs text-slate-400">Попробуйте выбрать другую категорию или сбросить поиск.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredArticles.map((article) => (
                  <Link
                    key={article.id}
                    to={`/journal/${article.slug}`}
                    className="group bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          {CATEGORY_NAMES[article.category] || 'Недвижимость'}
                        </span>
                        <div className="flex items-center space-x-2 text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{article.readingTimeMin || 5} мин</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {article.publishedAt
                                ? new Date(article.publishedAt).toLocaleDateString('ru-RU')
                                : '—'}
                            </span>
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                        {article.titleRu}
                      </h3>

                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                        {article.subtitleRu}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1 text-slate-400">
                        {article.humanEdited && (
                          <span className="flex items-center space-x-1 text-emerald-600 font-bold text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Эксперт DomExit</span>
                          </span>
                        )}
                      </div>
                      <span className="text-indigo-600 font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                        <span>Читать статью</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => loadArticles(false)}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center space-x-2 mx-auto cursor-pointer"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Загрузить ещё статьи</span>
                </button>
              </div>
            )}

            {/* Conversion Bottom Banner */}
            <div className="mt-12 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="inline-flex items-center space-x-1 text-amber-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Умный поиск переуступок</span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight">
                  Ищете проверенную квартиру по переуступке?
                </h3>
                <p className="text-xs text-indigo-200 max-w-lg">
                  Каждый лот на DomExit проходит тройной юридический аудит 214-ФЗ и расчет справедливой рыночной цены.
                </p>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <Link
                  to="/opportunities"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  Каталог лотов со скидкой
                </Link>
                <Link
                  to="/sellers"
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/20"
                >
                  Продать свой ДДУ (0%)
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <UnifiedFooter />
    </div>
  );
};

export default JournalListPage;
