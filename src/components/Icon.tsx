import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "view" | "merge" | "split" | "print" | "replace"
  | "plus" | "check" | "upload" | "download" | "scissor"
  | "arrowRight" | "arrowLeft" | "zoomIn" | "zoomOut" | "rotate"
  | "settings" | "help" | "trash" | "close" | "grip" | "search"
  | "undo" | "redo";

interface Props {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}

export default function Icon({ name, className = "ic", style }: Props) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, ReactNode> = {
    view: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" {...common}/><circle cx="12" cy="12" r="3" {...common}/></>,
    merge: <><path d="M7 4v6c0 2 2 3 4 3h2c2 0 4 1 4 3v4" {...common}/><path d="M17 4v6c0 2-2 3-4 3" {...common}/><path d="M14 17l3 3 3-3" {...common}/></>,
    split: <><path d="M12 4v6" {...common}/><path d="M12 14v6" {...common}/><path d="M5 10c0 2 3 2 7 2s7 0 7-2" {...common}/><circle cx="5" cy="18" r="2" {...common}/><circle cx="19" cy="18" r="2" {...common}/></>,
    print: <><path d="M6 9V4h12v5" {...common}/><rect x="3" y="9" width="18" height="8" rx="2" {...common}/><path d="M6 14h12v6H6z" {...common}/><circle cx="17" cy="12" r="0.6" fill="currentColor" stroke="none"/></>,
    replace: <><path d="M3 7h11l-3-3" {...common}/><path d="M3 7l3 3" {...common}/><path d="M21 17H10l3 3" {...common}/><path d="M21 17l-3-3" {...common}/></>,
    plus: <><path d="M12 5v14M5 12h14" {...common}/></>,
    check: <><path d="M5 12l4 4 10-10" {...common} strokeWidth={2.4}/></>,
    upload: <><path d="M12 4v12" {...common}/><path d="M7 9l5-5 5 5" {...common}/><path d="M4 18v2h16v-2" {...common}/></>,
    download: <><path d="M12 4v12" {...common}/><path d="M7 11l5 5 5-5" {...common}/><path d="M4 20h16" {...common}/></>,
    scissor: <><circle cx="6" cy="6" r="3" {...common}/><circle cx="6" cy="18" r="3" {...common}/><path d="M20 4 8.5 15.5M14 12l6 8M8.5 8.5 14 12" {...common}/></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" {...common}/></>,
    arrowLeft: <><path d="M19 12H5M11 18l-6-6 6-6" {...common}/></>,
    zoomIn: <><circle cx="11" cy="11" r="6" {...common}/><path d="m20 20-3.5-3.5M8 11h6M11 8v6" {...common}/></>,
    zoomOut: <><circle cx="11" cy="11" r="6" {...common}/><path d="m20 20-3.5-3.5M8 11h6" {...common}/></>,
    rotate: <><path d="M21 12a9 9 0 1 1-3-6.7" {...common}/><path d="M21 4v5h-5" {...common}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...common}/><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1.1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.6-1.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.4 1.7 1.7 0 0 0 1.1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.4 1.9 1.7 1.7 0 0 0 1.6 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1.1Z" {...common}/></>,
    help: <><circle cx="12" cy="12" r="9" {...common}/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" {...common}/><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...common}/></>,
    close: <><path d="M6 6l12 12M18 6 6 18" {...common}/></>,
    grip: <><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/></>,
    search: <><circle cx="11" cy="11" r="6" {...common}/><path d="m20 20-3.5-3.5" {...common}/></>,
    undo: <><path d="M9 14l-4-4 4-4" {...common}/><path d="M5 10h9a5 5 0 0 1 0 10h-2" {...common}/></>,
    redo: <><path d="M15 14l4-4-4-4" {...common}/><path d="M19 10h-9a5 5 0 0 0 0 10h2" {...common}/></>,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
