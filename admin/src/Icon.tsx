// Компактные монохромные line-иконки (stroke = currentColor), чтобы активный
// пункт подсвечивался золотом, а неактивный — серым. Совпадает с духом макета.

const P: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  constructor: <><rect x="3" y="3" width="8" height="5" rx="1.5" /><rect x="3" y="11" width="8" height="10" rx="1.5" /><rect x="14" y="3" width="7" height="10" rx="1.5" /><rect x="14" y="16" width="7" height="5" rx="1.5" /></>,
  tariff: <><path d="M20 12l-8 8-9-9V4h7z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  levels: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  tasks: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" /></>,
  bonus: <><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></>,
  payments: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></>,
  collections: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  materials: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9l5 3-5 3z" /></>,
  events: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9h17M8 3v4M16 3v4" /></>,
  gift: <><rect x="4" y="9" width="16" height="12" rx="1.5" /><path d="M2.5 9h19v3.5h-19zM12 9v12M12 9s-2.5-6-5-4 1.5 4 5 4c3.5 0 6-2 5-4s-5 4-5 4z" /></>,
  link: <><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
  magnet: <><path d="M6 3v8a6 6 0 0012 0V3h-4v8a2 2 0 01-4 0V3z" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 5.2a3 3 0 010 5.6M17 14.7c2.3.6 3.8 2.5 3.8 5" /></>,
  leaders: <><path d="M6 21V11M12 21V4M18 21v-6" /></>,
  referrals: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  mail: <><path d="M21 4L3 11l6 2.5L21 4zM9 13.5V20l3.5-4" /></>,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 20a2 2 0 01-3.4 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" /></>,
}

export default function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {P[name] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  )
}
