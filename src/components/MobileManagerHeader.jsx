import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import logo from "../assets/uatprologo.png";

export default function MobileManagerHeader({ activePath, profile }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <style>{`
        .mgr-mobile-header { display: none; }
        .mgr-mobile-header-spacer { display: none; }
        @media (max-width: 768px) {
          .mgr-mobile-header-spacer { display: block; height: 80px; }
          .mgr-mobile-header {
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

      <div className="mgr-mobile-header-spacer" />

      {/* Fixed top bar — mobile only */}
      <div className="mgr-mobile-header">
        <div style={{ width: "40px" }} />

        <img src={logo} alt="UAT Pro" style={styles.headerLogo} />

        <button onClick={handleSignOut} style={styles.signOutTopBtn}>
          Sign out
        </button>
      </div>
    </>
  );
}

const styles = {
  headerLogo: {
    height: "54px", objectFit: "contain",
    position: "absolute", left: "50%", transform: "translateX(-50%)",
  },
  signOutTopBtn: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", color: "#367C2B", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
};
