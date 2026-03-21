import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import logo from "../assets/uatprologo.png";

export default function MobileHeader({ activePath, profile }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <>
      <style>{`
        .mobile-header { display: none; }
        .mobile-header-spacer { display: none; }
        @media (max-width: 768px) {
          .mobile-header-spacer { display: block; height: 80px; }
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

      <div className="mobile-header-spacer" />

      <div className="mobile-header">
        <div style={{ width: "40px" }} />

        <img src={logo} alt="UAT Pro" style={styles.headerLogo} />

        <div style={styles.rightSide}>
          {firstName ? <p style={styles.firstName}>{firstName}</p> : null}
          <button onClick={handleSignOut} style={styles.signOutTopBtn}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  headerLogo: {
    height: "54px", objectFit: "contain",
    position: "absolute", left: "50%", transform: "translateX(-50%)",
  },
  rightSide: {
    display: "flex", flexDirection: "column",
    alignItems: "flex-end", gap: "1px",
  },
  firstName: {
    fontSize: "11px", color: "#ABABAB", margin: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  signOutTopBtn: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", color: "#367C2B", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
  },
};
