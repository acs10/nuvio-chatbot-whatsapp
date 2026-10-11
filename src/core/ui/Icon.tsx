import type { ReactNode } from "react";

export type IconName = "arrow" | "bot" | "check" | "chevron" | "clock" | "company" | "conversation" | "dashboard" | "document" | "eye" | "help" | "integration" | "menu" | "message" | "money" | "people" | "play" | "plus" | "search" | "send" | "settings" | "sparkle" | "trend" | "user" | "whatsapp" | "x" | "trash" | "edit" | "logout" | "upload" | "alert" | "refresh" | "globe" | "calendar" | "link" | "lock"

/* Ícones do design (Figma Make) + alguns extras no mesmo traço. */
const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  bot: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="4" />
      <path d="M9 12h.01M15 12h.01M9 16h6M12 7V4m0 0 2 2m-2-2-2 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  company: (
    <>
      <path d="M4 21V8l8-4 8 4v13" />
      <path d="M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01" />
    </>
  ),
  conversation: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  document: (
    <>
      <path d="M6 2h9l4 4v16H6Z" />
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.3 2.3 0 1 1 3.1 2.15c-.9.4-.9.85-.9 1.85M12 17h.01" />
    </>
  ),
  integration: (
    <>
      <path d="m8 12 3 3 5-6" />
      <path d="M6 4v3M4.5 5.5h3M18 17v3m-1.5-1.5h3" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H9l-6 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </>
  ),
  money: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 15h.01M17 9h.01M9 12h6" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M16 4a3 3 0 0 1 0 6M18 13a4 4 0 0 1 3 4v3" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  send: <path d="m22 2-7 20-4-9-9-4Zm-11 11L22 2" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06-2.76 2.76-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1 1.64V21H10v-.09a1.8 1.8 0 0 0-1-1.64 1.8 1.8 0 0 0-2 .36l-.06.06-2.76-2.76.06-.06a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.64-1H3V10h.09a1.8 1.8 0 0 0 1.64-1 1.8 1.8 0 0 0-.36-2l-.06-.06 2.76-2.76.06.06a1.8 1.8 0 0 0 2 .36 1.8 1.8 0 0 0 1-1.64V3H14v.09a1.8 1.8 0 0 0 1 1.64 1.8 1.8 0 0 0 2-.36l.06-.06 2.76 2.76-.06.06a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.64 1H21V14h-.09a1.8 1.8 0 0 0-1.51 1Z" />
    </>
  ),
  sparkle: (
    <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z" />
  ),
  trend: <path d="m3 17 6-6 4 4 8-9M15 6h6v6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.45L3 20.5l1.4-4.72A8.5 8.5 0 1 1 20.5 11.6Z" />
      <path d="M8.2 7.7c.2-.45.4-.46.7-.47h.6c.18 0 .36.07.47.34l.72 1.73c.1.27.04.47-.1.65l-.52.64c-.16.18-.3.34-.13.63.17.3.75 1.2 1.62 1.94 1.1.98 2.03 1.28 2.33 1.43.29.15.46.13.64-.08l.98-1.14c.2-.24.42-.2.7-.1l1.66.78c.3.15.5.22.56.34.07.12.07.7-.16 1.36-.22.65-1.3 1.25-1.78 1.32" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  trash: (<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>),
  edit: (<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>),
  logout: (<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>),
  upload: (<><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v4h16v-4" /></>),
  alert: (<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>),
  refresh: (<><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {iconPaths[name]}
    </svg>
  );
}
