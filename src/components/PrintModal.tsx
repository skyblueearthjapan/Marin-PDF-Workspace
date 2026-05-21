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
  const parts = text.split(/[,、，\s]+/).filter(Boolean);
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

  return (
    <div className="modal-veil" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>印刷プレビュー</h3>
        <div style={{ fontSize: 13, color: "#78716c", marginTop: -8 }}>
          範囲を選んでブラウザのプレビューに送信します
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

        <div className="modal-row">
          <span>印刷ページ数</span>
          <strong style={{ color: "#6b4fb8", fontVariantNumeric: "tabular-nums" }}>
            {willPrint} / {totalPages} ページ
          </strong>
        </div>

        {printOff.size > 0 && (
          <div className="modal-row" style={{ fontSize: 12, color: "#a8a29e" }}>
            <span>除外設定</span>
            <span>{printOff.size} ページが「印刷対象外」</span>
          </div>
        )}

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
