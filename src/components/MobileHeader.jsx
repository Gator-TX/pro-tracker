import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import logo from "../assets/uatprologo.png";

const NAV_ITEMS = [
  { label: "My Accounts", path: "/accounts" },
  { label: "Settings", path: "/rep/settings" },
];

export default function MobileHeader({ activePath, profile }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <style>{`
        .mobile-header {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 70px;
            background: #ffffff;
            border-bottom: 1px solid #E8E8E6;
            padding: 0 16px;
            z-index: 100;
          }
        }
      `}</style>

      {/* Fixed top bar — mobile only */}
      <div className="mobile-header">
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          style={styles.hamburger}
          aria-label="Open menu"
        >
          ☰
        </button>

        {/* Centered logo */}
        <img src={logo} alt="UAT Pro" style={styles.headerLogo} />

        {/* Sign out */}
        <button onClick={handleSignOut} style={styles.signOutTopBtn}>
          Sign out
        </button>
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div
          style={styles.overlay}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div style={{
        ...styles.drawer,
        transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
      }}>
        {/* Drawer header */}
        <div style={styles.drawerHeader}>
          <div>
            <img src={logo} alt="UAT Pro" style={styles.drawerLogo} />
            <div style={styles.logoAccent} />
          </div>
          <button onClick={() => setMenuOpen(false)} style={styles.closeBtn} aria-label="Close menu">
            ✕
          </button>
        </div>

        {/* Nav items */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              style={{
                ...styles.navItem,
                ...(item.path === activePath ? styles.navItemActive : {}),
              }}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer: profile name + sign out */}
        <div style={styles.drawerFooter}>
          {profile?.full_name && (
            <p style={styles.drawerName}>{profile.full_name}</p>
          )}
          <button onClick={handleSignOut} style={styles.signOutBtn}>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  hamburger: {
    background: "none", border: "none",
    fontSize: "22px", cursor: "pointer", padding: "4px",
    color: "#1A1A1A", fontFamily: "'DM Sans', sans-serif",
    width: "40px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  headerLogo: {
    height: "54px", objectFit: "contain",
    position: "absolute", left: "50%", transform: "translateX(-50%)",
  },
  overlay: {
    position: "fixed", inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 200,
    display: "block",
  },
  drawer: {
    position: "fixed", top: 0, left: 0, bottom: 0,
    width: "280px",
    backgroundColor: "#ffffff",
    zIndex: 300,
    display: "flex", flexDirection: "column",
    transition: "transform 0.25s ease",
    boxShadow: "2px 0 16px rgba(0,0,0,0.12)",
  },
  drawerHeader: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "20px 16px 0",
  },
  drawerLogo: { width: "140px", objectFit: "contain" },
  logoAccent: {
    height: "3px", backgroundColor: "#FFDE00",
    borderRadius: "2px", width: "140px", marginTop: "10px",
  },
  closeBtn: {
    background: "none", border: "none",
    fontSize: "18px", cursor: "pointer",
    color: "#767676", padding: "4px",
    fontFamily: "'DM Sans', sans-serif",
  },
  nav: {
    flex: 1,
    padding: "24px 8px 0",
    display: "flex", flexDirection: "column", gap: "2px",
    overflowY: "auto",
  },
  navItem: {
    display: "block", width: "100%",
    padding: "11px 16px",
    textAlign: "left",
    background: "none", border: "none",
    borderLeft: "3px solid transparent",
    borderRadius: "6px",
    fontSize: "14px", fontWeight: 500, color: "#374151",
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.15s",
  },
  navItemActive: {
    background: "#F0FDF4", color: "#367C2B",
    borderLeftColor: "#367C2B", fontWeight: 600,
  },
  drawerFooter: {
    padding: "16px",
    borderTop: "1px solid #E8E8E6",
  },
  drawerName: {
    fontSize: "13px", fontWeight: 600,
    color: "#1A1A1A", marginBottom: "8px",
    fontFamily: "'DM Sans', sans-serif",
  },
  signOutTopBtn: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", color: "#367C2B", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
  },
  signOutBtn: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", color: "#767676",
    textDecoration: "underline", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};
