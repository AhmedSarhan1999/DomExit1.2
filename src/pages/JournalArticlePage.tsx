/**
 * JournalArticlePage.tsx — DomExit Journal Article View (/journal/:slug)
 *
 * Fast, SEO-ready single article presentation with:
 * - Dynamic SEO meta tags, OpenGraph and Schema.org Article JSON-LD.
 * - Breadcrumbs & estimated reading time.
 * - Verified Safe Markdown renderer (zero raw HTML injection).
 * - Dynamic conversion banners adapted to ctaTarget.
 * - Live related available lots & related articles.
 * - Support for ?preview=1 for owner draft review.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Calendar,
  ExternalLink,
  Send,
  Share2,
  ChevronRight,
  ShieldCheck,
  Building2,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { SafeMarkdownRenderer } from '../components/journal/SafeMarkdownRenderer';
import { LotThumbnail } from '../components/shared/LotThumbnail';
import { UnifiedNavbar } from '../components/layout/UnifiedNavbar';
import { UnifiedFooter } from '../components/layout/UnifiedFooter';

const CATEGORY_NAMES: Record<string, string> = {
  ddu_214fz: '214-ФЗ и ДДУ',
  mortgage_cbr: 'Ипотека и ставка ЦБ',
  tax_ndfl: 'Налоги и НДФЛ',
  matkapital: 'Материнский капитал',
  bankruptcy_127fz: 'Банкротство 127-ФЗ',
  court_practice: 'Судебная практика',
  rosreestr_egrn: 'Росреестр и ЕГРН',
  other: 'Недвижимость',
};

export const JournalArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreview = searchParams.get('preview') === '1';

  const [article, setArticle] = useState<any | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [featuredLots, setFeaturedLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.aiLab.getPublicJournalArticle(slug, isPreview);
        if (res.ok && res.article) {
          setArticle(res.article);
          setRelatedArticles(res.relatedArticles || []);
          setFeaturedLots(res.featuredLots || []);
        } else {
          setError('Статья не найдена или еще не опубликована');
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки статьи');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [slug, isPreview]);

  // Dynamic SEO & OpenGraph metadata
  useSeoMeta({
    title: article ? `${article.seoTitleRu || article.titleRu} | DomExit Журнал` : 'DomExit Журнал',
    description: article?.seoDescriptionRu || article?.subtitleRu || '',
    canonicalUrl: article ? `https://domexit.ru/journal/${article.slug}` : undefined,
    ogType: 'article',
    jsonLd: article
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.titleRu,
          description: article.subtitleRu || article.seoDescriptionRu,
          datePublished: article.publishedAt || article.createdAt,
          dateModified: article.updatedAt || article.publishedAt,
          author: {
            '@type': 'Organization',
            name: 'DomExit Эксперты',
            url: 'https://domexit.ru',
          },
          publisher: {
            '@type': 'Organization',
            name: 'DomExit',
            logo: {
              '@type': 'ImageObject',
              url: 'https://domexit.ru/logo-mark.svg',
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://domexit.ru/journal/${article.slug}`,
          },
        }
      : undefined,
  });

  const handleCopyShareLink = () => {
    if (!article) return;
    const shareUrl = `${window.location.origin}/api/public/journal/share/${article.slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <UnifiedNavbar />
        <main className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Загрузка статьи...</p>
        </main>
        <UnifiedFooter />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <UnifiedNavbar />
        <main className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{error || 'Статья не найдена'}</h2>
          <p className="text-xs text-slate-500 max-w-md mb-6">
            Возможно, ссылка устарела или материал еще находится на стадии проверки редактором.
          </p>
          <Link
            to="/journal"
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
          >
            ← Вернуться ко всем статьям
          </Link>
        </main>
        <UnifiedFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <UnifiedNavbar />

      <main className="flex-1 pb-20">
        {/* Owner Preview Banner */}
        {isPreview && (
          <div className="bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold text-center flex items-center justify-center space-x-2 shadow-xs">
            <Sparkles className="w-4 h-4" />
            <span>Режим предпросмотра владельца: статья ещё не опубликована для посетителей</span>
          </div>
        )}

        {/* Article Header Container */}
        <div className="bg-white border-b border-slate-200/80 pt-8 pb-10 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Breadcrumbs */}
            <nav className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
              <Link to="/" className="hover:text-slate-700 transition-colors">
                Главная
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/journal" className="hover:text-slate-700 transition-colors">
                Журнал
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-700 font-bold truncate max-w-[200px]">
                {CATEGORY_NAMES[article.category] || 'Статья'}
              </span>
            </nav>

            {/* Badges & Meta */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                {CATEGORY_NAMES[article.category] || 'Недвижимость'}
              </span>

              <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>~{article.readingTimeMin || 5} мин чтения</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleDateString('ru-RU')
                      : 'Черновик'}
                  </span>
                </span>
              </div>

              {article.humanEdited && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] flex items-center space-x-1 ml-auto">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Проверено экспертом</span>
                </span>
              )}
            </div>

            {/* Title (H1) */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {article.titleRu}
            </h1>

            {/* Subtitle / Lead Paragraph */}
            {article.subtitleRu && (
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                {article.subtitleRu}
              </p>
            )}

            {/* Social Share & Official Source Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                {article.sourceOriginalUrl && (
                  <a
                    href={article.sourceOriginalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-medium flex items-center space-x-1.5 transition-all"
                  >
                    <span>Официальный первоисточник</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Ссылка для Telegram скопирована!' : 'Поделиться в Telegram'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Article Body & Sidebar Grid */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
          {/* Main Article Content */}
          <article className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
            <SafeMarkdownRenderer content={article.markdownBodyRu} />
          </article>

          {/* Dynamic Conversion Banner adapted to ctaTarget */}
          <div className="rounded-2xl p-6 sm:p-8 text-white shadow-md bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900">
            {article.ctaTarget === 'sellers' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
                    Для дольщиков и инвесторов
                  </span>
                  <h3 className="text-xl font-extrabold tracking-tight">
                    Хотите выйти из ДДУ без комиссии (0%)?
                  </h3>
                  <p className="text-xs text-indigo-200 max-w-lg">
                    Продайте свою квартиру по переуступке через юридический аудит DomExit. Мы берем 0% комиссии с продавца и закрываем сделку через эскроу.
                  </p>
                </div>
                <Link
                  to="/sellers"
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  Оценить и разместить лот (0%) →
                </Link>
              </div>
            ) : article.ctaTarget === 'buybox' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
                    Для покупателей
                  </span>
                  <h3 className="text-xl font-extrabold tracking-tight">
                    Ищете квартиру по конкретным параметрам?
                  </h3>
                  <p className="text-xs text-indigo-200 max-w-lg">
                    Настройте персональный Buy-Box на платформе DomExit и получайте подходящие предложения по переуступкам первыми в Telegram.
                  </p>
                </div>
                <Link
                  to="/portal?tab=buybox"
                  className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  Настроить умный Buy-Box →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
                    Каталог предложений
                  </span>
                  <h3 className="text-xl font-extrabold tracking-tight">
                    Смотреть проверенные лоты ДДУ со скидкой
                  </h3>
                  <p className="text-xs text-indigo-200 max-w-lg">
                    Каждая квартира проверена юристами по 5 осям рисков 214-ФЗ. Скидка от цены застройщика подтверждена независимой оценкой AVM.
                  </p>
                </div>
                <Link
                  to="/opportunities"
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  Каталог проверенных лотов →
                </Link>
              </div>
            )}
          </div>

          {/* Section: Live Available Lots Related to Market */}
          {featuredLots.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Актуальные проверенные лоты ДДУ сейчас
                  </h3>
                  <p className="text-xs text-slate-500">
                    Квартиры по переуступке с пройденным юридическим аудитом
                  </p>
                </div>
                <Link
                  to="/opportunities"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <span>Все лоты</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {featuredLots.map((lot) => (
                  <Link
                    key={lot.id}
                    to={`/opportunities?lot=${lot.lotCode || lot.id}`}
                    className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                  >
                    <div className="h-32 bg-slate-100 overflow-hidden relative">
                      <LotThumbnail
                        src={lot.primaryPhotoUrl}
                        alt={lot.complexName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {lot.discountPercent > 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-rose-500 text-white font-bold text-[10px] rounded-md shadow-xs">
                          -{lot.discountPercent}% от застройщика
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 space-y-1 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {lot.complexName}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {lot.rooms === 0 ? 'Студия' : `${lot.rooms}-комн.`} • {lot.areaSqm} м²
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-sm font-extrabold text-slate-900 font-mono">
                          {lot.priceRub ? Number(lot.priceRub).toLocaleString('ru-RU') + ' ₽' : '—'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Section: Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Читайте также по этой теме</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedArticles.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/journal/${rel.slug}`}
                    className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all space-y-2 group"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        {CATEGORY_NAMES[rel.category] || 'Статья'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                        {rel.titleRu}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{rel.readingTimeMin || 5} мин</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <UnifiedFooter />
    </div>
  );
};

export default JournalArticlePage;
