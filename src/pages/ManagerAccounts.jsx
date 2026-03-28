import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function ManagerAccounts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRep, setFilterRep] = useState("all");
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || "active");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [sortDirection, setSortDirection] = useState("asc");
  const [unassignMsg, setUnassignMsg] = useState(null);
  const [sprintLength, setSprintLength] = useState(60);
  const [showDateModal, setShowDateModal] = useState(false);
  const [targetStartDate, setTargetStartDate] = useState("");
  const [settingDates, setSettingDates] = useState(false);
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
    if (profileData?.role !== "manager") { navigate("/leads"); return; }

    const { data: repsData } = await supabase
      .from("profiles").select("*").eq("role", "rep");
    setReps(repsData || []);

    const { data: settingsData } = await supabase
      .from("target_app_settings").select("setting_key, setting_value");
    const sprintSetting = (settingsData || []).find(s => s.setting_key === "sprint_length");
    if (sprintSetting) setSprintLength(parseInt(sprintSetting.setting_value) || 60);

    const { data: accountsData } = await supabase
      .from("target_leads")
      .select("*, start_date, end_date, target_lead_activities(activity_date)")
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
    const acts = account.target_lead_activities || [];
    if (!acts.length) return null;
    const latest = acts.reduce((a, b) =>
      new Date(a.activity_date) > new Date(b.activity_date) ? a : b
    );
    const [y, m, day] = latest.activity_date.split("-");
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} account${selectedIds.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    await supabase.from("target_leads").delete().in("id", selectedIds);
    setSelectedIds([]);
    await loadData();
    setDeleting(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openDateModal = () => {
    const d = new Date();
    const today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    setTargetStartDate(today);
    setShowDateModal(true);
  };

  const handleSetTargetDates = async () => {
    if (!targetStartDate || selectedIds.length === 0) return;
    setSettingDates(true);
    const [y, m, day] = targetStartDate.split("-");
    const start = new Date(y, m - 1, day);
    const end = new Date(start);
    end.setDate(end.getDate() + sprintLength);
    const endStr = end.getFullYear() + "-" + String(end.getMonth() + 1).padStart(2, "0") + "-" + String(end.getDate()).padStart(2, "0");

    await supabase.from("target_leads")
      .update({ start_date: targetStartDate, end_date: endStr })
      .in("id", selectedIds);

    setAccounts(prev => prev.map(a =>
      selectedIds.includes(a.id) ? { ...a, start_date: targetStartDate, end_date: endStr } : a
    ));
    setSettingDates(false);
    setShowDateModal(false);
    setSelectedIds([]);
  };

  const handleUnassign = async (accountId) => {
    await supabase.from("target_leads").update({ rep_id: null }).eq("id", accountId);
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, rep_id: null } : a));
    setUnassignMsg(accountId);
    setTimeout(() => setUnassignMsg(null), 3000);
  };

  const formatDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const ACTIVE_STATUSES = ["New", "Contacted", "Engaged", "Proposal"];

  const filtered = accounts.filter(a => {
    const matchSearch = !search ||
      (a.name || a.company || "").toLowerCase().includes(search.toLowerCase());
    const matchRep = filterRep === "all" || a.rep_id === filterRep;
    const matchStatus = filterStatus === "all"
      ? true
      : filterStatus === "active"
      ? ACTIVE_STATUSES.includes(a.status || "New")
      : a.status === filterStatus;
    return matchSearch && matchRep && matchStatus;
  }).sort((a, b) => {
    const nameA = (a.name || a.company || "").toLowerCase();
    const nameB = (b.name || b.company || "").toLowerCase();
    return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
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
          grid-template-columns: 32px 2fr 120px 120px 110px 80px 80px 90px;
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

        .field-input {
          padding: 7px 10px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: #367C2B; }

        .table-scroll {
          max-height: 600px; overflow-y: auto; min-width: 800px;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }
        .account-row { min-width: 800px; }
        .mobile-only { display: none; }
        .desktop-only { display: block; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; padding-left: 16px !important; padding-right: 16px !important; }
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column; gap: 8px; margin-top: 8px; }
          .acct-filter-bar { gap: 8px !important; }
          .acct-mobile-card {
            background: #fff;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #E8E8E6;
            border-radius: 8px;
            padding: 14px 16px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: background 0.15s;
          }
          .acct-mobile-card:active { background: #F9F9F8; }
          .acct-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .acct-card-name { font-size: 15px; font-weight: 600; color: #1A1A1A; flex: 1; min-width: 0; }
          .acct-card-row2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .acct-card-rep { font-size: 12px; color: #767676; }
          .acct-card-days { font-size: 12px; color: #ABABAB; }
          .acct-card-row3 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .acct-card-meta { font-size: 12px; color: #ABABAB; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/accounts" profile={profile} />
        <ManagerBottomNav activePath="/dashboard/accounts" />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/accounts" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Leads" profile={profile} onSignOut={handleSignOut} />


          {/* Filters */}
          <div className="acct-filter-bar" style={styles.filterBar}>
            <input
              className="search-input"
              placeholder="Search leads..."
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
              <option value="active">Active</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>
                {selectedIds.length} selected:
              </span>
              <button onClick={openDateModal} style={styles.setDatesBtn}>
                Set Target Dates
              </button>
              <button onClick={handleDelete} disabled={deleting} style={styles.deleteBtn}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}

          {/* Table */}
          <div className="acct-table-card desktop-only" style={styles.tableCard}>
            <div className="acct-table-header" style={{ ...styles.accountRow, ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1, minWidth: "800px" }}>
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(a => selectedIds.includes(a.id))}
                onChange={e => setSelectedIds(e.target.checked ? filtered.map(a => a.id) : [])}
                style={styles.checkbox}
              />
              <span style={{ cursor: "pointer" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                Account {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <span>Status</span>
              <span>Assigned Rep</span>
              <span>Last Activity</span>
              <span>Days Left</span>
              <span>Logs</span>
              <span>Actions</span>
            </div>

            <div className="table-scroll">
            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No accounts found</p>
            ) : (
              filtered.map(account => {
                const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                return (
                  <div key={account.id}>
                    <div className="account-row"
                      onClick={() => navigate(`/leads/${account.id}`)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(account.id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(account.id); }}
                        onClick={e => e.stopPropagation()}
                        style={styles.checkbox}
                      />
                      <span className="acct-name" style={styles.accountName}>{account.name || account.company}</span>
                      <span className="acct-status" style={{
                        ...styles.statusBadge,
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                      }}>
                        {account.status || "New"}
                      </span>
                      <span className="acct-rep" style={styles.cellText}>{getRepName(account.rep_id)}</span>
                      <span className="acct-last" style={styles.cellText}>{getLastActivity(account) || "—"}</span>
                      <span className="acct-days" style={styles.cellText}>
                        {account.end_date ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : "—"}
                      </span>
                      <span className="acct-logs" style={styles.cellText}>{account.target_lead_activities?.length || 0}</span>
                      <span onClick={e => e.stopPropagation()}>
                        {account.rep_id ? (
                          <button
                            onClick={e => { e.stopPropagation(); handleUnassign(account.id); }}
                            style={styles.unassignLink}>
                            Unassign
                          </button>
                        ) : (
                          <span style={styles.cellText}>—</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>

          {/* MOBILE: Account Cards */}
          <div className="mobile-only">
            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No accounts found</p>
            ) : (
              filtered.map(account => {
                const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                const daysLeft = account.end_date
                  ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                  : null;
                const status = account.status || "New";
                const isActive = ["New", "Contacted", "Engaged", "Proposal"].includes(status);
                const leftBorder = isActive ? "3px solid #367C2B" : status === "Lost" ? "3px solid #DC2626" : "1px solid #E8E8E6";
                return (
                  <div
                    key={`m-${account.id}`}
                    className="acct-mobile-card"
                    style={{ borderLeft: leftBorder }}
                    onClick={() => navigate(`/leads/${account.id}`)}
                  >
                    <div className="acct-card-top">
                      <span className="acct-card-name">{account.name || account.company}</span>
                      <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
                        {status}
                      </span>
                    </div>
                    <div className="acct-card-row2">
                      <span className="acct-card-rep">{getRepName(account.rep_id)}</span>
                      <span className="acct-card-days">{daysLeft !== null ? `${daysLeft}d left` : "—"}</span>
                    </div>
                    <div className="acct-card-row3">
                      <span className="acct-card-meta">
                        {getLastActivity(account) ? `Last: ${getLastActivity(account)}` : "No activity"} · {account.target_lead_activities?.length || 0} logs
                      </span>
                      {account.rep_id && (
                        unassignMsg === account.id
                          ? <span style={{ fontSize: "12px", color: "#16A34A" }}>Unassigned</span>
                          : <button onClick={e => { e.stopPropagation(); handleUnassign(account.id); }} style={styles.unassignLink}>Unassign</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

                  </PullToRefresh>
        </div>
      </div>

      {/* ── Set Target Dates Modal ── */}
      {showDateModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "24px", maxWidth: "420px", width: "90%", fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px", color: "#1A1A1A" }}>
              Set Target Dates
            </div>
            <div style={{ fontSize: "13px", color: "#767676", marginBottom: "20px", lineHeight: 1.5 }}>
              Set start date for {selectedIds.length} lead{selectedIds.length !== 1 ? "s" : ""}. End date will be calculated as start + {sprintLength} days (from Target Defaults).
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Start Date</label>
                <input
                  type="date"
                  className="field-input"
                  value={targetStartDate}
                  onChange={e => setTargetStartDate(e.target.value)}
                  style={{ padding: "8px 12px", fontSize: "14px", border: "1.5px solid #E0E0DC", borderRadius: "6px", fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
              {targetStartDate && (
                <div style={{ fontSize: "13px", color: "#374151" }}>
                  End date: <strong>{(() => {
                    const [y, m, d] = targetStartDate.split("-");
                    const end = new Date(y, m - 1, d);
                    end.setDate(end.getDate() + sprintLength);
                    return end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  })()}</strong>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDateModal(false)}
                style={{ background: "#fff", border: "1.5px solid #E0E0DC", color: "#767676", borderRadius: "6px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSetTargetDates}
                disabled={settingDates || !targetStartDate}
                style={{ background: "#367C2B", border: "none", color: "#fff", borderRadius: "6px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                {settingDates ? "Saving..." : "Apply Dates"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  tableCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  accountRow: { display: "grid", gridTemplateColumns: "32px 2fr 120px 120px 110px 80px 80px 90px", gap: "12px", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #F0F0ED" },
  checkbox: { width: "16px", height: "16px", cursor: "pointer", accentColor: "#367C2B" },
  deleteBtn: { padding: "8px 16px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  setDatesBtn: { padding: "8px 16px", backgroundColor: "#367C2B", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  tableHeader: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "default" },
  accountName: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  statusBadge: { fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center", display: "inline-block" },
  cellText: { fontSize: "13px", color: "#374151" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },

  unassignLink: { background: "none", border: "none", fontSize: "12px", color: "#DC2626", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif", padding: 0 },
};
