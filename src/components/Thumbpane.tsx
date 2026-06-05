import { useState, type RefObject } from "react";
import type { DocSource, ModeId, PageSlot } from "../types";
import Icon from "./Icon";
import MiniThumb from "./MiniThumb";

interface Props {
  slots: PageSlot[];
  docs: DocSource[];
  currentPage: number;
  onJump: (idx: number) => void;
  mode: ModeId;
  printOff: Set<number>;
  onTogglePrint: (idx: number) => void;
  splitAfter: number[];
  onToggleSplit: (idx: number) => void;
  replaceTarget: number | null;
  sourceLabelFor: (idx: number) => string;
  listRef?: RefObject<HTMLDivElement>;
  onListScroll?: () => void;
  // -- Arrange mode
  dragPageIdx: number | null;
  onDragStartPage: (idx: number) => void;
  onDragEndPage: () => void;
  onDropBefore: (from: number, before: number) => void;
  onNudgePage: (idx: number, dir: -1 | 1) => void;
  onDeletePage: (idx: number) => void;
}

export default function Thumbpane({
  slots, docs, currentPage, onJump, mode, printOff, onTogglePrint,
  splitAfter, onToggleSplit, replaceTarget, sourceLabelFor, listRef, onListScroll,
  dragPageIdx, onDragStartPage, onDragEndPage, onDropBefore, onNudgePage, onDeletePage,
}: Props) {
  const checking = mode === "print";
  const splitting = mode === "split";
  const arranging = mode === "arrange";
  // Index of the gap currently hovered during a drag (0..slots.length).
  const [dropGap, setDropGap] = useState<number | null>(null);

  // Decide whether the cursor is on the top or bottom half of a card, to pick
  // the gap before or after it.
  const gapForEvent = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? idx : idx + 1;
  };

  const handleDrop = () => {
    if (dragPageIdx != null && dropGap != null) onDropBefore(dragPageIdx, dropGap);
    setDropGap(null);
    onDragEndPage();
  };

  return (
    <div className="thumbpane">
      <div className="thumbpane-head">
        <div className="thumbpane-title">ページ ・ {slots.length}</div>
      </div>
      <div className="thumb-list" ref={listRef} onScroll={onListScroll}>
        {slots.length === 0 && <div className="tp-empty">ページがありません</div>}
        {slots.map((slot, i) => {
          const cur = currentPage === i + 1;
          const off = printOff.has(i);
          const splitAfterThis = splitAfter.includes(i);
          const canSplit = splitting && i < slots.length - 1;
          const isTarget = replaceTarget === i;
          const dragging = arranging && dragPageIdx === i;
          const showGapBefore = arranging && dropGap === i && dragPageIdx !== i && dragPageIdx !== i - 1;
          const showGapAfter = arranging && i === slots.length - 1 && dropGap === slots.length && dragPageIdx !== i;
          return (
            <div key={i}>
              {showGapBefore && <div className="thumb-drop-line" />}
              <div
                className={
                  `thumb-card${cur ? " current" : ""}${checking ? " checking" : ""}` +
                  `${canSplit ? " split-toggle" : ""}${splitAfterThis && canSplit ? " split-after" : ""}` +
                  `${arranging ? " arranging" : ""}${dragging ? " dragging" : ""}`
                }
                draggable={arranging}
                onDragStart={(e) => {
                  if (!arranging) return;
                  e.dataTransfer.effectAllowed = "move";
                  onDragStartPage(i);
                }}
                onDragOver={(e) => {
                  if (!arranging || dragPageIdx == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropGap(gapForEvent(e, i));
                }}
                onDrop={(e) => {
                  if (!arranging) return;
                  e.preventDefault();
                  handleDrop();
                }}
                onDragEnd={() => { setDropGap(null); onDragEndPage(); }}
                onClick={() => {
                  if (arranging) return;
                  if (checking) onTogglePrint(i);
                  else if (canSplit) onToggleSplit(i);
                  else onJump(i);
                }}
                title={
                  arranging ? "ドラッグで並べ替え"
                  : canSplit ? "クリックでここで分割"
                  : undefined
                }
                style={isTarget ? { borderColor: "rgba(244,200,115,0.6)", background: "rgba(254,243,199,0.4)" } : undefined}
              >
                {arranging && (
                  <div className="thumb-grip" aria-hidden="true">
                    <Icon name="grip" className="ic" style={{ width: 14, height: 14 }} />
                  </div>
                )}
                <MiniThumb slot={slot} docs={docs} />
                <div className="meta">
                  <div className="num">{String(i + 1).padStart(2, "0")} / {slots.length}</div>
                  <div className="src">{sourceLabelFor(i)}</div>
                </div>
                {checking && (
                  <div className={`tcheck${!off ? " on" : ""}`}>
                    {!off && <Icon name="check" className="ic" style={{ width: 11, height: 11 }} />}
                  </div>
                )}
                {canSplit && (
                  <div className={`tscissor${splitAfterThis ? " on" : ""}`} aria-hidden="true">
                    <Icon name="scissor" className="ic" style={{ width: 11, height: 11 }} />
                  </div>
                )}
                {arranging && (
                  <div className="thumb-arrange-actions">
                    <button
                      className="taa-btn"
                      disabled={i === 0}
                      onClick={(e) => { e.stopPropagation(); onNudgePage(i, -1); }}
                      title="上へ"
                    >▲</button>
                    <button
                      className="taa-btn"
                      disabled={i === slots.length - 1}
                      onClick={(e) => { e.stopPropagation(); onNudgePage(i, 1); }}
                      title="下へ"
                    >▼</button>
                    <button
                      className="taa-btn del"
                      onClick={(e) => { e.stopPropagation(); onDeletePage(i); }}
                      title="このページを削除"
                    >
                      <Icon name="close" className="ic" style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                )}
              </div>
              {showGapAfter && <div className="thumb-drop-line" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
