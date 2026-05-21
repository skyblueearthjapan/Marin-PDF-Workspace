import { useMemo, useState } from "react";

interface Props {
  totalPages: number;
  currentPage: number;
  printOff: Set<number>;
  onCancel: () => void;
  onPrint: (pageIndices: number[]) => void;
}

type RangeMode = "all" | "current" | "custom";

function parseRange(text: string, total: number): number[] {
  // Accept "1-5, 8, 10-15" with hyphen/dash/Japanese variations
  const parts = text.split(/[,、,\s]+/).filter(Boolean);
  const result = new Set<number>();
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:[-－–—〜~](\d+))?$/);
    if (!m) continue;
    const a = Math.max(1, Math.min(total, parseInt(m[1], 10)));
    const b = m[2] ? Math.max(1, Math.min(total, parseInt(m[2], 10))) : a;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) result.add(i - 1);
  }
  return Array.from(result).sort((x, y) => x - y);
}

/** Collapse a sorted list of 0-based indices into a human range string ("1-3, 5, 8-10"). */
function compressRange(indices: number[]): string {
  if (indices.length === 0) return "なし";
  const sorted = [...indices].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] !== prev + 1) {
      parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
      if (i < sorted.length) {
        start = sorted[i];
        prev = sorted[i];
      }
    } else {
      prev = sorted[i];
    }
  }
  return parts.join(", ");
}

function compressRangeTruncated(indices: number[], maxLen = 240): string {
  const full = compressRange(indices);
  if (full.length <= maxLen) return full;
  const cut = full.slice(0, maxLen);
  const lastComma = cut.lastIndexOf(",");
  return (lastComma > 0 ? cut.slice(0, lastComma) : cut) + " ...";
}

export default function PrintModal({ totalPages, currentPage, printOff, onCancel, onPrint }: Props) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("all");
  const [customText, setCustomText] = useState("");

  const selectedIndices = useMemo(() => {
    let candidate: number[];
    if (rangeMode === "all") {
      candidate = Array.from({ length: totalPages }, (_, i) => i);
    } else if (rangeMode === "current") {
      candidate = [Math.max(0, Math.min(totalPages - 1, currentPage - 1))];
    } else {
      candidate = parseRange(customText, totalPages);
    }
    return candidate.filter((i) => !printOff.has(i));
  }, [rangeMode, customText, totalPages, currentPage, printOff]);

  const willPrint = selectedIndices.length;
  const targetRangeText = useMemo(() => compressRangeTruncated(selectedIndices), [selectedIndices]);

  return (
    <div className="modal-veil" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>印刷プレビュー</h3>
        <div style={{ fontSize: 13, color: "#78716c", marginTop: -8 }}>
          範囲を選んでブラウザのプレビューに送信します
        </div>

        <div className={`print-target${willPrint === 0 ? " empty" : ""}`}>
          <div className="pt-head">
            <span className="pt-label">この範囲で印刷します</span>
            <span className="pt-count">{willPrint} / {totalPages} ページ</span>
          </div>
          <div className="pt-value">
            {willPrint === 0 ? "印刷対象がありません" : `p. ${targetRangeText}`}
          </div>
          {printOff.size > 0 && (
            <div className="pt-note">
              印刷モードで除外された {printOff.size} ページは自動で除外されています
            </div>
          )}
        </div>

        <div className="print-range">
          <label className={`range-opt${rangeMode === "all" ? " active" : ""}`}>
            <input
              type="radio"
              name="range"
              checked={rangeMode === "all"}
              onChange={() => setRangeMode("all")}
            />
            <span className="range-opt-label">全てのページ</span>
            <span className="range-opt-meta">{totalPages} ページ</span>
          </label>
          <label className={`range-opt${rangeMode === "current" ? " active" : ""}`}>
            <input
              type="radio"
              name="range"
              checked={rangeMode === "current"}
              onChange={() => setRangeMode("current")}
            />
            <span className="range-opt-label">現在のページのみ</span>
            <span className="range-opt-meta">p.{currentPage}</span>
          </label>
          <label className={`range-opt${rangeMode === "custom" ? " active" : ""}`}>
            <input
              type="radio"
              name="range"
              checked={rangeMode === "custom"}
              onChange={() => setRangeMode("custom")}
            />
            <span className="range-opt-label">ページ範囲を指定</span>
            <span className="range-opt-meta">例: 1-5, 8, 10-15</span>
          </label>
          {rangeMode === "custom" && (
            <input
              type="text"
              className="range-input"
              autoFocus
              placeholder="1-5, 8, 10-15"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
          )}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>キャンセル</button>
          <button className="btn primary" disabled={willPrint === 0} onClick={() => onPrint(selectedIndices)}>
            印刷プレビュー
          </button>
        </div>
      </div>
    </div>
  );
}
