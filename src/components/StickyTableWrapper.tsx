import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface StickyTableWrapperProps {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  maxHeightClassName?: string;
  scrollStep?: number;
  label?: string;
}

export const StickyTableWrapper: React.FC<StickyTableWrapperProps> = ({
  children,
  className = '',
  viewportClassName = '',
  maxHeightClassName = 'max-h-[74vh]',
  scrollStep = 340,
  label = 'Jadvalni surish:',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setCanScrollLeft(left);
    setCanScrollRight(right);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();

    const handleScroll = () => checkScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(el);
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      observer.disconnect();
    };
  }, [checkScroll, children]);

  const scrollByAmount = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToEdge = (edge: 'start' | 'end') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: edge === 'start' ? 0 : el.scrollWidth,
      behavior: 'smooth',
    });
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Sticky Horizontal Swipe Toolbar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-xs border-b border-rose-100/90 shadow-2xs">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600">
          <span>{label}</span>
          {!canScrollLeft && !canScrollRight ? (
            <span className="text-[10px] font-normal text-neutral-400">
              (Barcha ustunlar ko'rinmoqda)
            </span>
          ) : (
            <span className="text-[10px] font-mono text-rose-700">
              ← / →
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollToEdge('start')}
            disabled={!canScrollLeft}
            className="inline-flex items-center justify-center px-2 py-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-900 disabled:opacity-40 disabled:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-400 text-[11px] font-bold transition cursor-pointer disabled:cursor-default"
            title="Jadval boshiga o'tish"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => scrollByAmount(-scrollStep)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              canScrollLeft
                ? 'border-rose-300 bg-rose-700 hover:bg-rose-800 text-white shadow-2xs'
                : 'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
            }`}
            title="Chapga surish"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Chapga</span>
          </button>

          <button
            type="button"
            onClick={() => scrollByAmount(scrollStep)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              canScrollRight
                ? 'border-rose-300 bg-rose-700 hover:bg-rose-800 text-white shadow-2xs'
                : 'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
            }`}
            title="O'ngga surish"
          >
            <span>O'ngga</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => scrollToEdge('end')}
            disabled={!canScrollRight}
            className="inline-flex items-center justify-center px-2 py-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-900 disabled:opacity-40 disabled:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-400 text-[11px] font-bold transition cursor-pointer disabled:cursor-default"
            title="Jadval oxiriga o'tish"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Table Viewport with Sticky Column Headers */}
      <div
        ref={scrollRef}
        className={`w-full overflow-auto scroll-smooth sticky-table-viewport ${maxHeightClassName} ${viewportClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
