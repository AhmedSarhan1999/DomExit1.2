import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Global React error boundary preventing unrecovered white-screen crashes.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Непредвиденная ошибка интерфейса',
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Uncaught UI error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-7 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">
              Произошла ошибка интерфейса
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Часть данных не удалось отобразить корректно. Обновите страницу или вернитесь на главную.
            </p>
            {this.state.errorMessage && (
              <p className="text-xs font-mono text-red-700 bg-red-50/70 border border-red-100 rounded-lg px-3 py-2 break-words">
                {this.state.errorMessage}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Обновить страницу
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold transition-colors"
            >
              <Home className="w-4 h-4" />
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }
}
