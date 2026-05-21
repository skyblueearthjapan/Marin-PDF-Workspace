interface Props {
  totalPages: number;
  excludeCount: number;
  onCancel: () => void;
  onPrint: () => void;
}

export default function PrintModal({ totalPages, excludeCount, onCancel, onPrint }: Props) {
  const willPrint = totalPages - excludeCount;
  return (
    <div className="modal-veil" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>印刷プレビュー</h3>
        <div style={{ fontSize: 13, color: "#78716c", marginTop: -8 }}>
          選択したページのみが印刷されます
        </div>
        <div className="modal-row">
          <span>印刷ページ数</span>
          <strong style={{ color: "#6b4fb8", fontVariantNumeric: "tabular-nums" }}>{willPrint} / {totalPages} ページ</strong>
        </div>
        <div className="modal-row">
          <span>備考</span>
          <span style={{ fontSize: 12, color: "#a8a29e" }}>
            ブラウザの印刷ダイアログでプリンター・部数・カラーなどを指定します。
          </span>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>キャンセル</button>
          <button className="btn primary" disabled={willPrint === 0} onClick={onPrint}>
            印刷を実行
          </button>
        </div>
      </div>
    </div>
  );
}
