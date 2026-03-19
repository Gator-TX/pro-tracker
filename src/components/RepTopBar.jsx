export default function RepTopBar({ title, profile, onSignOut }) {
  return (
    <>
      <style>{`@media (max-width: 768px) { .topbar-rep { display: none !important; } }`}</style>
      <div className="topbar-rep" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "56px", padding: "0 32px",
        backgroundColor: "#ffffff", borderBottom: "1px solid #E8E8E6",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "22px", fontWeight: 600, color: "#1A1A1A", fontFamily: "'DM Sans', sans-serif" }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A1A1A", fontFamily: "'DM Sans', sans-serif" }}>
            {profile?.full_name}
          </span>
          <button onClick={onSignOut} style={{
            fontSize: "13px", color: "#767676", textDecoration: "underline",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
