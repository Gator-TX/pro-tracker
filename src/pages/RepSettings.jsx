import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";

export default function RepSettings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fullName, setFullName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    setFullName(profileData?.full_name || "");
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handlePasswordUpdate = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile.id);
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (loading) {
    return <div style={styles.loadingPage}><div style={styles.spinner} /></div>;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .field-input {
          width: 100%; padding: 10px 12px; font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: #367C2B; }

        .btn-primary {
          padding: 11px 24px; background: #367C2B; color: #fff;
          border: none; border-radius: 6px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: background 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: #2d6b24; }
        .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 70px !important; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileHeader activePath="/rep/settings" profile={profile} />
        <Sidebar role="rep" profile={profile} onSignOut={handleSignOut} activePath="/rep/settings" />

        <div className="main-content" style={styles.main}>
          <h1 style={styles.pageTitle}>Settings</h1>

          {saveSuccess && (
            <div style={styles.successBanner}>Settings saved successfully</div>
          )}

          {/* Profile */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Your Profile</p>
            <div style={styles.card}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Full Name</label>
                <input id="full_name" name="full_name" className="field-input" value={fullName}
                  onChange={e => setFullName(e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Role</label>
                <input id="role" name="role" className="field-input" value="Sales Rep" disabled
                  style={{ backgroundColor: "#F9F9F8", color: "#767676" }} />
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Change Password</p>
            <div style={styles.card}>
              {passwordError && (
                <div style={styles.errorBanner}>{passwordError}</div>
              )}
              {passwordSuccess && (
                <div style={styles.successBanner}>Password updated successfully</div>
              )}
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Current Password</label>
                <input className="field-input" type="password" value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>New Password</label>
                <input className="field-input" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Confirm New Password</label>
                <input className="field-input" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <div>
                <button className="btn-primary" disabled={passwordSaving} onClick={handlePasswordUpdate}>
                  {passwordSaving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </div>
          </div>

          {/* Session */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Session</p>
            <div style={styles.card}>
              <div style={styles.signOutRow}>
                <div>
                  <p style={styles.signOutLabel}>Sign out of Pro-Tracker</p>
                  <p style={styles.signOutHint}>You will be returned to the login screen</p>
                </div>
                <button style={styles.signOutBtn2} onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F5F5F3" },
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
  main: { marginLeft: "220px", flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px", minHeight: "100vh", maxWidth: "720px" },
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },
  successBanner: { backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "6px", padding: "10px 14px", fontSize: "13px", color: "#16A34A", fontWeight: 500 },
  errorBanner: { backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "13px", color: "#DC2626", fontWeight: 500 },
  section: { display: "flex", flexDirection: "column", gap: "10px" },
  sectionTitle: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  card: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#374151" },
  signOutRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  signOutLabel: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  signOutHint: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  signOutBtn2: { padding: "8px 16px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
