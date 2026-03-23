import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";

export default function UserManagement() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("rep");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadData(); }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/dashboard"); return; }

    const { data: usersData } = await supabase
      .from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(usersData || []);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditName(u.full_name || "");
    setEditRole(u.role || "rep");
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName, role: editRole })
      .eq("id", editUser.id);
    setSaving(false);
    if (error) { showToast("Failed to update user.", "error"); return; }
    showToast("User updated.");
    setEditUser(null);
    loadData();
  };

  const handleResetPassword = async (u) => {
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: window.location.origin + "/login",
    });
    if (error) { showToast("Failed to send reset email.", "error"); return; }
    showToast(`Password reset email sent to ${u.email}`);
  };

  const handleToggleActive = async (u) => {
    const action = u.is_active === false ? "Activate" : "Deactivate";
    const msg = u.is_active === false
      ? `Activate ${u.full_name}?`
      : `Deactivate ${u.full_name}? They will not be able to log in.`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: u.is_active === false ? true : false })
      .eq("id", u.id);
    if (error) { showToast(`Failed to ${action.toLowerCase()} user.`, "error"); return; }
    showToast(`${u.full_name} ${action.toLowerCase()}d.`);
    loadData();
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete ${u.full_name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", u.id);
    if (error) { showToast("Failed to delete user.", "error"); return; }
    showToast(`Profile removed. To fully delete the auth account go to Supabase → Authentication → Users.`);
    loadData();
  };

  const filteredUsers = users.filter(u =>
    !search || (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F3" }}>
      <div style={styles.spinner} />
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main-content { margin-left: 0 !important; padding-top: 86px !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .um-tr:hover { background: #F9F9F8; }
        .um-search {
          width: 100%; max-width: 320px; padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; border: 1.5px solid #E0E0DC;
          border-radius: 6px; background: #fff; color: #1A1A1A; outline: none;
        }
        .um-search:focus { border-color: #367C2B; }
        .um-input {
          width: 100%; padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; border: 1.5px solid #E0E0DC;
          border-radius: 6px; background: #fff; color: #1A1A1A; outline: none;
        }
        .um-input:focus { border-color: #367C2B; }
        .um-select {
          width: 100%; padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; border: 1.5px solid #E0E0DC;
          border-radius: 6px; background: #fff; color: #1A1A1A; outline: none; cursor: pointer;
        }
        .um-select:focus { border-color: #367C2B; }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/users" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/users" />

        <div className="main-content" style={styles.main}>
          <TopBar title="User Management" profile={profile} onSignOut={handleSignOut} />

          <div style={styles.content}>

            {/* Info banner */}
            <div style={styles.banner}>
              To create new users go to your Supabase dashboard → Authentication → Users → Add User. Then set their role here.
            </div>

            {/* Search */}
            <input
              className="um-search"
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {/* Table */}
            <div style={styles.tableCard}>
              {/* Header */}
              <div style={styles.thead}>
                {["Name", "Email", "Role", "Status", "Joined", "Actions"].map(h => (
                  <span key={h} style={styles.th}>{h}</span>
                ))}
              </div>

              {filteredUsers.length === 0 ? (
                <p style={styles.empty}>No users found.</p>
              ) : (
                filteredUsers.map(u => (
                  <div key={u.id} className="um-tr" style={styles.tr}>
                    <span style={styles.tdName}>{u.full_name || "—"}</span>
                    <span style={styles.td}>{u.email || "—"}</span>
                    <span>
                      <span style={{
                        ...styles.badge,
                        background: u.role === "manager" ? "#F0FDF4" : "#EFF6FF",
                        color: u.role === "manager" ? "#16A34A" : "#2563EB",
                        border: `1px solid ${u.role === "manager" ? "#BBF7D0" : "#BFDBFE"}`,
                      }}>
                        {u.role === "manager" ? "Manager" : "Rep"}
                      </span>
                    </span>
                    <span>
                      <span style={{
                        ...styles.badge,
                        background: u.is_active === false ? "#FEF2F2" : "#F0FDF4",
                        color: u.is_active === false ? "#DC2626" : "#16A34A",
                        border: `1px solid ${u.is_active === false ? "#FECACA" : "#BBF7D0"}`,
                      }}>
                        {u.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </span>
                    <span style={styles.td}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                    <span style={styles.actions}>
                      <button style={styles.actionGreen} onClick={() => openEdit(u)}>Edit</button>
                      <button style={styles.actionGreen} onClick={() => handleResetPassword(u)}>Reset Password</button>
                      <button style={styles.actionRed} onClick={() => handleToggleActive(u)}>
                        {u.is_active === false ? "Activate" : "Deactivate"}
                      </button>
                      <button style={styles.actionRed} onClick={() => handleDelete(u)}>Delete</button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Edit User</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name</label>
              <input className="um-input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Role</label>
              <select className="um-select" value={editRole} onChange={e => setEditRole(e.target.value)}>
                <option value="rep">Rep</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div style={styles.modalBtns}>
              <button style={styles.cancelBtn} onClick={() => setEditUser(null)}>Cancel</button>
              <button style={styles.saveBtn} onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#DC2626" : "#367C2B" }}>
          {toast.msg}
        </div>
      )}

      <ManagerBottomNav activePath="/dashboard/users" />
    </>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#F5F5F3" },
  main: {
    marginLeft: "220px", flex: 1, minHeight: "100vh",
    display: "flex", flexDirection: "column",
    background: "#F5F5F3", fontFamily: "'DM Sans', sans-serif",
  },
  content: { padding: "28px 32px", display: "flex", flexDirection: "column", gap: "16px" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },

  banner: {
    background: "#FFF9E6", border: "1px solid #FFDE00",
    borderRadius: "6px", padding: "10px 16px",
    fontSize: "13px", color: "#92400E", lineHeight: "1.5",
  },

  tableCard: {
    background: "#fff", border: "0.5px solid #E8E8E6",
    borderRadius: "8px", overflow: "hidden",
  },
  thead: {
    display: "grid",
    gridTemplateColumns: "1.5fr 2fr 90px 80px 120px 2fr",
    gap: "12px", alignItems: "center",
    padding: "10px 20px",
    background: "#FAFAFA", borderBottom: "1px solid #E8E8E6",
  },
  tr: {
    display: "grid",
    gridTemplateColumns: "1.5fr 2fr 90px 80px 120px 2fr",
    gap: "12px", alignItems: "center",
    padding: "12px 20px",
    borderBottom: "1px solid #F0F0ED",
    transition: "background 0.15s",
  },
  th: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  tdName: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  td: { fontSize: "13px", color: "#374151" },
  badge: { fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "100px", whiteSpace: "nowrap" },
  actions: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  actionGreen: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", fontWeight: 600, color: "#367C2B",
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    textDecoration: "underline",
  },
  actionRed: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", fontWeight: 600, color: "#DC2626",
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    textDecoration: "underline",
  },
  empty: { padding: "32px", textAlign: "center", fontSize: "14px", color: "#ABABAB" },

  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "#fff", borderRadius: "10px", padding: "28px",
    width: "100%", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#1A1A1A" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  modalBtns: { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" },
  cancelBtn: {
    padding: "8px 18px", background: "#fff", border: "1.5px solid #E0E0DC",
    borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", color: "#374151",
  },
  saveBtn: {
    padding: "8px 18px", background: "#367C2B", border: "none",
    borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", color: "#fff",
  },

  toast: {
    position: "fixed", bottom: "24px", right: "24px", zIndex: 200,
    color: "#fff", fontSize: "13px", fontWeight: 600,
    padding: "12px 20px", borderRadius: "8px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    maxWidth: "360px", lineHeight: "1.4",
  },
};
