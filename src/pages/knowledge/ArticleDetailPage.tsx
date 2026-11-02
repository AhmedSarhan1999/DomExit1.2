import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
  Calculator,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Building2,
  Lock,
} from 'lucide-react';
import { KnowledgeRepository } from '../../dal/repositories/KnowledgeRepository';
import { KnowledgeArticle } from '../../types';
import { JsonLdStructuredData } from '../../components/seo/JsonLdStructuredData';

export const ArticleDetailPage: React.FC = () => {
  const { articleSlug } = useParams<{ articleSlug: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<KnowledgeArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // In-article mini calculator form state
  const [calcPaidAmount, setCalcPaidAmount] = useState<string>('3500000');
  const [calcComplex, setCalcComplex] = useState<string>('');
  const [calcType, setCalcType] = useState<string>('installment_ddu');

  useEffect(() => {
    const load = async () => {
      if (!articleSlug) return;
      setIsLoading(true);
      try {
        const found = await KnowledgeRepository.getBySlug(articleSlug);
        setArticle(found);
        if (found) {
          const all = await KnowledgeRepository.getAll();
          setRelatedArticles(all.filter((a) => a.slug !== articleSlug).slice(0, 3));
          if (found.category === 'law140') {
            setCalcType('mortgage_pledge');
          } else if (found.category === 'matkapital') {
            setCalcType('matkapital');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [articleSlug]);

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // ignore
    }
  };

  const handleCalculatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = calcPaidAmount.replace(/\D/g, '');
    const params = new URLSearchParams();
    if (cleanAmount) params.set('paidAmount', cleanAmount);
    if (calcComplex.trim()) params.set('complex', calcComplex.trim());
    if (calcType) params.set('dealType', calcType);
    params.set('utm_source', 'knowledge_article');
    params.set('utm_medium', articleSlug || 'article');
    navigate(`/sellers?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Загрузка экспертного материала...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-lg text-center space-y-4 shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Статья не найдена</h2>
          <p className="text-sm text-slate-500">
            Запрашиваемый материал был перемещен или удален из базы знаний.
          </p>
          <Link
            to="/knowledge"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться в базу знаний</span>
          </Link>
        </div>
      </div>
    );
  }

  // Schema.org Article Structured Data
  const schemaArticleData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.canonicalUrl || `https://domexit.ru/knowledge/${article.slug}`,
    },
    author: {
      '@type': 'Person',
      name: article.authorName,
      jobTitle: article.authorRole,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DomExit — Чистый Выход',
      logo: {
        '@type': 'ImageObject',
        url: 'https://domexit.ru/logo.png',
      },
    },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    keywords: article.keywords.join(', '),
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 pt-8">
      {/* Schema.org Structured Data */}
      <JsonLdStructuredData id={`schema-article-${article.slug}`} data={schemaArticleData} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/" className="hover:text-emerald-600">
            Главная
          </Link>
          <span>/</span>
          <Link to="/knowledge" className="hover:text-emerald-600">
            База знаний
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold truncate max-w-xs">{article.title}</span>
        </div>

        {/* Article Header Card */}
        <header className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              {article.categoryLabel}
            </span>

            <div className="flex items-center space-x-4 text-xs text-slate-500">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{article.readTimeMinutes} мин чтения</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {new Date(article.publishedAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </span>
              <button
                onClick={handleShare}
                className="flex items-center space-x-1 hover:text-emerald-700 transition-colors font-bold"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Ссылка скопирована!' : 'Поделиться'}</span>
              </button>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 leading-tight">
            {article.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed border-l-4 border-emerald-500 pl-4 bg-emerald-50/30 py-2 rounded-r-xl">
            {article.excerpt}
          </p>

          {/* Author Block */}
          <div className="flex items-center space-x-4 pt-4 border-t border-slate-100">
            {article.authorAvatar && (
              <img
                src={article.authorAvatar}
                alt={article.authorName}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/20"
              />
            )}
            <div>
              <p className="text-sm font-bold text-slate-900">{article.authorName}</p>
              <p className="text-xs text-slate-500">{article.authorRole}</p>
            </div>
          </div>
        </header>

        {/* Legal Callouts Bar */}
        {article.legalCallouts && article.legalCallouts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {article.legalCallouts.map((callout, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border text-xs space-y-1.5 shadow-xs ${
                  callout.badgeType === 'danger'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : callout.badgeType === 'warning'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center space-x-2 font-black">
                  <Scale className="w-4 h-4 shrink-0" />
                  <span>{callout.lawCode}</span>
                </div>
                <div className="font-bold text-slate-900">{callout.title}</div>
                <div className="text-slate-600 leading-normal">{callout.description}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Article Content */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs prose prose-slate max-w-none">
              <div
                className="text-slate-700 leading-relaxed text-sm sm:text-base space-y-6"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </div>

            {/* In-Article Conversion Mini-Calculator CTA */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 border border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Калькулятор чистого выхода из объекта
                  </h3>
                  <p className="text-xs text-slate-400">
                    Рассчитайте сумму возврата капитала без штрафов застройщика
                  </p>
                </div>
              </div>

              <form onSubmit={handleCalculatorSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Фактически внесено застройщику (₽)
                    </label>
                    <input
                      type="text"
                      value={calcPaidAmount}
                      onChange={(e) => setCalcPaidAmount(e.target.value)}
                      placeholder="Например: 3 500 000"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Жилой комплекс или застройщик
                    </label>
                    <input
                      type="text"
                      value={calcComplex}
                      onChange={(e) => setCalcComplex(e.target.value)}
                      placeholder="Например: ЖК Чистое Небо / Setl Group"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Тип сделки и обременения
                  </label>
                  <select
                    value={calcType}
                    onChange={(e) => setCalcType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="installment_ddu">Беспроцентная рассрочка застройщика (214-ФЗ)</option>
                    <option value="mortgage_pledge">Ипотека в банке / продажа по 140-ФЗ</option>
                    <option value="matkapital">Использован материнский капитал</option>
                    <option value="family_mortgage_replacement">Переуступка по Семейной ипотеке 6%</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center space-x-2"
                >
                  <span>Получить юридический расчет и предложение выкупа</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="flex items-center space-x-2 text-[11px] text-slate-400 border-t border-slate-800 pt-3">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Конфиденциально. Экспресс-оценка в течение 24 часов в строгом соответствии с 152-ФЗ.
                </span>
              </div>
            </div>
          </div>

          {/* Sticky Sidebar: Table of Contents & FAQ Link */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            {/* Table of Contents */}
            {article.tableOfContents && article.tableOfContents.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Содержание статьи</span>
                </h3>
                <nav className="space-y-2 text-xs">
                  {article.tableOfContents.map((toc) => (
                    <a
                      key={toc.id}
                      href={`#${toc.id}`}
                      className="block text-slate-600 hover:text-emerald-700 hover:font-bold transition-colors py-1 border-b border-slate-100 last:border-b-0"
                    >
                      {toc.title}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* Quick Consultation Badge */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Остались вопросы по статье?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ознакомьтесь с ответами юристов на 13 ключевых вопросов в нашем расширенном реестре FAQ.
              </p>
              <Link
                to="/faq"
                className="inline-flex items-center space-x-1 text-xs font-black text-emerald-800 hover:text-emerald-900"
              >
                <span>Перейти в реестр FAQ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Related Articles Section */}
        {relatedArticles.length > 0 && (
          <div className="pt-10 border-t border-slate-200 space-y-6">
            <h3 className="text-xl font-black text-slate-900">Связанные экспертные разборы</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.map((rel) => (
                <div
                  key={rel.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {rel.categoryLabel}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2 hover:text-emerald-700">
                      <Link to={`/knowledge/${rel.slug}`}>{rel.title}</Link>
                    </h4>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{rel.readTimeMinutes} мин</span>
                    <Link
                      to={`/knowledge/${rel.slug}`}
                      className="text-emerald-700 font-bold hover:text-emerald-800"
                    >
                      Читать &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
