import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import logo from "../assets/uatprologo.png";

const MANAGER_NAV = [
  { key: "home",       label: "Home",            path: "/dashboard" },
  { key: "accounts",   label: "Accounts",        path: "/dashboard/accounts" },
  { key: "activities", label: "Activities",       path: "/dashboard/activities" },
  { key: "reps",       label: "Sales Reps",       path: "/dashboard/reps" },
  { key: "manage",     label: "Manage Accounts",  path: "/manage" },
  { key: "export",     label: "Export Reports",   path: "/dashboard/export" },
  { key: "users",      label: "User Management",  path: "/dashboard/users" },
  { key: "settings",   label: "Settings",         path: "/dashboard/settings" },
];

const REP_NAV = [
  { key: "home",     label: "Home",        path: "/home" },
  { key: "accounts", label: "My Accounts", path: "/accounts" },
  { key: "activity", label: "Activities",  path: "/activities" },
  { key: "settings", label: "Settings",    path: "/rep/settings" },
];

const STORAGE_KEYS = { manager: "sidebar_order_manager", rep: "sidebar_order_rep" };

function getOrderedNav(role) {
  const defaults = role === "manager" ? MANAGER_NAV : REP_NAV;
  const storageKey = STORAGE_KEYS[role];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const order = JSON.parse(saved);
      const map = Object.fromEntries(defaults.map(i => [i.key, i]));
      const ordered = order.filter(k => map[k]).map(k => map[k]);
      const missing = defaults.filter(i => !order.includes(i.key));
      return [...ordered, ...missing];
    }
  } catch { /* fall through */ }
  return defaults;
}

function saveNavOrder(role, keys) {
  localStorage.setItem(STORAGE_KEYS[role], JSON.stringify(keys));
}

export default function Sidebar({ role, profile, onSignOut, activePath }) {
  const navigate = useNavigate();
  const [navItems, setNavItems] = useState(() => getOrderedNav(role));
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const dragStartY = useRef(null);
  const didDrag = useRef(false);

  useEffect(() => {
    setNavItems(getOrderedNav(role));
  }, [role]);

  const handleDragStart = useCallback((e, index) => {
    dragStartY.current = e.clientY;
    didDrag.current = false;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // make the drag image semi-transparent
    if (e.target) {
      e.dataTransfer.setDragImage(e.target, e.target.offsetWidth / 2, 18);
    }
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragStartY.current !== null && Math.abs(e.clientY - dragStartY.current) > 4) {
      didDrag.current = true;
    }
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...navItems];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setNavItems(next);
    saveNavOrder(role, next.map(i => i.key));
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, navItems, role]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragStartY.current = null;
  }, []);

  const handleClick = useCallback((e, path) => {
    if (didDrag.current) {
      e.preventDefault();
      return;
    }
    navigate(path);
  }, [navigate]);

  return (
    <>
      <style>{`
        .sidebar-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 16px; border-radius: 6px;
          font-size: 14px; font-weight: 500; color: #374151;
          cursor: pointer; transition: all 0.15s;
          border: none; background: none; width: 100%;
          font-family: 'DM Sans', sans-serif;
          border-left: 3px solid transparent;
          text-align: left;
          position: relative;
        }
        .sidebar-nav-item:hover { background: #F5F5F3; }
        .sidebar-nav-item.active {
          border-left-color: #367C2B; font-weight: 600;
        }
        .sidebar-nav-item .grip {
          color: #CCCCCC; font-size: 12px; letter-spacing: 1px;
          cursor: grab; user-select: none; margin-right: 2px;
          transition: color 0.15s;
        }
        .sidebar-nav-item:hover .grip { color: #999999; }
        .sidebar-nav-item.dragging { opacity: 0.4; }
        .sidebar-nav-item.drop-above { border-top: 2px solid #367C2B; border-top-left-radius: 0; border-top-right-radius: 0; }
        @media (max-width: 768px) {
          .sidebar-shell { display: none !important; }
        }
      `}</style>

      <div className="sidebar-shell" style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <img
            src={logo}
            alt="United Ag & Turf"
            style={styles.sidebarLogoImg}
            onClick={() => navigate(role === "rep" ? "/accounts" : "/dashboard")}
          />
          <div style={styles.logoAccent} />
        </div>

        <nav style={styles.nav}>
          {navItems.map((item, index) => (
            <button
              key={item.key}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={
                "sidebar-nav-item" +
                (item.path === activePath ? " active" : "") +
                (dragIndex === index ? " dragging" : "") +
                (overIndex === index && dragIndex !== null && dragIndex !== index ? " drop-above" : "")
              }
              onClick={(e) => handleClick(e, item.path)}
            >
              <span className="grip">⠿</span>
              {item.label}
            </button>
          ))}
        </nav>

        <a
          href="https://unitedpro.org"
          target="_blank"
          rel="noreferrer"
          style={styles.backToCrm}
          onClick={async (e) => {
            e.preventDefault();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              window.open(`https://unitedpro.org/auth?access_token=${session.access_token}&refresh_token=${session.refresh_token}`, "_blank");
            } else {
              window.open("https://unitedpro.org", "_blank");
            }
          }}
        >
          ← Back to CRM
        </a>
        <div style={styles.sidebarFooter} />
      </div>
    </>
  );
}

const styles = {
  sidebar: {
    width: "220px", flexShrink: 0, backgroundColor: "#ffffff",
    borderRight: "0.5px solid #E8E8E6", display: "flex", flexDirection: "column",
    position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 20,
  },
  sidebarLogo: { padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: "12px" },
  sidebarLogoImg: { width: "160px", objectFit: "contain", cursor: "pointer" },
  logoAccent: { height: "3px", backgroundColor: "#FFDE00", borderRadius: "2px", width: "160px" },
  nav: { flex: 1, padding: "16px 8px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" },
  backToCrm: {
    fontSize: "12px", color: "#767676", textDecoration: "none",
    display: "flex", alignItems: "center", gap: "6px",
    padding: "8px 16px", borderTop: "1px solid #E8E8E6", marginTop: "8px",
    fontFamily: "'DM Sans', sans-serif",
  },
  sidebarFooter: { padding: "16px", borderTop: "1px solid #E8E8E6" },
};
