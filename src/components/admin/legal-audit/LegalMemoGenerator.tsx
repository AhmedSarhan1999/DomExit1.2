import React, { useState, useEffect } from 'react';
import { Copy, Sparkles, RotateCcw } from 'lucide-react';
import { Lot } from '../../../types';
import { formatRubles } from '../../../utils/formatters';

interface LegalMemoGeneratorProps {
  lot: Lot;
  aiProtectionMemo?: string;
  aiPenaltyPercent?: number;
}

export const LegalMemoGenerator: React.FC<LegalMemoGeneratorProps> = ({
  lot,
  aiProtectionMemo,
  aiPenaltyPercent,
}) => {
  const [includePlenum63, setIncludePlenum63] = useState<boolean>(true);
  const [penaltyPercent, setPenaltyPercent] = useState<number>(15);
  const [customMemoText, setCustomMemoText] = useState<string>('');
  const [memoCopied, setMemoCopied] = useState<boolean>(false);

  useEffect(() => {
    if (aiPenaltyPercent !== undefined && aiPenaltyPercent > 0) {
      setPenaltyPercent(aiPenaltyPercent);
    }
  }, [aiPenaltyPercent]);

  const getDefaultMemoText = () => {
    const cashStr = formatRubles(lot?.cashPaidBySeller || 0);
    const dduStr = formatRubles(lot?.dduContractPrice || 0);
    const dduNum = lot?.ownerDossier?.dduNumber || `№ ДДУ-${lot?.lotCode || '—'}`;
    const devName = lot?.developer || 'Застройщик';
    const penaltyAmount = Math.round((lot?.dduContractPrice || 0) * (penaltyPercent / 100));
    const penaltyStr = formatRubles(penaltyAmount);

    let text = `Цена уступки (компенсация Цеденту) в размере ${cashStr} при полной стоимости объекта по договору ${dduNum} — ${dduStr} строго соответствует сумме фактически внесенных Цедентом денежных средств.\n\n`;
    text += `Стороны констатируют, что установление данной цены экономически обусловлено предотвращением финансовых убытков Цедента в виде контрактного штрафа Застройщика (${devName}) в размере ${penaltyPercent}% от цены ДДУ (${penaltyStr}) при одностороннем отказе от договора. В силу ст. 302 ГК РФ и ст. 61.2 ФЗ-127 Покупатель признается добросовестным приобретателем, действовавшим в стандартных условиях делового оборота без цели причинения вреда кредиторам.`;

    if (includePlenum63) {
      text += `\n\nПрименена правовая позиция Постановления Пленума ВАС РФ № 63: «Экономическая целесообразность предотвращения штрафных санкций подтверждена документально».`;
    }
    return text;
  };

  const currentText = customMemoText || getDefaultMemoText();

  const handleCopyMemo = () => {
    navigator.clipboard?.writeText(currentText);
    setMemoCopied(true);
    setTimeout(() => setMemoCopied(false), 2500);
  };

  const handleApplyAiMemo = () => {
    if (aiProtectionMemo) {
      setCustomMemoText(aiProtectionMemo);
    }
    if (aiPenaltyPercent !== undefined && aiPenaltyPercent > 0) {
      setPenaltyPercent(aiPenaltyPercent);
    }
  };

  const handleResetToStandard = () => {
    setCustomMemoText('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <h3 className="text-base font-bold text-slate-900">
            Генератор правового обоснования цены добросовестного приобретателя
          </h3>
          <span className="text-xs text-emerald-700">Защита сделки по ст. 302 ГК РФ и ст. 61.2 ФЗ-127</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aiProtectionMemo && (
            <button
              type="button"
              onClick={handleApplyAiMemo}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Заполнить из AI-анализа ДДУ</span>
            </button>
          )}
          {customMemoText && (
            <button
              type="button"
              onClick={handleResetToStandard}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
              title="Сбросить к стандартному шаблону"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить</span>
            </button>
          )}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600 font-medium">Штраф застройщика:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={penaltyPercent}
              onChange={(e) => {
                setPenaltyPercent(Math.max(1, Math.min(50, Number(e.target.value) || 0)));
                if (customMemoText) setCustomMemoText('');
              }}
              className="w-12 px-1.5 py-0.5 text-center font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-emerald-500"
            />
            <span className="font-bold text-slate-700">%</span>
          </div>
          <button
            type="button"
            onClick={handleCopyMemo}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{memoCopied ? 'Скопировано!' : 'Скопировать в договор'}</span>
          </button>
        </div>
      </div>
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-line leading-relaxed">
        {currentText}
      </div>
      <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={includePlenum63}
          onChange={(e) => {
            setIncludePlenum63(e.target.checked);
            if (customMemoText) setCustomMemoText('');
          }}
          className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
        />
        <span>Включить ссылку на Постановление Пленума ВАС РФ № 63</span>
      </label>
    </div>
  );
};
