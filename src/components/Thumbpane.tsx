import type { RefObject } from "react";
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
  replaceTarget: number | null;
  sourceLabelFor: (idx: number) => string;
  listRef?: RefObject<HTMLDivElement>;
  onListScroll?: () => void;
}

export default function Thumbpane({
  slots, docs, currentPage, onJump, mode, printOff, onTogglePrint,
  splitAfter, replaceTarget, sourceLabelFor, listRef, onListScroll,
}: Props) {
  const checking = mode === "print";
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
          const isTarget = replaceTarget === i;
          return (
            <div
              key={i}
              className={`thumb-card${cur ? " current" : ""}${checking ? " checking" : ""}${splitAfterThis ? " split-after" : ""}`}
              onClick={() => { if (checking) onTogglePrint(i); else onJump(i); }}
              style={isTarget ? { borderColor: "rgba(244,200,115,0.6)", background: "rgba(254,243,199,0.4)" } : undefined}
            >
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
