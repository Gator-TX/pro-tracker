import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";

export default function ManagerAccounts() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRep, setFilterRep] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const STATUS_COLORS = {
    New:       { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    Contacted: { bg: "#FEFCE8", color: "#CA8A04", border: "#FDE68A" },
    Engaged:   { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
    Proposal:  { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
    Won:       { bg: "#367C2B", color: "#FFFFFF", border: "#367C2B" },
    Lost:      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/accounts"); return; }

    const { data: repsData } = await supabase
      .from("profiles").select("*").eq("role", "rep");
    setReps(repsData || []);

    const { data: accountsData } = await supabase
      .from("accounts")
      .select("*, activities(activity_date)")
      .order("created_at", { ascending: false });
    setAccounts(accountsData || []);

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getRepName = (repId) => {
    const rep = reps.find(r => r.id === repId);
    return rep?.full_name || "Unassigned";
  };

  const getLastActivity = (account) => {
    const acts = account.activities || [];
    if (!acts.length) return null;
    const latest = acts.reduce((a, b) =>
      new Date(a.activity_date) > new Date(b.activity_date) ? a : b
    );
    return new Date(latest.activity_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filtered = accounts.filter(a => {
    const matchSearch = !search ||
      (a.name || a.company || "").toLowerCase().includes(search.toLowerCase());
    const matchRep = filterRep === "all" || a.rep_id === filterRep;
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchRep && matchStatus;
  });

  if (loading) {
    return (
      <div style={styles.loadingPage}><div style={styles.spinner} /></div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .account-row {
          display: grid;
          grid-template-columns: 2fr 120px 120px 110px 100px;
          gap: 12px; align-items: center;
          padding: 13px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .account-row:hover { background: #F9F9F8; }
        .account-row:last-child { border-bottom: none; }

        .filter-select {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          cursor: pointer;
        }
        .filter-select:focus { border-color: #367C2B; }

        .search-input {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          width: 220px;
        }
        .search-input:focus { border-color: #367C2B; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; }
        }
      `}</style>

      <div style={styles.layout}>
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/accounts" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <div style={styles.topBar}>
            <h1 style={styles.pageTitle}>Accounts</h1>
            <p style={styles.subTitle}>{filtered.length} accounts</p>
          </div>

          {/* Filters */}
          <div style={styles.filterBar}>
            <input
              className="search-input"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="filter-select" value={filterRep}
              onChange={e => setFilterRep(e.target.value)}>
              <option value="all">All Reps</option>
              {reps.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.full_name}</option>
              ))}
            </select>
            <select className="filter-select" value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {["New", "Contacted", "Engaged", "Proposal", "Won", "Lost"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div style={styles.tableCard}>
            <div style={{ ...styles.accountRow, ...styles.tableHeader }}>
              <span>Account</span>
              <span>Status</span>
              <span>Assigned Rep</span>
              <span>Last Activity</span>
              <span>Logs</span>
            </div>

            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No accounts found</p>
            ) : (
              filtered.map(account => {
                const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                return (
                  <div key={account.id} className="account-row"
                    onClick={() => navigate(`/dashboard/reps/${account.rep_id}`)}>
                    <span style={styles.accountName}>{account.name || account.company}</span>
                    <span style={{
                      ...styles.statusBadge,
                      background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                    }}>
                      {account.status || "New"}
                    </span>
                    <span style={styles.cellText}>{getRepName(account.rep_id)}</span>
                    <span style={styles.cellText}>{getLastActivity(account) || "—"}</span>
                    <span style={styles.cellText}>{account.activities?.length || 0}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F5F5F3" },
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
  main: { marginLeft: "220px", flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px", minHeight: "100vh" },
  topBar: { display: "flex", alignItems: "baseline", gap: "12px" },
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },
  subTitle: { fontSize: "13px", color: "#767676" },
  filterBar: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  tableCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", overflow: "hidden" },
  accountRow: { display: "grid", gridTemplateColumns: "2fr 120px 120px 110px 100px", gap: "12px", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #F0F0ED" },
  tableHeader: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "default" },
  accountName: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  statusBadge: { fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center", display: "inline-block" },
  cellText: { fontSize: "13px", color: "#374151" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },
};
