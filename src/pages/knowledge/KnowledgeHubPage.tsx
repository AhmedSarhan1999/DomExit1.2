import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Clock,
  ArrowRight,
  ShieldCheck,
  Scale,
  Building2,
  HelpCircle,
  TrendingUp,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { KnowledgeRepository } from '../../dal/repositories/KnowledgeRepository';
import { KnowledgeArticle, KnowledgeArticleCategory } from '../../types';

export const KnowledgeHubPage: React.FC = () => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await KnowledgeRepository.getAll();
        setArticles(data);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const categories = [
    { id: 'all', label: 'Все статьи' },
    { id: 'ddu', label: 'Рассрочки и 214-ФЗ' },
    { id: 'law140', label: '140-ФЗ и Залог' },
    { id: 'matkapital', label: 'Материнский капитал' },
    { id: 'mortgage', label: 'Семейная ипотека 6%' },
  ];

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCategory = selectedCategory === 'all' || art.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.excerpt.toLowerCase().includes(q) ||
        art.keywords.some((k) => k.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [articles, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/" className="hover:text-emerald-600">
            Главная
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">База знаний и правовой центр</span>
        </div>

        {/* Hero Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-50 pointer-events-none blur-3xl opacity-60" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5 text-emerald-600" />
              <span>Правовая экспертиза и защита дольщиков</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Центр правовых решений и судебной практики DomExit
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Исчерпывающие руководства по 214-ФЗ, 140-ФЗ, эскроу-счетам и материнскому капиталу. Разбираем реальные кейсы выхода из тяжелых рассрочек застройщиков без судебных неустоек.
            </p>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div>
                <span className="block text-2xl font-black text-emerald-700">100%</span>
                <span className="text-xs text-slate-500">Сохранение капитала при уступке</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-slate-900">4 мес.</span>
                <span className="text-xs text-slate-500">Мораторий на торги по 140-ФЗ</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-slate-900">6%</span>
                <span className="text-xs text-slate-500">Семейная ипотека на цессию</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-emerald-700">0 ₽</span>
                <span className="text-xs text-slate-500">Штрафов девелоперам</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по статьям, статьям закона (214-ФЗ, 140-ФЗ)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* Link to FAQ */}
            <Link
              to="/faq"
              className="inline-flex items-center space-x-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 transition-colors shrink-0"
            >
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Частые вопросы (FAQ)</span>
            </Link>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Загрузка экспертных материалов...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Материалы не найдены</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              По вашему запросу «{searchQuery}» статей не обнаружено. Попробуйте изменить ключевые слова или сбросить фильтры.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
            >
              Сбросить все фильтры
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Category & Read Time */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold group-hover:bg-emerald-50 group-hover:text-emerald-800 transition-colors">
                      {article.categoryLabel}
                    </span>
                    <span className="flex items-center space-x-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{article.readTimeMinutes} мин чтения</span>
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                    <Link to={`/knowledge/${article.slug}`}>{article.title}</Link>
                  </h2>

                  {/* Excerpt */}
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {article.excerpt}
                  </p>

                  {/* Legal Callouts Tags */}
                  {article.legalCallouts && article.legalCallouts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {article.legalCallouts.map((c, i) => (
                        <span
                          key={i}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200"
                        >
                          {c.lawCode}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer with Author and CTA */}
                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {article.authorAvatar && (
                      <img
                        src={article.authorAvatar}
                        alt={article.authorName}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">{article.authorName}</p>
                      <p className="text-[10px] text-slate-400">{article.authorRole}</p>
                    </div>
                  </div>

                  <Link
                    to={`/knowledge/${article.slug}`}
                    className="inline-flex items-center space-x-1 text-xs font-black text-emerald-700 group-hover:text-emerald-800 group-hover:translate-x-1 transition-all"
                  >
                    <span>Читать</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Inbound Conversion Banner */}
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              Персональная экспертиза лота
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Оказались в сложной ситуации с рассрочкой или ипотекой?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Не ждите начисления пеней и одностороннего расторжения ДДУ. Наши юристы проведут аудит вашего договора бесплатно за 24 часа и рассчитают точную сумму чистого выхода.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                to="/sellers"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition-all shadow-md flex items-center space-x-2"
              >
                <span>Рассчитать сумму выхода</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/faq"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm transition-all border border-slate-700"
              >
                Смотреть все вопросы (FAQ)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
