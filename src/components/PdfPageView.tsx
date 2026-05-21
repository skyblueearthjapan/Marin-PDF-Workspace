import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DocSource, PageSlot, ZoomPercent } from "../types";
import { evictCanvas, renderPage } from "../pdf/renderer";
import Icon from "./Icon";

interface Props {
  slot: PageSlot;
  docs: DocSource[];
  zoom: ZoomPercent;
  viewerWidth: number;
  pageNumber: number;
  totalPages: number;
  sourceLabel?: string | null;
  selectable?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  hideForPrint?: boolean;
  replacing?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}

const MIN_PAGE_WIDTH = 120;
// Render pages within this margin of the viewport; pages outside are evicted to release memory.
const RENDER_MARGIN_PX = 800;

export default function PdfPageView({
  slot, docs, zoom, viewerWidth, pageNumber, totalPages, sourceLabel,
  selectable, selected, dimmed, hideForPrint, replacing, badge, onClick,
}: Props) {
  const pageWidthCss = Math.max(MIN_PAGE_WIDTH, Math.round(viewerWidth * (zoom / 100)));
  const cardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const [rendered, setRendered] = useState(false);

  const effective = slot.replacedBy ?? slot;
  const targetDoc = docs.find((d) => d.id === effective.srcDocId);
  const rotation = slot.rotation ?? 0;

  // Visibility observer — render only when nearby, evict canvas when far.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { rootMargin: `${RENDER_MARGIN_PX}px 0px ${RENDER_MARGIN_PX}px 0px`, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Render / cancel / evict
  useEffect(() => {
    if (!targetDoc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!inView) {
      // Out of range — release GPU/CPU memory tied to this canvas.
      evictCanvas(canvas);
      setRendered(false);
      return;
    }
    setError(false);
    const handle = renderPage(targetDoc.pdf, {
      pageIndex: effective.srcPageIndex,
      maxWidthCss: pageWidthCss,
      canvas,
      rotation,
    });
    let cancelled = false;
    handle.promise
      .then((res) => {
        if (cancelled) return;
        setSize({ w: res.cssWidth, h: res.cssHeight });
        setRendered(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        if (name === "AbortError") return;
        console.error("renderPage failed", e);
        setError(true);
        setRendered(false);
      });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [targetDoc, effective.srcPageIndex, pageWidthCss, rotation, inView]);

  const cls = [
    "pdf-page",
    selectable ? "selectable" : "",
    selected ? "selected" : "",
    dimmed ? "dimmed" : "",
    replacing ? "replacing-source" : "",
  ].filter(Boolean).join(" ");

  // Reserve the page footprint via aspect-ratio. Fall back to A4 portrait until we know.
  const aspectRatio = size ? `${size.w} / ${size.h}` : `1 / 1.414`;

  return (
    <div
      ref={cardRef}
      className={cls}
      onClick={onClick}
      style={{ aspectRatio, width: `${pageWidthCss}px` }}
    >
      {sourceLabel && <div className="page-meta-tag">{sourceLabel}</div>}
      <div className="page-canvas-wrap">
        <canvas ref={canvasRef} className="page-canvas" style={{ visibility: rendered ? "visible" : "hidden" }} />
        {!rendered && !error && (
          <div className="page-skeleton">
            <div className="ps-spinner" />
          </div>
        )}
        {error && <div className="page-error">ページの表示に失敗しました</div>}
      </div>
      <div className="page-number">{pageNumber} / {totalPages}</div>
      {hideForPrint && <div className="print-no">印刷対象外</div>}
      {replacing && (
        <div className="replace-overlay">
          <div className="badge">
            <Icon name="replace" className="ic ic-sm" />
            差し替え対象のページ
          </div>
        </div>
      )}
      {badge && <div className="page-badge">{badge}</div>}
    </div>
  );
}
