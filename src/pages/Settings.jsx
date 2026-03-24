import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import { subscribeToPush } from "../utils/pushNotifications";
import MobileMenuSettings from "../components/MobileMenuSettings";
import { MGR_MENU_ITEMS, MGR_DEFAULT_ORDER, MGR_STORAGE_KEY } from "../config/mobileMenuItems";

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [fullName, setFullName] = useState("");
  const [sprintLength, setSprintLength] = useState("60");
  const [accountsPerRep, setAccountsPerRep] = useState("10");

  const [repAtRiskDays, setRepAtRiskDays] = useState("2");
  const [accountAtRiskDays, setAccountAtRiskDays] = useState("7");

  const [pushEnabled, setPushEnabled] = useState(() => !!localStorage.getItem("push_enabled"));
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/accounts"); return; }

    setFullName(profileData?.full_name || "");

    const { data: settingsData } = await supabase
      .from("app_settings").select("setting_key, setting_value");
    (settingsData || []).forEach(s => {
      if (s.setting_key === "rep_at_risk_days") setRepAtRiskDays(s.setting_value);
      if (s.setting_key === "account_at_risk_days") setAccountAtRiskDays(s.setting_value);
    });

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

  const handleEnablePush = async () => {
    setPushLoading(true);
    const sub = await subscribeToPush(profile.id);
    setPushLoading(false);
    if (sub) {
      localStorage.setItem("push_enabled", "1");
      setPushEnabled(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile.id);
    await supabase.from("app_settings").upsert([
      { setting_key: "rep_at_risk_days", setting_value: String(repAtRiskDays), updated_by: profile.id },
      { setting_key: "account_at_risk_days", setting_value: String(accountAtRiskDays), updated_by: profile.id },
    ], { onConflict: "setting_key" });
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
          .main-content { margin-left: 0 !important; padding-top: 86px !important; overflow-x: hidden; gap: 8px !important; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/settings" profile={profile} />
        <ManagerBottomNav activePath="/dashboard/settings" />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/settings" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <TopBar title="Settings" profile={profile} onSignOut={handleSignOut} />

          {saveSuccess && (
            <div style={styles.successBanner}>Settings saved successfully</div>
          )}

          {/* Mobile Menu */}
          <MobileMenuSettings items={MGR_MENU_ITEMS} defaultOrder={MGR_DEFAULT_ORDER} storageKey={MGR_STORAGE_KEY} />

          {/* Profile settings */}
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
                <input id="role" name="role" className="field-input" value="Manager" disabled
                  style={{ backgroundColor: "#F9F9F8", color: "#767676" }} />
              </div>
            </div>
          </div>

          {/* Sprint settings */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Target Defaults</p>
            <div style={styles.card}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Target Length (days)</label>
                <input id="sprint_length" name="sprint_length" className="field-input" type="number"
                  value={sprintLength}
                  onChange={e => setSprintLength(e.target.value)}
                  style={{ maxWidth: "160px" }} />
                <p style={styles.fieldHint}>Default target duration when creating new targets</p>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Accounts Per Rep</label>
                <input id="accounts_per_rep" name="accounts_per_rep" className="field-input" type="number"
                  value={accountsPerRep}
                  onChange={e => setAccountsPerRep(e.target.value)}
                  style={{ maxWidth: "160px" }} />
                <p style={styles.fieldHint}>Maximum accounts assigned per rep per target</p>
              </div>
            </div>
          </div>

          {/* At Risk Thresholds */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>At Risk Thresholds</p>
            <div style={styles.card}>
              <div style={styles.thresholdRow}>
                <div style={{ ...styles.field, flex: 1, minWidth: 0 }}>
                  <label style={styles.fieldLabel}>Rep At Risk After</label>
                  <input className="field-input" type="number" min="1" value={repAtRiskDays}
                    onChange={e => setRepAtRiskDays(e.target.value)} />
                  <p style={styles.fieldHint}>days with no activity</p>
                </div>
                <div style={{ ...styles.field, flex: 1, minWidth: 0 }}>
                  <label style={styles.fieldLabel}>Account At Risk After</label>
                  <input className="field-input" type="number" min="1" value={accountAtRiskDays}
                    onChange={e => setAccountAtRiskDays(e.target.value)} />
                  <p style={styles.fieldHint}>days with no activity</p>
                </div>
              </div>
            </div>
          </div>

          {/* Account */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Account</p>
            <div style={styles.card}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Organization</span>
                <span style={styles.infoValue}>United Ag & Turf</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Plan</span>
                <span style={styles.infoValue}>Pro-Tracker</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Version</span>
                <span style={styles.infoValue}>1.0.0</span>
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

          {/* Notifications */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Notifications</p>
            <div style={styles.card}>
              <div style={styles.notifRow}>
                <div>
                  <p style={styles.notifLabel}>Push Notifications</p>
                  <p style={styles.notifHint}>Enable push notifications to receive activity reminders</p>
                </div>
                {pushEnabled ? (
                  <span style={styles.notifEnabled}>✓ Enabled</span>
                ) : (
                  <button className="btn-primary" disabled={pushLoading} onClick={handleEnablePush}
                    style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}>
                    {pushLoading ? "Enabling…" : "Enable Notifications"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sign out */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Session</p>
            <div style={styles.card}>
              <div style={styles.signOutRow}>
                <div>
                  <p style={styles.signOutLabel}>Sign out of Pro-Tracker</p>
                  <p style={styles.signOutHint}>You will be returned to the login screen</p>
                </div>
                <button
                  style={styles.signOutBtn2}
                  onClick={handleSignOut}>
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
  thresholdRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#374151" },
  fieldHint: { fontSize: "12px", color: "#ABABAB" },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #F0F0ED" },
  infoLabel: { fontSize: "13px", color: "#767676" },
  infoValue: { fontSize: "13px", fontWeight: 500, color: "#1A1A1A" },
  signOutRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  signOutLabel: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  signOutHint: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  signOutBtn2: { padding: "8px 16px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  notifRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" },
  notifLabel: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  notifHint: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  notifEnabled: { fontSize: "13px", fontWeight: 600, color: "#16A34A", whiteSpace: "nowrap" },
};
