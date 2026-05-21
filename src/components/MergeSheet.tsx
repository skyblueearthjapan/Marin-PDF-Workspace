import { useRef } from "react";
import type { DocSource } from "../types";
import Icon from "./Icon";

interface Props {
  docs: DocSource[];
  mergeOrder: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onReorder: (next: string[]) => void;
  onPickFiles: (files: FileList | null) => void;
}

export default function MergeSheet({
  docs, mergeOrder, onAdd, onRemove, onReorder, onPickFiles,
}: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const inStack = mergeOrder.map((id) => docs.find((d) => d.id === id)).filter((x): x is DocSource => !!x);
  const available = docs.filter((d) => !mergeOrder.includes(d.id));

  function moveItem(from: number, to: number) {
    if (from === to || to < 0 || to >= mergeOrder.length) return;
    const next = mergeOrder.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onReorder(next);
  }

  return (
    <div className="merge-sheet">
      <h4>
        <span className="h-bub"><Icon name="merge" className="ic" /></span>
        ファイルを結合
      </h4>
      <div className="sheet-sub">上から順に結合されます ・ ▲▼で順序変更</div>

      <div
        className="merge-drop"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); onPickFiles(e.dataTransfer.files); }}
      >
        <div className="drop-ic"><Icon name="upload" className="ic ic-lg" /></div>
        ファイルをドロップ または<br />クリックしてアップロード
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onPickFiles(e.target.files)}
        />
      </div>

      <div className="merge-stack-title">結合キュー ・ {inStack.length} 件</div>
      <div className="merge-stack">
        {inStack.length === 0 && <div className="stack-empty">下の最近使用から追加してください</div>}
        {inStack.map((d, i) => (
          <div key={d.id} className="stack-item">
            <div className="order-pill">{i + 1}</div>
            <div className="doc-thumb">
              <div className="l w50" style={{ background: d.accent }} />
              <div className="l w80" />
              <div className="l w65" />
              <div className="l w40" />
            </div>
            <div className="si-info">
              <div className="si-name">{d.name}</div>
              <div className="si-meta">{d.pageCount} ページ</div>
            </div>
            <div className="si-actions">
              <button className="si-arrow" disabled={i === 0} onClick={() => moveItem(i, i - 1)} title="上へ">▲</button>
              <button className="si-arrow" disabled={i === inStack.length - 1} onClick={() => moveItem(i, i + 1)} title="下へ">▼</button>
              <button className="si-remove" onClick={() => onRemove(d.id)} title="削除">
                <Icon name="close" className="ic ic-sm" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <div className="merge-library">
          <div className="lib-title">最近使用したファイル</div>
          {available.map((d) => (
            <div key={d.id} className="lib-item" onClick={() => onAdd(d.id)}>
              <div className="doc-thumb">
                <div className="l w50" style={{ background: d.accent }} />
                <div className="l w80" />
                <div className="l w65" />
                <div className="l w40" />
              </div>
              <div className="li-name">{d.name}</div>
              <div className="li-add"><Icon name="plus" className="ic ic-sm" /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
