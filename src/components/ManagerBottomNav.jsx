import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { MGR_MENU_ITEMS, MGR_DEFAULT_ORDER, MGR_STORAGE_KEY, getOrderedItems } from "../config/mobileMenuItems";

const MENU_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export default function ManagerBottomNav({ activePath }) {
  const navigate = useNavigate();
  const [showSheet, setShowSheet] = useState(false);

  const getItems = useCallback(() => getOrderedItems(MGR_MENU_ITEMS, MGR_DEFAULT_ORDER, MGR_STORAGE_KEY), []);
  const [orderedItems, setOrderedItems] = useState(getItems);

  useEffect(() => {
    const refresh = () => setOrderedItems(getItems());
    window.addEventListener("mobile-menu-updated", refresh);
    return () => window.removeEventListener("mobile-menu-updated", refresh);
  }, [getItems]);

  const navItems = orderedItems.slice(0, 3);
  const sheetItems = orderedItems.slice(3);

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
            display: flex; align-items: center; gap: 12px;
            width: 100%;
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
        {navItems.map(item => (
          <button
            key={item.key}
            className="mgr-nav-item"
            style={{ color: item.path === activePath ? "#367C2B" : "#767676" }}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span className="mgr-nav-label">{item.label}</span>
          </button>
        ))}
        <button
          className="mgr-nav-item"
          style={{ color: showSheet ? "#367C2B" : "#767676" }}
          onClick={() => setShowSheet(true)}
        >
          {MENU_ICON}
          <span className="mgr-nav-label">Menu</span>
        </button>
      </nav>

      {showSheet && (
        <>
          <div className="mgr-sheet-overlay" onClick={() => setShowSheet(false)} />
          <div className="mgr-sheet">
            <div className="mgr-sheet-handle" />
            {sheetItems.map(item => (
              <button
                key={item.key}
                className="mgr-sheet-item"
                style={{ color: item.path === activePath ? "#367C2B" : "#374151" }}
                onClick={() => { navigate(item.path); setShowSheet(false); }}
              >
                {item.icon}
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
