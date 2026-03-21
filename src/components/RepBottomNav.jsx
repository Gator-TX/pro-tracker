import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const NAV_ITEMS = [
  {
    label: "Home",
    path: "/home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: "Accounts",
    path: "/accounts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    label: "Activity",
    path: "/activities",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
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
  { label: "Settings", path: "/rep/settings" },
];

export default function RepBottomNav({ activePath }) {
  const navigate = useNavigate();
  const [showSheet, setShowSheet] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <style>{`
        .rep-bottom-nav { display: none; }
        @keyframes rep-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .rep-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: calc(72px + env(safe-area-inset-bottom));
            padding-bottom: env(safe-area-inset-bottom);
            background: #ffffff;
            border-top: 1px solid #E8E8E6;
            z-index: 150;
            align-items: stretch;
          }
          .rep-nav-item {
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
          .rep-nav-label {
            font-size: 11px;
            font-weight: 500;
          }
          .rep-sheet-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 200;
          }
          .rep-sheet {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: #fff;
            border-radius: 16px 16px 0 0;
            z-index: 250;
            padding: 0 0 calc(16px + env(safe-area-inset-bottom));
            animation: rep-slide-up 0.25s ease;
          }
          .rep-sheet-handle {
            width: 36px; height: 4px;
            background: #E0E0DC; border-radius: 2px;
            margin: 12px auto 16px;
          }
          .rep-sheet-item {
            display: block; width: 100%;
            padding: 14px 20px;
            text-align: left;
            background: none; border: none;
            border-bottom: 1px solid #F0F0ED;
            font-size: 15px; font-weight: 500; color: #374151;
            font-family: 'DM Sans', sans-serif;
            cursor: pointer;
          }
          .rep-sheet-signout {
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

      <nav className="rep-bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.label}
            className="rep-nav-item"
            style={{ color: item.path === activePath ? "#367C2B" : "#767676" }}
            onClick={() => item.path ? navigate(item.path) : setShowSheet(true)}
          >
            {item.icon}
            <span className="rep-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {showSheet && (
        <>
          <div className="rep-sheet-overlay" onClick={() => setShowSheet(false)} />
          <div className="rep-sheet">
            <div className="rep-sheet-handle" />
            {SHEET_ITEMS.map(item => (
              <button
                key={item.path}
                className="rep-sheet-item"
                style={{ color: item.path === activePath ? "#367C2B" : "#374151" }}
                onClick={() => { navigate(item.path); setShowSheet(false); }}
              >
                {item.label}
              </button>
            ))}
            <button className="rep-sheet-signout" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </>
      )}
    </>
  );
}
