import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdf(bytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  const copy = new Uint8Array(bytes);
  const task = pdfjsLib.getDocument({ data: copy, disableAutoFetch: true, disableStream: true });
  return task.promise;
}

export interface RenderOptions {
  pageIndex: number;
  scale?: number;
  pixelRatio?: number;
  maxWidthCss?: number;
  canvas?: HTMLCanvasElement;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
}

export interface RenderHandle {
  promise: Promise<RenderResult>;
  cancel: () => void;
}

/**
 * Render a single page. Returns a handle whose `cancel()` aborts the underlying
 * pdf.js RenderTask, preventing "Cannot use the same canvas during multiple
 * render() operations" errors when callers rerun in quick succession.
 */
export function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  {
    pageIndex,
    scale,
    pixelRatio = window.devicePixelRatio || 1,
    maxWidthCss,
    canvas,
  }: RenderOptions
): RenderHandle {
  let task: pdfjsLib.RenderTask | null = null;
  let cancelled = false;

  const run = async (): Promise<RenderResult> => {
    const page = await pdf.getPage(pageIndex + 1);
    if (cancelled) {
      page.cleanup();
      throw new DOMException("cancelled", "AbortError");
    }
    let chosenScale = scale ?? 1;
    if (maxWidthCss != null) {
      const baseVp = page.getViewport({ scale: 1 });
      chosenScale = maxWidthCss / baseVp.width;
    }
    const viewport = page.getViewport({ scale: chosenScale * pixelRatio });
    const cssWidth = viewport.width / pixelRatio;
    const cssHeight = viewport.height / pixelRatio;
    const target = canvas ?? document.createElement("canvas");
    target.width = Math.ceil(viewport.width);
    target.height = Math.ceil(viewport.height);
    target.style.width = `${cssWidth}px`;
    target.style.height = `${cssHeight}px`;
    const ctx = target.getContext("2d", { alpha: false });
    if (!ctx) {
      page.cleanup();
      throw new Error("canvas 2d context unavailable");
    }
    task = page.render({ canvasContext: ctx, viewport });
    try {
      await task.promise;
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name;
      if (cancelled || name === "RenderingCancelledException" || name === "AbortError") {
        page.cleanup();
        throw new DOMException("cancelled", "AbortError");
      }
      page.cleanup();
      throw e;
    }
    page.cleanup();
    return { canvas: target, cssWidth, cssHeight };
  };

  return {
    promise: run(),
    cancel: () => {
      cancelled = true;
      if (task) {
        try { task.cancel(); } catch { /* swallow */ }
      }
    },
  };
}

export interface ThumbHandle {
  promise: Promise<string>;
  cancel: () => void;
}

export function renderThumbnailHandle(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  width = 110
): ThumbHandle {
  const h = renderPage(pdf, { pageIndex, maxWidthCss: width, pixelRatio: 1.5 });
  const promise = h.promise.then(({ canvas }) => {
    const url = canvas.toDataURL("image/png");
    // Release the temporary canvas's GPU memory eagerly.
    canvas.width = 1;
    canvas.height = 1;
    return url;
  });
  return { promise, cancel: h.cancel };
}

/** Convenience: simple awaitable thumbnail (no cancel support). */
export async function renderThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  width = 110
): Promise<string> {
  return renderThumbnailHandle(pdf, pageIndex, width).promise;
}

/** Erase a canvas down to 1×1 to release backing memory. */
export function evictCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx?.clearRect(0, 0, 1, 1);
}
