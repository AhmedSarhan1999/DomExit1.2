import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Lot } from '../../../types';
import { formatRubles } from '../../../utils/formatters';

interface LegalMemoGeneratorProps {
  lot: Lot;
}

export const LegalMemoGenerator: React.FC<LegalMemoGeneratorProps> = ({ lot }) => {
  const [includePlenum63, setIncludePlenum63] = useState<boolean>(true);
  const [memoCopied, setMemoCopied] = useState<boolean>(false);

  const getMemoText = () => {
    const cashStr = formatRubles(lot?.cashPaidBySeller || 0);
    const dduNum = lot?.ownerDossier?.dduNumber || `№ ДДУ-${lot?.lotCode || '—'}`;
    const devName = lot?.developer || 'Застройщик';
    const penaltyStr = formatRubles(Math.round((lot?.dduContractPrice || 0) * 0.15));

    let text = `Цена сделки в размере ${cashStr} строго соответствует сумме фактически внесенных Цедентом денежных средств по договору ${dduNum}.\n\n`;
    text += `Стороны констатируют, что установление данной цены экономически обусловлено предотвращением финансовых убытков Цедента в виде контрактного штрафа Застройщика (${devName}) в размере 15% (${penaltyStr}) при одностороннем отказе от договора. В силу ст. 302 ГК РФ и ст. 61.2 ФЗ-127 Покупатель признается добросовестным приобретателем, действовавшим в стандартных условиях делового оборота без цели причинения вреда кредиторам.`;

    if (includePlenum63) {
      text += `\n\nПрименена правовая позиция Постановления Пленума ВАС РФ № 63: «Экономическая целесообразность предотвращения штрафных санкций подтверждена документально».`;
    }
    return text;
  };

  const handleCopyMemo = () => {
    navigator.clipboard?.writeText(getMemoText());
    setMemoCopied(true);
    setTimeout(() => setMemoCopied(false), 2500);
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
        <button
          type="button"
          onClick={handleCopyMemo}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{memoCopied ? 'Скопировано!' : 'Скопировать в договор'}</span>
        </button>
      </div>
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-line leading-relaxed">
        {getMemoText()}
      </div>
      <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={includePlenum63}
          onChange={(e) => setIncludePlenum63(e.target.checked)}
          className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
        />
        <span>Включить ссылку на Постановление Пленума ВАС РФ № 63</span>
      </label>
    </div>
  );
};
