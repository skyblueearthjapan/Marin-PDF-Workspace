import { PDFDocument, degrees, type PDFPage } from "pdf-lib";
import JSZip from "jszip";
import type { DocSource, PageSlot } from "../types";

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadBytes(bytes: Uint8Array, name: string) {
  downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), name);
}

interface BuildArgs {
  docs: DocSource[];
  slots: PageSlot[];
}

async function loadSources(docs: DocSource[], slots: PageSlot[]): Promise<Map<string, PDFDocument>> {
  const ids = new Set<string>();
  for (const slot of slots) {
    const eff = slot.replacedBy ?? slot;
    ids.add(eff.srcDocId);
  }
  const map = new Map<string, PDFDocument>();
  for (const id of ids) {
    const d = docs.find((x) => x.id === id);
    if (!d) continue;
    map.set(id, await PDFDocument.load(new Uint8Array(d.bytes)));
  }
  return map;
}

async function appendSlots(out: PDFDocument, slots: PageSlot[], sources: Map<string, PDFDocument>) {
  // Group consecutive slots from the same source so copyPages can do them in one call.
  let i = 0;
  while (i < slots.length) {
    const raw = slots[i];
    const eff = raw.replacedBy ?? raw;
    const srcId = eff.srcDocId;
    const src = sources.get(srcId);
    if (!src) { i++; continue; }
    const indices: number[] = [eff.srcPageIndex];
    const rotations: (number | undefined)[] = [raw.rotation];
    let j = i + 1;
    while (j < slots.length) {
      const nraw = slots[j];
      const neff = nraw.replacedBy ?? nraw;
      if (neff.srcDocId !== srcId) break;
      indices.push(neff.srcPageIndex);
      rotations.push(nraw.rotation);
      j++;
    }
    const copied: PDFPage[] = await out.copyPages(src, indices);
    copied.forEach((page, k) => {
      const userRot = rotations[k] ?? 0;
      if (userRot) {
        const current = page.getRotation().angle;
        const total = (((current + userRot) % 360) + 360) % 360;
        page.setRotation(degrees(total));
      }
      out.addPage(page);
    });
    i = j;
  }
}

export async function buildComposite({ docs, slots }: BuildArgs): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const sources = await loadSources(docs, slots);
  await appendSlots(out, slots, sources);
  return out.save();
}

export interface SplitProgress {
  current: number;
  total: number;
}

export async function buildSplitSegments(
  docs: DocSource[],
  slots: PageSlot[],
  splitAfter: number[],
  onProgress?: (p: SplitProgress) => void
): Promise<Uint8Array[]> {
  const boundaries = [...splitAfter].sort((a, b) => a - b);
  const segments: PageSlot[][] = [];
  let start = 0;
  for (const b of boundaries) {
    segments.push(slots.slice(start, b + 1));
    start = b + 1;
  }
  segments.push(slots.slice(start));
  const valid = segments.filter((s) => s.length > 0);

  // Load each source PDF ONCE for the whole split operation.
  const sources = await loadSources(docs, slots);

  const out: Uint8Array[] = [];
  for (let i = 0; i < valid.length; i++) {
    const seg = valid[i];
    const segDoc = await PDFDocument.create();
    await appendSlots(segDoc, seg, sources);
    out.push(await segDoc.save());
    onProgress?.({ current: i + 1, total: valid.length });
    // Yield to UI between segments so the busy text stays responsive
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

/**
 * Bundle multiple split PDFs into a single .zip blob.
 */
export async function zipSegments(
  segments: Uint8Array[],
  baseName: string,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const pad = String(segments.length).length;
  segments.forEach((bytes, i) => {
    const idx = String(i + 1).padStart(pad, "0");
    zip.file(`${baseName}_part${idx}.pdf`, bytes);
  });
  return zip.generateAsync({ type: "blob", compression: "STORE" }, (meta) => {
    onProgress?.(meta.percent);
  });
}
