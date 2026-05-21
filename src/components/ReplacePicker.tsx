import { useEffect, useRef, useState } from "react";
import type { DocSource } from "../types";
import { renderThumbnailHandle } from "../pdf/renderer";
import Icon from "./Icon";

interface Props {
  docs: DocSource[];
  onPick: (srcDocId: string, srcPageIndex: number) => void;
  onCancel: () => void;
  onAddFiles: (files: FileList | File[] | null) => void;
}

export default function ReplacePicker({ docs, onPick, onCancel, onAddFiles }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const prevLenRef = useRef(docs.length);
  const [pickedDocId, setPickedDocId] = useState<string>(docs[0]?.id ?? "");
  const [dropOver, setDropOver] = useState(false);

  // Auto-select the newly-added doc when docs grows.
  useEffect(() => {
    if (docs.length > prevLenRef.current && docs.length > 0) {
      setPickedDocId(docs[docs.length - 1].id);
    } else if (!docs.find((d) => d.id === pickedDocId) && docs[0]) {
      setPickedDocId(docs[0].id);
    }
    prevLenRef.current = docs.length;
  }, [docs, pickedDocId]);

  const doc = docs.find((d) => d.id === pickedDocId);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    onAddFiles(e.dataTransfer.files);
  };

  return (
    <div className="replace-picker">
      <div className="picker-head">
        <div><strong>差し替え後のページを選択</strong> ・ ファイルから選びます</div>
        <button className="icon-btn" onClick={onCancel} aria-label="閉じる">
          <Icon name="close" className="ic ic-sm" />
        </button>
      </div>

      <div
        className={`replace-drop${dropOver ? " over" : ""}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropOver(true); }}
        onDragLeave={(e) => { e.stopPropagation(); setDropOver(false); }}
        onDrop={onDrop}
      >
        <div className="rd-ic"><Icon name="upload" className="ic ic-sm" /></div>
        <div className="rd-text">
          <strong>差替用 PDF をドロップ</strong>
          <span>クリックして選択 / Ctrl+V で貼り付け も可</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onAddFiles(e.target.files)}
        />
      </div>

      <div className="picker-tabs">
        {docs.map((d) => (
          <button
            key={d.id}
            onClick={() => setPickedDocId(d.id)}
            className={`picker-doc-pill${pickedDocId === d.id ? " active" : ""}`}
          >
            {d.name.replace(/\.pdf$/i, "")}
          </button>
        ))}
        {docs.length === 0 && (
          <div className="picker-empty">差し替え用のPDFを追加してください</div>
        )}
      </div>
      {doc && (
        <div className="picker-row">
          {Array.from({ length: doc.pageCount }, (_, i) => (
            <PickerCard key={i} doc={doc} pageIndex={i} onPick={() => onPick(doc.id, i)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PickerCard({ doc, pageIndex, onPick }: { doc: DocSource; pageIndex: number; onPick: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const h = renderThumbnailHandle(doc.pdf, pageIndex, 110);
    h.promise.then((url) => { if (!cancelled) setSrc(url); }).catch(() => {});
    return () => { cancelled = true; h.cancel(); };
  }, [doc, pageIndex]);
  return (
    <div className="replace-card" onClick={onPick}>
      <div className="mini-page">
        {src ? <img src={src} className="thumb-img" alt="" /> : <div className="thumb-skel" />}
      </div>
      <div className="mini-cap"><span>p.{pageIndex + 1}</span><span>↺</span></div>
    </div>
  );
}
