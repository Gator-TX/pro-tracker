export default function RepTopBar({ profile, onSignOut }) {
  return (
    <>
      <style>{`@media (max-width: 768px) { .topbar-rep { display: none !important; } }`}</style>
      <div className="topbar-rep" style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A1A1A", fontFamily: "'DM Sans', sans-serif" }}>
            {profile?.full_name}
          </span>
          <button onClick={onSignOut} style={{
            fontSize: "12px", color: "#767676", textDecoration: "underline",
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
