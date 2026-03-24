import React from "react";

/* ── SVG icon factory ─────────────────────────────────────────────── */
const icon = (children) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS = {
  home: icon(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  accounts: icon(<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>),
  activity: icon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
  settings: icon(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
  reps: icon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  manage: icon(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
  export: icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
  users: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>),
};

/* ── Rep menu items ───────────────────────────────────────────────── */
export const REP_MENU_ITEMS = [
  { key: "home",     label: "Home",     path: "/home",         icon: ICONS.home },
  { key: "accounts", label: "Accounts", path: "/accounts",     icon: ICONS.accounts },
  { key: "activity", label: "Activity", path: "/activities",   icon: ICONS.activity },
  { key: "settings", label: "Settings", path: "/rep/settings", icon: ICONS.settings },
];

export const REP_DEFAULT_ORDER = ["home", "accounts", "activity", "settings"];
export const REP_STORAGE_KEY = "mobile_menu_order_rep";

/* ── Manager menu items ───────────────────────────────────────────── */
export const MGR_MENU_ITEMS = [
  { key: "home",       label: "Home",            path: "/dashboard",            icon: ICONS.home },
  { key: "accounts",   label: "Accounts",        path: "/dashboard/accounts",   icon: ICONS.accounts },
  { key: "reps",       label: "Reps",            path: "/dashboard/reps",       icon: ICONS.reps },
  { key: "activities", label: "Activities",       path: "/dashboard/activities", icon: ICONS.activity },
  { key: "manage",     label: "Manage Accounts", path: "/manage",               icon: ICONS.manage },
  { key: "export",     label: "Export Reports",   path: "/dashboard/export",     icon: ICONS.export },
  { key: "users",      label: "User Management", path: "/dashboard/users",      icon: ICONS.users },
  { key: "settings",   label: "Settings",        path: "/dashboard/settings",   icon: ICONS.settings },
];

export const MGR_DEFAULT_ORDER = ["home", "accounts", "reps", "activities", "manage", "export", "users", "settings"];
export const MGR_STORAGE_KEY = "mobile_menu_order_manager";

/* ── Helpers ──────────────────────────────────────────────────────── */
export function getOrderedItems(items, defaultOrder, storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const order = JSON.parse(saved);
      const itemMap = Object.fromEntries(items.map(i => [i.key, i]));
      // filter out any stale keys, append any new keys
      const ordered = order.filter(k => itemMap[k]).map(k => itemMap[k]);
      const missing = items.filter(i => !order.includes(i.key));
      return [...ordered, ...missing];
    }
  } catch { /* fall through */ }
  const itemMap = Object.fromEntries(items.map(i => [i.key, i]));
  return defaultOrder.map(k => itemMap[k]);
}

export function saveOrder(storageKey, orderedKeys) {
  localStorage.setItem(storageKey, JSON.stringify(orderedKeys));
  window.dispatchEvent(new CustomEvent("mobile-menu-updated"));
}
