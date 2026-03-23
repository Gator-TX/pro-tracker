import { useNavigate } from "react-router-dom";
import logo from "../assets/uatprologo.png";

const MANAGER_NAV = [
  { label: "Home", path: "/dashboard" },
  { label: "Accounts", path: "/dashboard/accounts" },
  { label: "Activities", path: "/dashboard/activities" },
  { label: "Sales Reps", path: "/dashboard/reps" },
  { label: "Manage Accounts", path: "/manage" },
  { label: "Export Reports", path: "/dashboard/export" },
  { label: "User Management", path: "/dashboard/users" },
  { label: "Settings", path: "/dashboard/settings" },
];

const REP_NAV = [
  { label: "Home", path: "/home" },
  { label: "My Accounts", path: "/accounts" },
  { label: "Activities", path: "/activities" },
  { label: "Settings", path: "/rep/settings" },
];

export default function Sidebar({ role, profile, onSignOut, activePath }) {
  const navigate = useNavigate();
  const navItems = role === "manager" ? MANAGER_NAV : REP_NAV;

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
        }
        .sidebar-nav-item:hover { background: #F5F5F3; color: #367C2B; }
        .sidebar-nav-item.active {
          background: #F0FDF4; color: #367C2B;
          border-left-color: #367C2B; font-weight: 600;
        }
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
          {navItems.map(item => (
            <button
              key={item.path}
              className={`sidebar-nav-item${item.path === activePath ? " active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

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
  sidebarFooter: { padding: "16px", borderTop: "1px solid #E8E8E6" },
  footerName: { fontSize: "13px", fontWeight: 600, color: "#1A1A1A", marginBottom: "4px" },
  signOutBtn: {
    background: "none", border: "none", padding: 0,
    fontSize: "12px", color: "#767676", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", textDecoration: "underline",
  },
};
