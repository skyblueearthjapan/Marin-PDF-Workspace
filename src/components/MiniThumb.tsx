import { useEffect, useRef, useState } from "react";
import type { DocSource, PageSlot } from "../types";
import { renderThumbnailHandle } from "../pdf/renderer";

interface Props {
  slot: PageSlot;
  docs: DocSource[];
}

const cache = new Map<string, string>();
const key = (id: string, idx: number) => `${id}#${idx}`;

export default function MiniThumb({ slot, docs }: Props) {
  const effective = slot.replacedBy ?? slot;
  const doc = docs.find((d) => d.id === effective.srcDocId);
  const rotation = slot.rotation ?? 0;
  const cacheKey = doc ? `${key(doc.id, effective.srcPageIndex)}@${rotation}` : "";
  const initial = cacheKey ? cache.get(cacheKey) ?? null : null;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(initial);
  const [visible, setVisible] = useState<boolean>(initial !== null);

  useEffect(() => {
    if (initial !== null) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [initial]);

  useEffect(() => {
    if (!doc) return;
    const cached = cache.get(cacheKey);
    if (cached) { setSrc(cached); return; }
    if (!visible) return;
    let cancelled = false;
    const h = renderThumbnailHandle(doc.pdf, effective.srcPageIndex, 110, rotation);
    h.promise
      .then((url) => {
        cache.set(cacheKey, url);
        if (!cancelled) setSrc(url);
      })
      .catch(() => { /* aborted or failed silently */ });
    return () => {
      cancelled = true;
      h.cancel();
    };
  }, [doc, effective.srcPageIndex, rotation, cacheKey, visible]);

  return (
    <div ref={wrapRef} className={`mini-page-thumb${slot.replacedBy ? " replaced" : ""}`}>
      {src ? <img src={src} alt="" className="thumb-img" /> : <div className="thumb-skel" />}
    </div>
  );
}
