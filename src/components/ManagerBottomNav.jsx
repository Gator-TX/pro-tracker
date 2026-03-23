import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const NAV_ITEMS = [
  {
    label: "Home",
    path: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: "Accounts",
    path: "/dashboard/accounts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    label: "Reps",
    path: "/dashboard/reps",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "Menu",
    path: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
];

const SHEET_ITEMS = [
  { label: "Activities", path: "/dashboard/activities" },
  { label: "Manage Accounts", path: "/manage" },
  { label: "Export Reports", path: "/dashboard/export" },
  { label: "User Management", path: "/dashboard/users" },
  { label: "Settings", path: "/dashboard/settings" },
];

export default function ManagerBottomNav({ activePath }) {
  const navigate = useNavigate();
  const [showSheet, setShowSheet] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <style>{`
        .mgr-bottom-nav { display: none; }
        @keyframes mgr-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .main-content {
            padding-bottom: calc(95px + env(safe-area-inset-bottom)) !important;
          }
          .mgr-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: calc(85px + env(safe-area-inset-bottom));
            padding-bottom: calc(env(safe-area-inset-bottom) + 12px);
            background: #ffffff;
            border-top: 1px solid #E8E8E6;
            z-index: 150;
            align-items: stretch;
          }
          .mgr-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            background: none;
            border: none;
            cursor: pointer;
            font-family: 'DM Sans', sans-serif;
            padding: 8px 0 0;
            transition: color 0.15s;
          }
          .mgr-nav-label {
            font-size: 11px;
            font-weight: 500;
          }
          .mgr-sheet-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 200;
          }
          .mgr-sheet {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: #fff;
            border-radius: 16px 16px 0 0;
            z-index: 250;
            padding: 0 0 calc(16px + env(safe-area-inset-bottom));
            animation: mgr-slide-up 0.25s ease;
          }
          .mgr-sheet-handle {
            width: 36px; height: 4px;
            background: #E0E0DC; border-radius: 2px;
            margin: 12px auto 16px;
          }
          .mgr-sheet-item {
            display: block; width: 100%;
            padding: 14px 20px;
            text-align: left;
            background: none; border: none;
            border-bottom: 1px solid #F0F0ED;
            font-size: 15px; font-weight: 500; color: #374151;
            font-family: 'DM Sans', sans-serif;
            cursor: pointer;
          }
          .mgr-sheet-signout {
            display: block; width: 100%;
            padding: 14px 20px;
            text-align: left;
            background: none; border: none;
            font-size: 15px; font-weight: 500; color: #DC2626;
            font-family: 'DM Sans', sans-serif;
            cursor: pointer;
          }
        }
      `}</style>

      <nav className="mgr-bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.label}
            className="mgr-nav-item"
            style={{ color: item.path === activePath ? "#367C2B" : "#767676" }}
            onClick={() => item.path ? navigate(item.path) : setShowSheet(true)}
          >
            {item.icon}
            <span className="mgr-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {showSheet && (
        <>
          <div className="mgr-sheet-overlay" onClick={() => setShowSheet(false)} />
          <div className="mgr-sheet">
            <div className="mgr-sheet-handle" />
            {SHEET_ITEMS.map(item => (
              <button
                key={item.path}
                className="mgr-sheet-item"
                style={{ color: item.path === activePath ? "#367C2B" : "#374151" }}
                onClick={() => { navigate(item.path); setShowSheet(false); }}
              >
                {item.label}
              </button>
            ))}
            <button className="mgr-sheet-signout" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </>
      )}
    </>
  );
}
