import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function ManagerActivities() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activities, setActivities] = useState([]);
  const [reps, setReps] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRep, setFilterRep] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

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

    const { data: accountsData } = await supabase
      .from("target_leads").select("id, name, company");
    setAccounts(accountsData || []);

    const { data: actsData } = await supabase
      .from("target_lead_activities").select("*")
      .order("activity_date", { ascending: false })
      .limit(200);
    setActivities(actsData || []);

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getRepName = (repId) => reps.find(r => r.id === repId)?.full_name || "—";
  const getAccountName = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc?.name || acc?.company || "—";
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} activit${selectedIds.length > 1 ? "ies" : "y"}? This cannot be undone.`)) return;
    setDeleting(true);
    await supabase.from("target_lead_activities").delete().in("id", selectedIds);
    setSelectedIds([]);
    await loadData();
    setDeleting(false);
  };

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const formatDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const filtered = activities.filter(a => {
    const matchRep = filterRep === "all" || a.rep_id === filterRep;
    const matchType = filterType === "all" || a.activity_type === filterType;
    return matchRep && matchType;
  });

  if (loading) {
    return <div style={styles.loadingPage}><div style={styles.spinner} /></div>;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .act-row {
          display: grid;
          grid-template-columns: 32px 130px 1.2fr 1fr 100px 1.5fr;
          gap: 12px; align-items: start;
          padding: 13px 20px;
          border-bottom: 1px solid #F0F0ED;
        }
        .act-row:last-child { border-bottom: none; }

        .filter-select {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none; cursor: pointer;
        }
        .filter-select:focus { border-color: #367C2B; }

        .type-badge {
          display: inline-block;
          padding: 3px 10px; border-radius: 100px;
          font-size: 11px; font-weight: 600;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .mobile-select-all { display: none; }
        .act-mobile-list { display: none; }
        .desktop-only { display: block; }
        .mobile-only { display: none; }

        .table-scroll {
          max-height: 600px; overflow-y: auto; min-width: 650px;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }
        .act-row { min-width: 650px; }

        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; padding-left: 16px !important; padding-right: 16px !important; padding-bottom: 8px !important; }
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .filter-bar { gap: 8px !important; flex-wrap: nowrap !important; margin-bottom: 8px !important; }
          .filter-bar .filter-select { flex: 1; }
          .mobile-select-all { margin-bottom: 0 !important; }
          .act-table-card { display: none !important; }
          .act-mobile-list {
            display: flex !important; flex-direction: column;
            gap: 8px; width: 100%;
            margin-top: 8px; margin-bottom: 95px;
          }
          .act-mobile-card {
            width: 100%;
            box-sizing: border-box;
            background: #ffffff;
            border: 1px solid #E8E8E6;
            border-left: 3px solid #367C2B;
            border-radius: 8px;
            padding: 14px 16px;
            padding-right: 44px;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .act-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .act-card-date { font-size: 12px; color: #ABABAB; white-space: nowrap; flex-shrink: 0; }
          .act-card-account { font-size: 14px; font-weight: 600; color: #1A1A1A; }
          .act-card-rep { font-size: 12px; color: #767676; }
          .act-card-outcome { font-size: 12px; font-weight: 500; color: #374151; }
          .act-card-notes {
            font-size: 12px; color: #767676;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .act-card-checkbox {
            position: absolute; top: 14px; right: 14px;
            width: 18px; height: 18px;
            cursor: pointer; accent-color: #367C2B;
          }
          .mobile-select-all {
            display: flex !important; align-items: center; gap: 10px;
            padding: 10px 16px; background: #fff;
            border: 1px solid #E8E8E6; border-radius: 8px;
          }
          .mobile-delete-btn { width: 100% !important; text-align: center; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/activities" profile={profile} />
        <ManagerBottomNav activePath="/dashboard/activities" />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/activities" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Activities" profile={profile} onSignOut={handleSignOut} />


          {/* Filters */}
          <div className="filter-bar" style={styles.filterBar}>
            <select className="filter-select" value={filterRep}
              onChange={e => setFilterRep(e.target.value)}>
              <option value="all">All Reps</option>
              {reps.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.full_name}</option>
              ))}
            </select>
            <select className="filter-select" value={filterType}
              onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              {["Call", "Meeting", "Email"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Delete button */}
          {selectedIds.length > 0 && (
            <button onClick={handleDelete} disabled={deleting} className="mobile-delete-btn" style={styles.deleteBtn}>
              {deleting ? "Deleting…" : `Delete selected (${selectedIds.length})`}
            </button>
          )}

          {/* Mobile select-all */}
          <div className="mobile-select-all">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every(a => selectedIds.includes(a.id))}
              onChange={e => setSelectedIds(e.target.checked ? filtered.map(a => a.id) : [])}
              style={{ width: "18px", height: "18px", accentColor: "#367C2B", cursor: "pointer" }}
            />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151", fontFamily: "'DM Sans', sans-serif" }}>
              Select all
            </span>
            {selectedIds.length > 0 && (
              <span style={{ fontSize: "12px", color: "#767676", fontFamily: "'DM Sans', sans-serif" }}>
                ({selectedIds.length} selected)
              </span>
            )}
          </div>

          {/* Table — desktop only */}
          <div className="act-table-card desktop-only" style={styles.tableCard}>
            <div className="act-table-header" style={{ ...styles.actRowStyle, ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1, minWidth: "650px" }}>
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(a => selectedIds.includes(a.id))}
                onChange={e => setSelectedIds(e.target.checked ? filtered.map(a => a.id) : [])}
                style={styles.checkbox}
              />
              <span>Date</span>
              <span>Company Name</span>
              <span>Rep</span>
              <span>Type</span>
              <span>Notes</span>
            </div>

            <div className="table-scroll">
            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No activities found</p>
            ) : (
              filtered.map(act => {
                const typeColors = {
                  Call:    { bg: "#EFF6FF", color: "#2563EB" },
                  Meeting: { bg: "#F0FDF4", color: "#16A34A" },
                  Email:   { bg: "#FAF5FF", color: "#7C3AED" },
                };
                const tc = typeColors[act.activity_type] || typeColors.Call;
                return (
                  <div key={act.id} className="act-row">
                    <input
                      type="checkbox"
                      className="act-checkbox"
                      checked={selectedIds.includes(act.id)}
                      onChange={() => toggleSelect(act.id)}
                      style={styles.checkbox}
                    />
                    <span className="act-date" style={styles.dateText}>{formatDate(act.activity_date)}</span>
                    <span className="act-account" style={styles.accountText}>{getAccountName(act.account_id)}</span>
                    <span className="act-rep" style={styles.cellText}>{getRepName(act.rep_id)}</span>
                    <span className="act-type">
                      <span className="type-badge" style={{ background: tc.bg, color: tc.color }}>
                        {act.activity_type}
                      </span>
                    </span>
                    <div className="act-notes">
                      {act.outcome && <p style={styles.outcomeText}>{act.outcome}</p>}
                      {act.notes && <p style={styles.notesText}>{act.notes}</p>}
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>

          {/* MOBILE: Activity Cards */}
          <div className="act-mobile-list mobile-only" style={{ flexDirection: "column" }}>
            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No activities found</p>
            ) : (
              filtered.map(act => {
                const typeColors = {
                  Call:    { bg: "#EFF6FF", color: "#2563EB" },
                  Meeting: { bg: "#F0FDF4", color: "#16A34A" },
                  Email:   { bg: "#FAF5FF", color: "#7C3AED" },
                };
                const tc = typeColors[act.activity_type] || typeColors.Call;
                return (
                  <div key={`m-${act.id}`} className="act-mobile-card">
                    <input
                      type="checkbox"
                      className="act-card-checkbox"
                      checked={selectedIds.includes(act.id)}
                      onChange={() => toggleSelect(act.id)}
                    />
                    <div className="act-card-top">
                      <span className="type-badge" style={{ background: tc.bg, color: tc.color }}>
                        {act.activity_type}
                      </span>
                      <span className="act-card-date">{formatDate(act.activity_date)}</span>
                    </div>
                    <p className="act-card-account">{getAccountName(act.account_id)}</p>
                    <p className="act-card-rep">{getRepName(act.rep_id)}</p>
                    {act.outcome && <p className="act-card-outcome">{act.outcome}</p>}
                    {act.notes && <p className="act-card-notes">{act.notes}</p>}
                  </div>
                );
              })
            )}
          </div>

                  </PullToRefresh>
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
  filterBar: { display: "flex", gap: "10px", flexWrap: "wrap" },
  tableCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  actRowStyle: { display: "grid", gridTemplateColumns: "32px 130px 1.2fr 1fr 100px 1.5fr", gap: "12px", alignItems: "start", padding: "13px 20px", borderBottom: "1px solid #F0F0ED" },
  checkbox: { width: "16px", height: "16px", cursor: "pointer", accentColor: "#367C2B", marginTop: "2px" },
  deleteBtn: { alignSelf: "flex-start", padding: "8px 16px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  tableHeader: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  dateText: { fontSize: "13px", color: "#767676" },
  accountText: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  cellText: { fontSize: "13px", color: "#374151" },
  outcomeText: { fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "2px" },
  notesText: { fontSize: "12px", color: "#767676" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },
};
