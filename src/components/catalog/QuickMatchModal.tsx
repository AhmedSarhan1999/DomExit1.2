import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { X, Check, Zap, MapPin } from 'lucide-react';

interface QuickMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFindMatches: (criteria: any) => void;
}

export const QuickMatchModal: React.FC<QuickMatchModalProps> = ({
  isOpen,
  onClose,
  onFindMatches,
}) => {
  const { language } = useLanguage();

  const [districts, setDistricts] = useState<string[]>([
    'СПб: Приморский р-н',
    'Васильевский о-в',
  ]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>(['1-room', '2-room']);
  const [selectedCash, setSelectedCash] = useState<string>('3m');
  const [selectedMonthly, setSelectedMonthly] = useState<string>('85k');

  if (!isOpen) return null;

  const removeDistrict = (dist: string) => {
    setDistricts(districts.filter((d) => d !== dist));
  };

  const addDistrict = (dist: string) => {
    if (!districts.includes(dist)) {
      setDistricts([...districts, dist]);
    }
  };

  const toggleRoom = (room: string) => {
    if (selectedRooms.includes(room)) {
      setSelectedRooms(selectedRooms.filter((r) => r !== room));
    } else {
      setSelectedRooms([...selectedRooms, room]);
    }
  };

  const handleSubmit = () => {
    onFindMatches({
      districts,
      rooms: selectedRooms,
      cashLimit: selectedCash,
      monthlyLimit: selectedMonthly,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              <span>{language === 'ru' ? 'Быстрый подбор' : 'Quick Discovery'}</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              {language === 'ru'
                ? 'Подберем идеальный выход под ваш бюджет за 10 секунд'
                : 'Find your ideal clean exit within budget in 10 seconds'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'ru'
                ? 'Исключаем лоты с завышенной оценкой — только чистый возврат и старый прайс'
                : 'Zero marked up units — strictly verified original contract prices'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Districts with removable tags */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ru' ? 'Локации и районы СПб / Москвы:' : 'Locations & Districts:'}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {districts.map((d) => (
              <span
                key={d}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold shadow-xs"
              >
                <span>{d}</span>
                <button
                  type="button"
                  onClick={() => removeDistrict(d)}
                  className="hover:text-rose-600 ml-1 text-sky-500 font-bold"
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => addDistrict('Невский р-н')}
              className="px-2.5 py-1 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-800"
            >
              + Невский р-н
            </button>
            <button
              type="button"
              onClick={() => addDistrict('Москва: Раменки')}
              className="px-2.5 py-1 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-800"
            >
              + Москва: Раменки
            </button>
          </div>
        </div>

        {/* 2. Room Types */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {language === 'ru' ? 'Тип жилья и комнатность:' : 'Unit Type & Rooms:'}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'studio', label: 'Студия' },
              { id: '1-room', label: '1-комн.' },
              { id: '2-room', label: '2-комн.' },
              { id: '3-room', label: '3-комн.' },
              { id: 'euro', label: 'Евро-формат' },
              { id: 'apart', label: 'Апартаменты' },
              { id: 'house', label: 'Дом ИЖС' },
            ].map((room) => {
              const checked = selectedRooms.includes(room.id);
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    checked
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {checked && <Check className="w-3 h-3 inline mr-1 text-white" />}
                  {room.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Available Cash for Seller */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {language === 'ru' ? 'Наличные на руках (первый взнос продавцу):' : 'Cash on Hand (to seller):'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: '1.5m', label: 'До 1.5 млн ₽' },
              { id: '3m', label: 'До 3 млн ₽' },
              { id: '5m', label: 'До 5 млн ₽' },
              { id: 'more5m', label: 'Более 5 млн ₽' },
            ].map((cash) => (
              <button
                key={cash.id}
                type="button"
                onClick={() => setSelectedCash(cash.id)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all text-center ${
                  selectedCash === cash.id
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {selectedCash === cash.id && <Check className="w-3 h-3 inline mr-1" />}
                {cash.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Monthly Installment */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {language === 'ru' ? 'Комфортный ежемесячный платеж:' : 'Comfortable Monthly Payment:'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: '50k', label: 'До 50 000 ₽' },
              { id: '85k', label: 'До 85 000 ₽' },
              { id: '120k', label: 'До 120 000 ₽' },
              { id: 'any', label: 'Любой' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMonthly(m.id)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all text-center ${
                  selectedMonthly === m.id
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit CTA */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{language === 'ru' ? 'Показать подходящие лоты ->' : 'Show Matching Lots ->'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
