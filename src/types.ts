import type { PDFDocumentProxy } from "pdfjs-dist";

export type ModeId = "view" | "merge" | "split" | "print" | "replace";

export interface DocSource {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  pageCount: number;
  accent: string;
}

export interface PageRef {
  srcDocId: string;
  srcPageIndex: number;
}

export interface PageSlot extends PageRef {
  replacedBy?: PageRef;
  rotation?: number;
}

/** Zoom is a percentage relative to "fit-width" (100 = fits the viewer width). */
export type ZoomPercent = number;

export const ZOOM_MIN = 30;
export const ZOOM_MAX = 300;
export const ZOOM_STEP = 10;
export const ZOOM_DEFAULT = 100;
export const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300];

export interface ToastMsg {
  id: number;
  text: string;
}
