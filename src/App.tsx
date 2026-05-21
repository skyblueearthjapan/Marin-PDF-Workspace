import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocSource, ModeId, PageSlot, ToastMsg, ZoomPercent } from "./types";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_DEFAULT } from "./types";
import Icon from "./components/Icon";
import PdfPageView from "./components/PdfPageView";
import Thumbpane from "./components/Thumbpane";
import MergeSheet from "./components/MergeSheet";
import ReplacePicker from "./components/ReplacePicker";
import PrintModal from "./components/PrintModal";
import { loadPdf } from "./pdf/renderer";
import { buildComposite, buildSplitSegments, downloadBlob, downloadBytes, zipSegments } from "./pdf/operations";
import { printPdfBytes } from "./pdf/print";

const MODES: { id: ModeId; label: string; icon: "view" | "merge" | "split" | "print" | "replace" }[] = [
  { id: "view",    label: "閲覧", icon: "view" },
  { id: "merge",   label: "結合", icon: "merge" },
  { id: "split",   label: "分割", icon: "split" },
  { id: "print",   label: "印刷", icon: "print" },
  { id: "replace", label: "差替", icon: "replace" },
];

const ACCENTS = ["#f5a3b3", "#fbbb98", "#8ed8b1", "#b8a4f5", "#f4c873"];

interface Snapshot {
  docs: DocSource[];
  slots: PageSlot[];
}

const HISTORY_LIMIT = 30;

export default function App() {
  const [docs, setDocs] = useState<DocSource[]>([]);
  const [slots, setSlots] = useState<PageSlot[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [mode, setMode] = useState<ModeId>("view");
  const [zoom, setZoom] = useState<ZoomPercent>(ZOOM_DEFAULT);

  const adjustZoom = (delta: number) => {
    setZoom((z) => {
      const next = Math.round((z + delta) / ZOOM_STEP) * ZOOM_STEP;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    });
  };
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [mergeOrder, setMergeOrder] = useState<string[]>([]);
  const [splitAfter, setSplitAfter] = useState<number[]>([]);
  const [printOff, setPrintOff] = useState<Set<number>>(new Set());
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const widthRulerRef = useRef<HTMLDivElement | null>(null);
  const thumbListRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(640);
  const dragCounterRef = useRef(0);
  const scrollLockUntilRef = useRef(0);

  const hasFile = docs.length > 0 && slots.length > 0;

  const showToast = useCallback((text: string) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((m) => m.id !== id)), 2600);
  }, []);

  // -- Undo / Redo ---------------------------------------------------------
  const pushHistory = useCallback(() => {
    setHistory((h) => {
      const next = [...h, { docs, slots }];
      return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
    });
    setFuture([]);
  }, [docs, slots]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [{ docs, slots }, ...f].slice(0, HISTORY_LIMIT));
      setDocs(prev.docs);
      setSlots(prev.slots);
      return h.slice(0, -1);
    });
    showToast("1つ前の状態に戻しました");
  }, [docs, slots, showToast]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, { docs, slots }].slice(-HISTORY_LIMIT));
      setDocs(next.docs);
      setSlots(next.slots);
      return f.slice(1);
    });
    showToast("やり直しました");
  }, [docs, slots, showToast]);

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canUndo, canRedo]);

  const docById = useCallback((id: string) => docs.find((d) => d.id === id), [docs]);

  // -- File loading
  const ingestFiles = useCallback(async (files: FileList | File[] | null, opts?: { replaceCurrent?: boolean }) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (list.length === 0) {
      showToast("PDF ファイルを選択してください");
      return;
    }
    setBusy("PDFを読み込み中…");
    try {
      const added: DocSource[] = [];
      for (const file of list) {
        const ab = await file.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const pdf = await loadPdf(bytes);
        added.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          bytes,
          pdf,
          pageCount: pdf.numPages,
          accent: ACCENTS[(docs.length + added.length) % ACCENTS.length],
        });
      }
      pushHistory();
      setDocs((prev) => [...prev, ...added]);
      if (opts?.replaceCurrent || slots.length === 0) {
        const first = added[0];
        setSlots(enumeratePages(first));
      }
      showToast(`${list.length} 件のPDFを読み込みました`);
    } catch (e) {
      console.error(e);
      showToast("PDFの読み込みに失敗しました");
    } finally {
      setBusy(null);
    }
  }, [docs.length, slots.length, showToast]);

  // -- Mode transitions
  useEffect(() => {
    if (mode === "merge") {
      // Seed merge queue with the docs currently in the composite slots
      const inUse: string[] = [];
      for (const s of slots) {
        if (!inUse.includes(s.srcDocId)) inUse.push(s.srcDocId);
      }
      setMergeOrder(inUse);
    }
    if (mode === "split") setSplitAfter([]);
    if (mode === "print") setPrintOff(new Set());
    if (mode === "replace") setReplaceTarget(null);
  }, [mode]);

  // -- Track viewer width (for full-fit PDF rendering)
  useEffect(() => {
    const el = widthRulerRef.current;
    if (!el) return;
    const apply = () => {
      const raw = el.clientWidth;
      // round to 20px steps to avoid re-rendering every pixel during resize
      const w = Math.max(280, Math.round((raw - 4) / 20) * 20);
      setViewerWidth((prev) => (prev === w ? prev : w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFile, mode]);

  // -- Scroll → current page; main viewer scroll syncs the thumbnail pane (rAF-throttled)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let rafId = 0;
    const runScrollSync = () => {
      rafId = 0;
      const pages = el.querySelectorAll<HTMLDivElement>(".pdf-page");
      if (pages.length === 0) return;
      let best = 0;
      let bestDist = Infinity;
      const center = el.scrollTop + el.clientHeight * 0.45;
      pages.forEach((p, i) => {
        const dist = Math.abs(p.offsetTop + p.offsetHeight / 2 - center);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      setCurrentPage(best + 1);
      if (Date.now() < scrollLockUntilRef.current) return;
      syncThumbToPage(best);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(runScrollSync);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    runScrollSync();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [slots.length]);

  const syncThumbToPage = (idx: number) => {
    const tl = thumbListRef.current;
    if (!tl) return;
    const cards = tl.querySelectorAll<HTMLDivElement>(".thumb-card");
    const card = cards[idx];
    if (!card) return;
    const target = card.offsetTop - tl.clientHeight / 2 + card.clientHeight / 2;
    const maxTop = tl.scrollHeight - tl.clientHeight;
    const clamped = Math.max(0, Math.min(maxTop, target));
    if (Math.abs(tl.scrollTop - clamped) < 4) return;
    scrollLockUntilRef.current = Date.now() + 500;
    tl.scrollTo({ top: clamped, behavior: "smooth" });
  };

  // -- Thumbnail pane scroll → viewer scroll (rAF-throttled)
  const thumbRafRef = useRef(0);
  const onThumbListScroll = useCallback(() => {
    if (thumbRafRef.current) return;
    thumbRafRef.current = requestAnimationFrame(() => {
      thumbRafRef.current = 0;
      if (Date.now() < scrollLockUntilRef.current) return;
      const tl = thumbListRef.current;
      const vs = scrollRef.current;
      if (!tl || !vs) return;
      const cards = tl.querySelectorAll<HTMLDivElement>(".thumb-card");
      if (cards.length === 0) return;
      const center = tl.scrollTop + tl.clientHeight * 0.5;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((c, i) => {
        const dist = Math.abs(c.offsetTop + c.clientHeight / 2 - center);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      const pages = vs.querySelectorAll<HTMLDivElement>(".pdf-page");
      const target = pages[best];
      if (!target) return;
      const desired = target.offsetTop - 24;
      if (Math.abs(vs.scrollTop - desired) < 4) return;
      scrollLockUntilRef.current = Date.now() + 500;
      vs.scrollTo({ top: desired, behavior: "smooth" });
      setCurrentPage(best + 1);
    });
  }, []);

  const jumpToPage = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const pages = el.querySelectorAll<HTMLDivElement>(".pdf-page");
    if (pages[idx]) {
      scrollLockUntilRef.current = Date.now() + 500;
      el.scrollTo({ top: pages[idx].offsetTop - 24, behavior: "smooth" });
      // Bring thumb into view as well
      syncThumbToPage(idx);
    }
  };

  // -- Section dividers for merged content (when slots come from >1 source doc)
  const mergedSections = useMemo(() => {
    const out: { startIndex: number; srcDocId: string; count: number }[] = [];
    let cur: { startIndex: number; srcDocId: string; count: number } | null = null;
    slots.forEach((slot, i) => {
      if (!cur || cur.srcDocId !== slot.srcDocId) {
        cur = { startIndex: i, srcDocId: slot.srcDocId, count: 1 };
        out.push(cur);
      } else {
        cur.count++;
      }
    });
    return out.length > 1 ? out : null;
  }, [slots]);

  // -- Operations
  const confirmMerge = async () => {
    if (mergeOrder.length < 1) { showToast("結合するファイルを選択してください"); return; }
    const newSlots: PageSlot[] = [];
    for (const did of mergeOrder) {
      const d = docById(did);
      if (!d) continue;
      for (let i = 0; i < d.pageCount; i++) newSlots.push({ srcDocId: did, srcPageIndex: i });
    }
    pushHistory();
    setSlots(newSlots);
    setMode("view");
    showToast(`${mergeOrder.length} ファイル / ${newSlots.length} ページを結合しました`);
  };

  const downloadCurrent = async () => {
    if (!hasFile) return;
    setBusy("PDFを生成中…");
    try {
      const bytes = await buildComposite({ docs, slots });
      downloadBytes(bytes, deriveFilename("merged"));
      showToast("ダウンロードを開始しました");
    } catch (e) {
      console.error(e);
      showToast("保存に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const ZIP_THRESHOLD = 5;
  const confirmSplit = async () => {
    if (splitAfter.length === 0) { showToast("分割位置を指定してください"); return; }
    setBusy("分割PDFを生成中…");
    try {
      const segs = await buildSplitSegments(docs, slots, splitAfter, ({ current, total }) => {
        setBusy(`分割PDFを生成中… ${current} / ${total}`);
      });
      const baseName = deriveFilename("split").replace(/\.pdf$/i, "");
      if (segs.length >= ZIP_THRESHOLD) {
        setBusy(`ZIP を作成中… (${segs.length} ファイル)`);
        const zipBlob = await zipSegments(segs, baseName);
        downloadBlob(zipBlob, `${baseName}.zip`);
        showToast(`${segs.length} 個のPDFを ZIP で保存しました`);
      } else {
        segs.forEach((bytes, i) => {
          downloadBytes(bytes, `${baseName}_part${i + 1}.pdf`);
        });
        showToast(`${segs.length} 個のPDFを保存しました`);
      }
      setMode("view");
    } catch (e) {
      console.error(e);
      showToast("分割に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const togglePrintExclude = (idx: number) => {
    setPrintOff((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      return s;
    });
  };

  const printActive = async () => {
    if (!hasFile) return;
    const keepIdx = slots.map((_, i) => i).filter((i) => !printOff.has(i));
    if (keepIdx.length === 0) { showToast("印刷するページがありません"); return; }
    setBusy("印刷データを生成中…");
    try {
      const filteredSlots = keepIdx.map((i) => slots[i]);
      const bytes = await buildComposite({ docs, slots: filteredSlots });
      printPdfBytes(bytes, deriveFilename("print"));
      showToast(`${keepIdx.length} ページを印刷キューに送信しました`);
      setShowPrintModal(false);
      setMode("view");
    } catch (e) {
      console.error(e);
      showToast("印刷の準備に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const handleReplaceTargetClick = (idx: number) => {
    if (mode !== "replace") return;
    setReplaceTarget(idx);
    setTimeout(() => jumpToPage(idx), 50);
  };

  const applyReplace = (srcDocId: string, srcPageIndex: number) => {
    if (replaceTarget == null) return;
    pushHistory();
    setSlots((prev) => {
      const next = prev.slice();
      next[replaceTarget] = { ...next[replaceTarget], replacedBy: { srcDocId, srcPageIndex } };
      return next;
    });
    const d = docById(srcDocId);
    showToast(`${replaceTarget + 1} ページ目を「${d?.name.replace(/\.pdf$/i, "")} p.${srcPageIndex + 1}」に差し替えました`);
    setReplaceTarget(null);
    setMode("view");
  };

  const deleteAll = () => {
    if (!confirm("読み込んだPDFをすべて破棄しますか?")) return;
    pushHistory();
    setDocs([]);
    setSlots([]);
    setMergeOrder([]);
    setSplitAfter([]);
    setPrintOff(new Set());
    setReplaceTarget(null);
    setMode("view");
    showToast("ファイルを削除しました (Ctrl+Z で復元可)");
  };

  // -- Paste (Ctrl+V / Cmd+V) anywhere in the app
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const pdfs = Array.from(files).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) return;
      // Don't hijack paste in editable fields (search, modal inputs, etc.)
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      ingestFiles(pdfs);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestFiles]);

  // -- Drag and drop on viewer
  const onDragEnter = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      dragCounterRef.current += 1;
      setDragOver(true);
    }
  };
  const onDragLeave = () => {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);
    ingestFiles(e.dataTransfer.files);
  };

  // -- Source label for thumbpane (only show when slots come from >1 doc)
  const sourceLabelFor = useCallback((idx: number) => {
    const slot = slots[idx];
    if (!slot) return "";
    const effective = slot.replacedBy ?? slot;
    const d = docById(effective.srcDocId);
    if (!d) return "";
    if (mergedSections) return d.name.replace(/\.pdf$/i, "");
    return `p.${effective.srcPageIndex + 1}`;
  }, [slots, docById, mergedSections]);

  const fileInput = useRef<HTMLInputElement | null>(null);

  return (
    <div className="workspace">
      {/* TOP BAR */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <img src="/dolphin-logo.webp" alt="Marin" className="brand-img" />
          </div>
          <div>
            <div className="brand-name">Marin</div>
            <div className="brand-sub">PDF Workspace</div>
          </div>
        </div>
        <div className="mode-tabs">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-tab m-${m.id}${mode === m.id ? " active" : ""}`}
              onClick={() => hasFile && setMode(m.id)}
              disabled={!hasFile}
            >
              <span className="mt-bubble"><Icon name={m.icon} className="ic" /></span>
              {m.label}
            </button>
          ))}
        </div>
        <div className="top-spacer" />
        <div className="top-meta">
          <button
            className="icon-btn tt"
            data-tt="元に戻す (Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo}
          >
            <Icon name="undo" className="ic ic-sm" />
          </button>
          <button
            className="icon-btn tt"
            data-tt="やり直し (Ctrl+Y)"
            onClick={redo}
            disabled={!canRedo}
          >
            <Icon name="redo" className="ic ic-sm" />
          </button>
          {hasFile && (
            <button className="delete-btn tt" data-tt="ファイルを削除" onClick={deleteAll}>
              <Icon name="trash" className="ic ic-sm" />削除
            </button>
          )}
          <button className="icon-btn tt" data-tt="ダウンロード" onClick={downloadCurrent} disabled={!hasFile}>
            <Icon name="download" className="ic ic-sm" />
          </button>
          <button className="icon-btn tt" data-tt="設定">
            <Icon name="settings" className="ic ic-sm" />
          </button>
        </div>
      </div>

      {/* Merge sheet appears only in merge mode + hasFile */}
      {mode === "merge" && hasFile && (
        <MergeSheet
          docs={docs}
          mergeOrder={mergeOrder}
          onAdd={(id) => setMergeOrder((p) => (p.includes(id) ? p : [...p, id]))}
          onRemove={(id) => setMergeOrder((p) => p.filter((x) => x !== id))}
          onClear={() => setMergeOrder([])}
          onReorder={(next) => setMergeOrder(next)}
          onPickFiles={(f) => ingestFiles(f)}
        />
      )}

      {/* CENTER: viewer + drop zone */}
      <div
        className={`viewer${dragOver ? " dragging" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {!hasFile && (
          <div className="no-file">
            <div className="drop-zone" onClick={() => fileInput.current?.click()}>
              <div className="dz-icon"><Icon name="upload" /></div>
              <div className="dz-title">PDFをここにドロップ</div>
              <div className="dz-sub">クリックして選択、または Ctrl+V で貼り付け</div>
              <div className="dz-or">OR</div>
              <button className="dz-cta" onClick={(e) => { e.stopPropagation(); fileInput.current?.click(); }}>
                <Icon name="plus" className="ic" />PDFを選択
              </button>
              <div className="dz-formats">対応フォーマット: PDF</div>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => ingestFiles(e.target.files)}
              />
            </div>
          </div>
        )}
        {dragOver && (
          <div className="drop-veil">
            <div className="veil-card">
              <Icon name="upload" className="ic ic-lg" />
              ここにPDFをドロップしてアップロード
            </div>
          </div>
        )}
        {hasFile && (
          <>
            <ModeHint
              mode={mode}
              mergeCount={mergeOrder.length}
              splitCount={splitAfter.length}
              printCount={slots.length - printOff.size}
              replaceTarget={replaceTarget}
            />
            <div className="viewer-scroll" ref={scrollRef}>
              <div
                className={`viewer-inner${mode === "merge" ? " merge-active" : ""}`}
                style={{ ["--page-css-width" as string]: `${viewerWidth}px` }}
              >
                <div ref={widthRulerRef} className="width-ruler" aria-hidden="true" />
                {slots.map((slot, i) => {
                  const section = mergedSections?.find((s) => s.startIndex === i);
                  return (
                    <PageBlock key={i} index={i}>
                      {section && (
                        <div className="section-divider">
                          <div className="line" />
                          <div className="chip">
                            <span className="num">{mergedSections!.indexOf(section) + 1}</span>
                            {docById(section.srcDocId)?.name.replace(/\.pdf$/i, "")} ・ {section.count}ページ
                          </div>
                          <div className="line" />
                        </div>
                      )}
                      {splitAfter.includes(i - 1) && (
                        <div className="split-gap">
                          <div className="gap-line" />
                          <div className="gap-chip">
                            <Icon name="scissor" className="ic ic-sm" />
                            分割 — PART {splitAfter.filter((x) => x < i).length + 1}
                            <span className="pill">新しいPDF</span>
                          </div>
                          <div className="gap-line" />
                        </div>
                      )}

                      <PdfPageView
                        slot={slot}
                        docs={docs}
                        zoom={zoom}
                        viewerWidth={viewerWidth}
                        pageNumber={i + 1}
                        totalPages={slots.length}
                        sourceLabel={mergedSections ? docById(slot.srcDocId)?.name.replace(/\.pdf$/i, "") : null}
                        selectable={mode === "replace" || mode === "print"}
                        selected={mode === "replace" && replaceTarget === i}
                        replacing={mode === "replace" && replaceTarget === i}
                        dimmed={mode === "print" && printOff.has(i)}
                        hideForPrint={mode === "print" && printOff.has(i)}
                        onClick={() => {
                          if (mode === "replace") handleReplaceTargetClick(i);
                          else if (mode === "print") togglePrintExclude(i);
                        }}
                        badge={slot.replacedBy ? (
                          <span className="page-badge-pill">差し替え済</span>
                        ) : null}
                      />

                      {mode === "replace" && replaceTarget === i && (
                        <ReplacePicker
                          docs={docs}
                          onPick={applyReplace}
                          onCancel={() => setReplaceTarget(null)}
                          onAddFiles={(f) => ingestFiles(f)}
                        />
                      )}

                      {mode === "split" && i < slots.length - 1 && (
                        <SplitMarker
                          armed={splitAfter.includes(i)}
                          onClick={() =>
                            setSplitAfter((prev) =>
                              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)
                            )
                          }
                        />
                      )}
                    </PageBlock>
                  );
                })}
              </div>
            </div>

            <div className="zoom-rail">
              <button
                onClick={() => adjustZoom(-ZOOM_STEP)}
                className="tt"
                data-tt={`縮小 (-${ZOOM_STEP}%)`}
                disabled={zoom <= ZOOM_MIN}
              >
                <Icon name="zoomOut" className="ic ic-sm" />
              </button>
              <div className="zoom-val">{zoom}%</div>
              <button
                onClick={() => adjustZoom(ZOOM_STEP)}
                className="tt"
                data-tt={`拡大 (+${ZOOM_STEP}%)`}
                disabled={zoom >= ZOOM_MAX}
              >
                <Icon name="zoomIn" className="ic ic-sm" />
              </button>
              <div style={{ width: 1, height: 18, background: "#e8f0f9", margin: "0 2px" }} />
              <button
                onClick={() => setZoom(ZOOM_DEFAULT)}
                className="tt zoom-fit"
                data-tt="幅にフィット"
                disabled={zoom === ZOOM_DEFAULT}
              >
                <span style={{ fontSize: 11, fontWeight: 600 }}>100%</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT — thumbnails */}
      {hasFile ? (
        <Thumbpane
          slots={slots}
          docs={docs}
          currentPage={currentPage}
          onJump={jumpToPage}
          mode={mode}
          printOff={printOff}
          onTogglePrint={togglePrintExclude}
          splitAfter={splitAfter}
          replaceTarget={replaceTarget}
          sourceLabelFor={sourceLabelFor}
          listRef={thumbListRef}
          onListScroll={onThumbListScroll}
        />
      ) : (
        <div className="thumbpane">
          <div className="thumbpane-head">
            <div className="thumbpane-title">ページ</div>
          </div>
          <div className="tp-empty" style={{ marginTop: 20 }}>
            ファイルをアップロードしてください
          </div>
        </div>
      )}

      {/* BOTTOM action bar */}
      <ActionBar
        hasFile={hasFile}
        mode={mode}
        mergeOrder={mergeOrder}
        splitAfter={splitAfter}
        printOff={printOff}
        pageCount={slots.length}
        currentPage={currentPage}
        onConfirmMerge={confirmMerge}
        onConfirmSplit={confirmSplit}
        onConfirmPrint={() => setShowPrintModal(true)}
        onDownload={downloadCurrent}
        onCancel={() => setMode("view")}
        replaceTarget={replaceTarget}
        onSelectAllPrint={() => setPrintOff(new Set())}
        onClearAllPrint={() => setPrintOff(new Set(slots.map((_, i) => i)))}
        onSplitAll={() => setSplitAfter(Array.from({ length: Math.max(0, slots.length - 1) }, (_, i) => i))}
        onSplitClear={() => setSplitAfter([])}
      />

      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast"><span className="dot-good" />{t.text}</div>
        ))}
      </div>

      {showPrintModal && (
        <PrintModal
          totalPages={slots.length}
          excludeCount={printOff.size}
          onCancel={() => setShowPrintModal(false)}
          onPrint={printActive}
        />
      )}

      {busy && (
        <div className="busy-veil">
          <div className="busy-card">
            <div className="busy-spinner" />
            <div>{busy}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components (kept in App.tsx for proximity)
// ------------------------------------------------------------------

function PageBlock({ children }: { index: number; children: React.ReactNode }) {
  return <>{children}</>;
}

function ModeHint({
  mode, mergeCount, splitCount, printCount, replaceTarget,
}: {
  mode: ModeId; mergeCount: number; splitCount: number; printCount: number; replaceTarget: number | null;
}) {
  if (mode === "view") return null;
  const map: Record<Exclude<ModeId, "view">, { label: string; icon: "merge" | "split" | "print" | "replace" }> = {
    merge:   { label: `結合キューにファイルを追加して順序を決めます (${mergeCount} 件選択中)`, icon: "merge" },
    split:   { label: `ページの間にカーソルを合わせて分割位置を指定 (${splitCount} 箇所)`, icon: "split" },
    print:   { label: `印刷したくないページをクリックして除外 (${printCount} ページが印刷対象)`, icon: "print" },
    replace: { label: replaceTarget === null ? "差し替えたいページをクリックして選択" : "下のピッカーから差し替え後のページを選択", icon: "replace" },
  };
  const m = map[mode];
  return (
    <div className="mode-hint">
      <div className="mh-dot"><Icon name={m.icon} className="ic" style={{ width: 10, height: 10 }} /></div>
      {m.label}
    </div>
  );
}

function SplitMarker({ armed, onClick }: { armed: boolean; onClick: () => void }) {
  return (
    <div className="split-marker">
      <div className={`scissor-line${armed ? " armed" : ""}`} />
      <button className={`scissor-btn${armed ? " armed" : ""}`} onClick={onClick}>
        <Icon name="scissor" className="ic ic-sm" />
        {armed ? "ここで分割" : "ここを分割"}
      </button>
    </div>
  );
}

function ActionBar({
  hasFile, mode, mergeOrder, splitAfter, printOff, pageCount, currentPage,
  onConfirmMerge, onConfirmSplit, onConfirmPrint, onDownload, onCancel, replaceTarget,
  onSelectAllPrint, onClearAllPrint, onSplitAll, onSplitClear,
}: {
  hasFile: boolean;
  mode: ModeId;
  mergeOrder: string[];
  splitAfter: number[];
  printOff: Set<number>;
  pageCount: number;
  currentPage: number;
  onConfirmMerge: () => void;
  onConfirmSplit: () => void;
  onConfirmPrint: () => void;
  onDownload: () => void;
  onCancel: () => void;
  replaceTarget: number | null;
  onSelectAllPrint: () => void;
  onClearAllPrint: () => void;
  onSplitAll: () => void;
  onSplitClear: () => void;
}) {
  const themes: Record<ModeId, { bg: string; color: string }> = {
    view:    { bg: "linear-gradient(140deg,#efece8,#c8c3bd)", color: "#57534e" },
    merge:   { bg: "linear-gradient(140deg,#fed7c0,#fbbb98)", color: "#c2664b" },
    split:   { bg: "linear-gradient(140deg,#c4eed8,#8ed8b1)", color: "#427a5c" },
    print:   { bg: "linear-gradient(140deg,#d9ceff,#b8a4f5)", color: "#6b4fb8" },
    replace: { bg: "linear-gradient(140deg,#fde6a8,#f4c873)", color: "#a8761f" },
  };

  if (!hasFile) {
    return (
      <div className="actionbar">
        <div className="action-text">
          <span className="lead-bubble" style={{ background: "linear-gradient(140deg,#fbbb98,#b8a4f5)" }}>
            <Icon name="upload" className="ic" />
          </span>
          <span>ファイルをアップロードしてください</span>
        </div>
        <div className="action-spacer" />
      </div>
    );
  }

  const Lead = ({ kind, label, body }: { kind: ModeId; label: string; body: React.ReactNode }) => (
    <div className="action-text">
      <span className="lead-bubble" style={{ background: themes[kind].bg, color: themes[kind].color }}>
        <Icon name={MODES.find((m) => m.id === kind)!.icon} className="ic" />
      </span>
      <span>{label} <strong>{body}</strong></span>
    </div>
  );

  if (mode === "view") {
    return (
      <div className="actionbar">
        <Lead kind="view" label="閲覧中" body={<>ページ {currentPage} / {pageCount}</>} />
        <div className="action-spacer" />
        <button className="btn ghost" onClick={onDownload}>
          <Icon name="download" className="ic" />ダウンロード
        </button>
        <button className="btn primary" onClick={onConfirmPrint}>
          <Icon name="print" className="ic" />印刷
        </button>
      </div>
    );
  }
  if (mode === "merge") {
    return (
      <div className="actionbar">
        <Lead kind="merge" label="結合モード" body={<>{mergeOrder.length} ファイル選択中</>} />
        <div className="action-spacer" />
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn merge" disabled={mergeOrder.length < 1} onClick={onConfirmMerge}>
          <Icon name="merge" className="ic" />結合する
        </button>
      </div>
    );
  }
  if (mode === "split") {
    const allMarked = pageCount > 1 && splitAfter.length === pageCount - 1;
    return (
      <div className="actionbar">
        <Lead kind="split" label="分割モード" body={<>{splitAfter.length + 1} 個のPDFに分割</>} />
        <div className="action-spacer" />
        <button
          className="btn ghost"
          onClick={onSplitAll}
          disabled={pageCount < 2 || allMarked}
          title="すべてのページ間に分割線を入れる"
        >
          <Icon name="scissor" className="ic" />全て分割
        </button>
        <button className="btn ghost" onClick={onSplitClear} disabled={splitAfter.length === 0}>
          すべて解除
        </button>
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn split" disabled={splitAfter.length === 0} onClick={onConfirmSplit}>
          <Icon name="scissor" className="ic" />分割して保存
        </button>
      </div>
    );
  }
  if (mode === "print") {
    const will = pageCount - printOff.size;
    return (
      <div className="actionbar">
        <Lead kind="print" label="印刷モード" body={<>{will} / {pageCount} ページを印刷</>} />
        <div className="action-spacer" />
        <button className="btn ghost" onClick={onClearAllPrint}>すべて除外</button>
        <button className="btn ghost" onClick={onSelectAllPrint}>すべて印刷</button>
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn primary" disabled={will === 0} onClick={onConfirmPrint}>
          <Icon name="print" className="ic" />印刷プレビュー
        </button>
      </div>
    );
  }
  if (mode === "replace") {
    return (
      <div className="actionbar">
        <Lead
          kind="replace"
          label="差し替えモード"
          body={replaceTarget === null ? "ページを選択してください" : <>ページ {replaceTarget + 1} を差し替え</>}
        />
        <div className="action-spacer" />
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
      </div>
    );
  }
  return null;
}

function deriveFilename(prefix: string) {
  const d = new Date();
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `marin_${prefix}_${ts}.pdf`;
}
function pad(n: number) { return String(n).padStart(2, "0"); }

function enumeratePages(doc: DocSource): PageSlot[] {
  return Array.from({ length: doc.pageCount }, (_, i) => ({ srcDocId: doc.id, srcPageIndex: i }));
}
