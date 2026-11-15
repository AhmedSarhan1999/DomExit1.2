import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LegalDocument, LegalRevision, LegalSettings } from '../../types/legal';
import { LegalRepository } from '../../dal/repositories/LegalRepository';
import { SmartLegalDocumentView } from '../../components/legal/SmartLegalDocumentView';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';

export const LegalDocumentReaderPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [revision, setRevision] = useState<LegalRevision | null>(null);
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!slug) {
        navigate('/legal', { replace: true });
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const foundDoc = await LegalRepository.getDocumentBySlug(slug);
        if (!foundDoc) {
          setError(`Юридический документ «${slug}» не найден в официальном реестре.`);
          setIsLoading(false);
          return;
        }

        const activeRev = await LegalRepository.getActiveRevisionForDocument(slug);
        const currentSettings = await LegalRepository.getSettings();

        setDoc(foundDoc);
        setRevision(activeRev);
        setSettings(currentSettings);
      } catch (err: any) {
        console.error('Failed loading document:', err);
        setError(err?.message || 'Ошибка загрузки документа');
      } finally {
        setIsLoading(false);
      }
    }

    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center space-x-3 text-slate-600 font-semibold text-xs">
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          <span>Загрузка правового документа и проверка SHA-256...</span>
        </div>
      </div>
    );
  }

  if (error || !doc || !revision || !settings) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Документ не найден</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'Запрошенный документ отсутствует либо временно скрыт из публичного реестра.'}
          </p>
          <div className="pt-2">
            <Link
              to="/legal"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Вернуться в Правовой центр</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SmartLegalDocumentView
      document={doc}
      revision={revision}
      settings={settings}
      isHistoricalSnapshot={false}
    />
  );
};
