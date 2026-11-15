import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LegalDocument, LegalRevision, LegalSettings } from '../../types/legal';
import { LegalRepository, DEFAULT_LEGAL_SETTINGS } from '../../dal/repositories/LegalRepository';
import { SmartLegalDocumentView } from '../../components/legal/SmartLegalDocumentView';
import { History, ArrowLeft, Loader2 } from 'lucide-react';

export const LegalArchiveSnapshotPage: React.FC = () => {
  const { slug, version } = useParams<{ slug: string; version: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [revision, setRevision] = useState<LegalRevision | null>(null);
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!slug || !version) {
        navigate('/legal/archive', { replace: true });
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const foundDoc = await LegalRepository.getDocumentBySlug(slug);
        if (!foundDoc) {
          setError(`Документ со slug "${slug}" не найден в реестре.`);
          setIsLoading(false);
          return;
        }

        const foundRev = await LegalRepository.getRevisionBySlugAndVersion(slug, version);
        if (!foundRev) {
          setError(`Архивная редакция v${version} документа «${foundDoc.title}» не найдена.`);
          setIsLoading(false);
          return;
        }

        const currentSettings = await LegalRepository.getSettings();
        // Use frozen snapshot variables if present in revision, else fallback
        const snapshotSettings: LegalSettings = {
          ...currentSettings,
          ...(foundRev.company_variables_snapshot || {}),
        };

        setDoc(foundDoc);
        setRevision(foundRev);
        setSettings(snapshotSettings);
      } catch (err: any) {
        console.error('Failed loading archive snapshot:', err);
        setError(err?.message || 'Ошибка загрузки архивной редакции');
      } finally {
        setIsLoading(false);
      }
    }

    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, version, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center space-x-3 text-slate-600 font-semibold text-xs">
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          <span>Загрузка архивного слепка документа и сверка хеша...</span>
        </div>
      </div>
    );
  }

  if (error || !doc || !revision || !settings) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Архивный слепок не найден</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'Запрошенная версия документа отсутствует в публичном архиве.'}
          </p>
          <div className="pt-2">
            <Link
              to="/legal/archive"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Вернуться в реестр архива</span>
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
      isHistoricalSnapshot={true}
    />
  );
};
