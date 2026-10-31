import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F7] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-rose-100 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
              <AlertCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-neutral-900">
                Xatolik yuz berdi
              </h2>
              <p className="text-xs text-neutral-600 mt-1">
                Kutilmagan xatolik tufayli sahifa to'xtab qoldi. Iltimos, sahifani qayta yuklang.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-neutral-600 font-mono text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition shadow-xs cursor-pointer min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sahifani qayta yuklash</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
