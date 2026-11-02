import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Scale,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Building2,
  PhoneCall,
  CheckCircle2,
} from 'lucide-react';
import { FAQRepository } from '../../dal/repositories/FAQRepository';
import { FaqItem, FaqCategory } from '../../types';
import { JsonLdStructuredData } from '../../components/seo/JsonLdStructuredData';

export const FAQPage: React.FC = () => {
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'faq-ddu-1': true,
    'faq-law140-1': true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await FAQRepository.getAll();
        setFaqItems(data);
      } finally {
        setIsLoading(false);
      }
    };
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const categories = [
    { id: 'all', label: 'Все вопросы' },
    { id: 'installments_ddu', label: 'Рассрочки и 214-ФЗ' },
    { id: 'mortgage_banks', label: 'Ипотека и эскроу' },
    { id: 'law140_pledge', label: '140-ФЗ и Залог' },
    { id: 'matkapital_escrow', label: 'Материнский капитал' },
  ];

  const filteredItems = useMemo(() => {
    return faqItems.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.lawReferences?.some((law) => law.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [faqItems, selectedCategory, searchQuery]);

  const toggleItem = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    filteredItems.forEach((i) => {
      allExpanded[i.id] = true;
    });
    setExpandedIds(allExpanded);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  // Schema.org FAQPage Structured Data
  const schemaFaqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 pt-8">
      {/* Schema.org JSON-LD Structured Data */}
      <JsonLdStructuredData id="schema-faq-page" data={schemaFaqData} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/" className="hover:text-emerald-600">
            Главная
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">Часто задаваемые вопросы (FAQ)</span>
        </div>

        {/* Hero Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-xs space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>База ответов юристов DomExit</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Часто задаваемые вопросы и правовые разъяснения
          </h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
            Ответы на ключевые вопросы о регламенте переуступки по 214-ФЗ, самостоятельной продаже залога по 140-ФЗ, возврате средств материнского капитала в СФР и сохранении ставки Семейной ипотеки 6%.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs font-bold">
            <Link
              to="/knowledge"
              className="inline-flex items-center space-x-1.5 text-emerald-700 hover:text-emerald-800"
            >
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Перейти к развернутым аналитическим статьям &rarr;</span>
            </Link>
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
                placeholder="Поиск по вопросам, законам (214-ФЗ, 140-ФЗ, эскроу)..."
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

            {/* Expand / Collapse Controls */}
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
              <button
                onClick={expandAll}
                className="hover:text-emerald-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
              >
                Развернуть все
              </button>
              <span>•</span>
              <button
                onClick={collapseAll}
                className="hover:text-slate-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
              >
                Свернуть все
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
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

        {/* Questions Accordion List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Загрузка вопросов...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Вопросов не найдено</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              По вашему запросу «{searchQuery}» совпадений не обнаружено.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isExpanded = !!expandedIds[item.id];
              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {item.categoryLabel}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {item.question}
                      </h3>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-500 shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-100 space-y-4 bg-slate-50/30">
                      <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                        {item.answer}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 text-xs">
                        {/* Legal References */}
                        {item.lawReferences && item.lawReferences.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-400 font-semibold">Нормы права:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.lawReferences.map((law, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px]"
                                >
                                  {law}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Link to Full In-Depth Article */}
                        {item.relatedArticleSlug && (
                          <Link
                            to={`/knowledge/${item.relatedArticleSlug}`}
                            className="inline-flex items-center space-x-1 font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            <span>Подробный правовой разбор</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Final CTA Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-xl font-black text-slate-900">
              Не нашли ответ на свой вопрос?
            </h3>
            <p className="text-sm text-slate-500 max-w-lg">
              Направьте ваш договор на экспресс-аудит. Юристы DomExit бесплатно проанализируют риски за 24 часа.
            </p>
          </div>
          <Link
            to="/sellers"
            className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-md shrink-0 flex items-center space-x-2"
          >
            <span>Отправить договор на аудит</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
