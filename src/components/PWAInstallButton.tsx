import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA in standalone mode, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors shrink-0 whitespace-nowrap min-h-[36px]"
        title="Ilovani o'rnatish (PWA)"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Ilovani o'rnatish</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 px-2.5 py-1.5 text-xs font-medium text-rose-800 transition-colors shrink-0 whitespace-nowrap min-h-[36px]"
          title="iPhone / iPad da ilovani o'rnatish"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>iOS ga o'rnatish</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-rose-100">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <h3 className="text-base font-bold text-neutral-900">
                  iPhone / iPad ga o'rnatish
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-md text-neutral-500 hover:text-neutral-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-neutral-700">
                <p className="flex items-start gap-2">
                  <span className="font-bold text-rose-700">1.</span>
                  <span>Safari brauzerining pastki qismidagi <strong>"Ulashish" (Share)</strong> tugmasini bosing.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-rose-700">2.</span>
                  <span>Menyudan pastga tushib, <strong>"Asosiy ekranga qo'shish" (Add to Home Screen)</strong> bandini tanlang.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-rose-700">3.</span>
                  <span>Yuqori o'ng burchakdagi <strong>"Qo'shish" (Add)</strong> tugmasini bosing.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-rose-700 py-2.5 text-xs font-semibold text-white hover:bg-rose-800 transition-colors"
              >
                Tushundim
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
