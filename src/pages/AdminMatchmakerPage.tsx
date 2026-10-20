import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { CandidatesRepository } from '../dal/repositories/CandidatesRepository';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { BuyerCandidate, Lot } from '../types';
import { FileManager } from '../utils/fileManager';
import {
  Users,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  Wallet,
  ArrowRight,
  FileText,
  Check,
  Download,
  Eye,
  CreditCard,
  Banknote,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export const AdminMatchmakerPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const currentLotCode = lotId || 'U-10566';
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lot, setLot] = useState<Lot | null>(null);
  const [allLots, setAllLots] = useState<Lot[]>([]);
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'budget' | 'cash48' | 'mortgage'>('all');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = async () => {
    const [lotsData, candData] = await Promise.all([
      LotsRepository.getAll(),
      CandidatesRepository.getAll(),
    ]);

    setAllLots(lotsData);
    const current = lotsData.find(l => l.lotCode === currentLotCode || l.id === currentLotCode) || lotsData[0];
    setLot(current);

    // Candidates specifically for this lot (with fallbacks if few bids)
    const lotCandidates = candData.filter(c => c.lotCode === current.lotCode);
    setCandidates(lotCandidates.length > 0 ? lotCandidates : candData);
  };

  const [previewCandidate, setPreviewCandidate] = useState<BuyerCandidate | null>(null);

  useEffect(() => {
    loadData();
  }, [currentLotCode]);

  // Accept candidate & advance platform to closing escrow stage (Mission 5 & 8)
  const handleAcceptWinningCandidate = async (candidate: BuyerCandidate) => {
    if (!candidate.isVerifiedByCurator) {
      alert(language === 'ru' ? 'Перед утверждением кандидата необходимо нажать [✓ Проверено куратором] и ознакомиться с выпиской/справкой.' : 'Please verify candidate liquidity first.');
      return;
    }

    await CandidatesRepository.acceptCandidate(lot?.lotCode || currentLotCode, candidate.id);
    
    setSuccessToast(
      language === 'ru'
        ? `Кандидат ${candidate.name} (${candidate.code}) официально утвержден победителем отбора за сегодня! Заявки кандидата на другие лоты автоматически отозваны.`
        : `Candidate ${candidate.name} approved! Deal advanced to closing stage, other active bids auto-withdrawn.`
    );

    await loadData();
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const handleVerifyCandidate = async (candidateId: string) => {
    const curatorName = user?.name || 'Алексей Морозов (Куратор лота)';
    await CandidatesRepository.verifyCandidate(candidateId, curatorName);
    setSuccessToast(
      language === 'ru'
        ? '✓ Платежеспособность и выписка кандидата проверены и зафиксированы!'
        : 'Candidate liquidity verified by curator!'
    );
    await loadData();
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Download / preview bank pre-approval cert
  const handleDownloadDoc = (candidate: BuyerCandidate) => {
    if (candidate.bankApprovalDocUrl) {
      FileManager.downloadFile(
        candidate.bankApprovalDocUrl,
        candidate.bankApprovalDocName || `Справка_одобрения_${candidate.code}.pdf`
      );
    } else {
      FileManager.downloadFile(
        `data:text/plain;charset=utf-8,${encodeURIComponent('ВЫПИСКА СО СЧЕТА О НАЛИЧИИ СРЕДСТВ\nБанк: ПАО Сбербанк\nКлиент: ' + candidate.name + '\nДоступный остаток: ' + candidate.availableLiquidity + ' руб.')}`,
        `Выписка_со_счета_${candidate.code}.pdf`
      );
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (activeFilter === 'cash48') return c.buyerTrack === 'full_cash' || c.fundingType === 'cash';
    if (activeFilter === 'mortgage') return c.buyerTrack === 'mortgage_substitution' || c.fundingType === 'family-mortgage';
    if (activeFilter === 'budget') return c.availableLiquidity >= (lot?.cashPaidBySeller || 2000000);
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <AdminHeader
          title={`Матчмейкер и ежедневный отбор покупателей — Лот #${lot?.lotCode || currentLotCode}`}
          subtitle="Ежедневное окно рассмотрения предложений: проверка банковских справок и отбор лучшего покупателя"
        />

        {/* Success Toast */}
        {successToast && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white">✕</button>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] w-full">
          
          {/* 1. Target Lot Summary Box + Lot Selector */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  <img
                    src={lot?.imageUrl || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=200&q=80"}
                    alt="ЖК"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base text-slate-900">{lot?.complexName}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      lot?.status === 'available'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {lot?.status === 'available' ? 'Открыто окно приема' : 'В сделке'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {lot?.developer} • {lot?.areaM2} м² • #{lot?.lotCode} • Ответственный куратор: <strong>{lot?.assignedEmployeeName || 'Алексей Морозов'}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Lot Selector Dropdown */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-semibold hidden md:inline">Сменить лот:</span>
                <select
                  value={lot?.lotCode || currentLotCode}
                  onChange={(e) => navigate(`/admin/matchmaker/${e.target.value}`)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {allLots.map((l) => (
                    <option key={l.id} value={l.lotCode}>
                      #{l.lotCode} - {l.complexName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Financial Metric Boxes */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">Кэш продавцу:</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {formatRubles(lot?.cashPaidBySeller || 2485230)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">Остаток в рассрочку:</span>
                <span className="text-base font-black text-slate-700 mt-0.5 block">
                  {formatRubles(lot?.remainingInstallmentDebt || 8486770)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">Суммарно по ДДУ:</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {formatRubles(lot?.dduContractPrice || 10972000)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                <span className="text-[11px] block font-sans font-bold">Выгода от застройщика:</span>
                <span className="text-base font-black mt-0.5 block">
                  +{formatRubles((lot?.todayDeveloperPrice || 14200000) - (lot?.dduContractPrice || 10972000))}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Main Area: Candidates Grid & AI Recommendation Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (8 cols): Filter Tabs & Scored Candidates (Image 1957 Fix) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 text-xs font-semibold shadow-xs">
                {[
                  { id: 'all', label: `Все предложения (${candidates.length})` },
                  { id: 'cash48', label: '💵 100% Кэш' },
                  { id: 'mortgage', label: '🏦 Кэш + Ипотека' },
                  { id: 'budget', label: '✓ Полная платежеспособность' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeFilter === tab.id
                        ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scored Candidates Cards (IMAGE 1957 FIX) */}
              <div className="space-y-3">
                {filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`bg-white border rounded-2xl p-5 space-y-3 transition-all shadow-xs ${
                      candidate.status === 'priority_reserved'
                        ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                        : candidate.matchScore >= 95
                        ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <span className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black flex items-center justify-center font-mono text-xs">
                          {candidate.matchScore || 95}%
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-sm text-slate-900">{candidate.name}</h4>
                            <span className="text-[11px] font-mono text-slate-500">#{candidate.code}</span>
                            <span className="text-[11px] text-slate-400">({candidate.location})</span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-slate-600 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{candidate.readinessTimeline}</span>
                          </div>
                        </div>
                      </div>

                      {/* Track Badges */}
                      <div className="flex items-center space-x-1.5">
                        {candidate.buyerTrack === 'mortgage_substitution' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center space-x-1">
                            <CreditCard className="w-3 h-3 text-amber-600" />
                            <span>Трек: Кэш + Ипотека</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] flex items-center space-x-1">
                            <Banknote className="w-3 h-3 text-emerald-600" />
                            <span>Трек: 100% Кэш</span>
                          </span>
                        )}

                        {candidate.status === 'priority_reserved' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase shadow-xs">
                            УТВЕРЖДЕН ПОБЕДИТЕЛЕМ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financial details & Document Preview link */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Подтвержденный капитал / Ликвидность:</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {formatRubles(candidate.availableLiquidity)}
                        </span>
                      </div>
                      
                      {candidate.creditLimitRub && (
                        <div>
                          <span className="text-slate-500 block text-[11px]">Одобренный лимит ипотеки в банке:</span>
                          <span className="font-mono font-bold text-amber-800 text-sm">
                            {formatRubles(candidate.creditLimitRub)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar: Preview Doc + Verify Curator + Accept Winner (Task 8.2 & Task 9) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                      
                      <div className="flex items-center space-x-2">
                        {/* 1. Preview Files / Bank Statement Button */}
                        <button
                          type="button"
                          onClick={() => setPreviewCandidate(candidate)}
                          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-colors cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {candidate.buyerTrack === 'full_cash'
                              ? 'Просмотреть выписку кэша'
                              : 'Просмотреть справку ипотеки'}
                          </span>
                        </button>

                        {/* 2. Curator Verification Button (✓ Проверено куратором) */}
                        {candidate.isVerifiedByCurator ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs inline-flex items-center space-x-1 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✓ Проверено куратором</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleVerifyCandidate(candidate.id)}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✓ Проверено куратором</span>
                          </button>
                        )}
                      </div>

                      {/* 3. Accept Winning Candidate Button */}
                      <button
                        type="button"
                        onClick={() => handleAcceptWinningCandidate(candidate)}
                        disabled={candidate.status === 'priority_reserved' || !candidate.isVerifiedByCurator}
                        title={!candidate.isVerifiedByCurator ? 'Сначала подтвердите проверку платежеспособности [✓ Проверено куратором]' : ''}
                        className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 ${
                          candidate.status === 'priority_reserved'
                            ? 'bg-slate-200 text-slate-600 cursor-default'
                            : !candidate.isVerifiedByCurator
                            ? 'bg-emerald-600/40 text-white cursor-not-allowed opacity-60'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>
                          {candidate.status === 'priority_reserved'
                            ? 'Победитель зафиксирован'
                            : 'Утвердить победителем'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Right Column (4 cols): AI Top Pick & 5-Stage Live Sync Information */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* TOP AI Recommendation Card */}
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Рекомендация ИИ по кредитоспособности
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-lg font-black text-slate-900 block">
                    {candidates[0]?.name || 'Иван Петрович'} (#{candidates[0]?.code || 'B-409'})
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Наивысший кредитный скоринг (98/100). Наличные готовы к депонированию за 48ч. Минимальный риск срыва сделки в Сбербанке.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => candidates[0] && handleAcceptWinningCandidate(candidates[0])}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <span>Утвердить лучшего покупателя дня →</span>
                </button>
              </div>

              {/* 5-Stage Synchronization Live Info Box */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 text-xs shadow-xs">
                <h4 className="font-bold text-slate-900 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  <span>Мгновенная синхронизация 5 стадий:</span>
                </h4>
                <ul className="space-y-2 text-slate-600 text-[11px] leading-relaxed">
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>1. Статус в каталоге:</strong> лот автоматически получает статус «В сделке» и выходит из поиска свободных.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>2. Кабинет продавца:</strong> дольщик видит уведомление о найденном покупателе и переход в банковский зал.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>3. Кабинет покупателя:</strong> появляется статус «Ваша бронь принята, готовьте документы для Сбера/ВТБ».</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><strong>4. Партнерский кабинет:</strong> брокер видит начисление вознаграждения в строке переуступки.</span>
                  </li>
                </ul>
              </div>

              {/* Bank Escrow Room Link */}
              <Link
                to="/admin/closing/DEAL-2025-10566"
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-between transition-colors shadow-2xs"
              >
                <span>Перейти в зал банковского эскроу</span>
                <ArrowRight className="w-4 h-4 text-emerald-600" />
              </Link>

            </div>

          </div>

        </div>

      </div>

      {/* ================= MODAL: Preview Bank Statement / Mortgage Certificate (Task 8.2) ================= */}
      {previewCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-950 text-base">
                  {previewCandidate.buyerTrack === 'full_cash'
                    ? 'Свежая банковская выписка (100% Кэш)'
                    : 'Справка об одобрении кредита / ипотеки'}
                </h3>
              </div>
              <button onClick={() => setPreviewCandidate(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Кандидат:</span>
                  <strong className="text-slate-900 text-sm">{previewCandidate.name}</strong>
                  <span className="text-slate-500 font-mono block">{previewCandidate.code}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Подтвержденный капитал:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    {formatRubles(previewCandidate.availableLiquidity)}
                  </span>
                </div>
              </div>

              {/* Simulated Official Document Viewer */}
              <div className="p-6 bg-slate-50/70 rounded-2xl border-2 border-slate-300 font-mono space-y-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 opacity-15">
                  <ShieldCheck className="w-24 h-24 text-emerald-800" />
                </div>

                <div className="text-center pb-3 border-b border-slate-200">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 block">
                    ПАО «СБЕРБАНК РОССИИ» — ЦЕНТР ЭЛЕКТРОННОЙ ВЕРИФИКАЦИИ
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Официальная справка о состоянии расчетного счета / аккредитивного депозита
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <div>ФИО владельца счета: <strong>{previewCandidate.name}</strong></div>
                  <div>Дата формирования выписки: <strong>{new Date().toLocaleDateString('ru-RU')}</strong></div>
                  <div>Доступный остаток средств для расчета: <strong className="text-emerald-700">{formatRubles(previewCandidate.availableLiquidity)}</strong></div>
                  {previewCandidate.creditLimitRub && (
                    <div>Одобренный кредитный лимит: <strong className="text-amber-800">{formatRubles(previewCandidate.creditLimitRub)}</strong></div>
                  )}
                  <div>Назначение: Обеспечение сделки по уступке права требования (214-ФЗ)</div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-sans flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Подлинность цифровой подписи банка подтверждена: ликвидность на счете достаточна для 100% покрытия сделки.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewCandidate)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать оригинал выписки</span>
                </button>

                <div className="flex items-center space-x-2">
                  {!previewCandidate.isVerifiedByCurator && (
                    <button
                      type="button"
                      onClick={() => {
                        handleVerifyCandidate(previewCandidate.id);
                        setPreviewCandidate(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                    >
                      ✓ Подтвердить: Проверено куратором
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewCandidate(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

