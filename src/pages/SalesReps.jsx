// RLS policy needed in Supabase if delete fails:
// CREATE POLICY "Managers can delete rep profiles"
// ON profiles FOR DELETE TO authenticated
// USING (
//   (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
//   AND role = 'rep'
// );

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function SalesReps() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDirection, setSortDirection] = useState("asc");
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
    if (profileData?.role !== "manager") { navigate("/accounts"); return; }

    const { data: repsData } = await supabase
      .from("profiles").select("*").eq("role", "rep");

    const repsWithStats = await Promise.all((repsData || []).map(async (rep) => {
      const { data: accounts } = await supabase
        .from("accounts").select("id, status").eq("rep_id", rep.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id)
        .gte("activity_date", weekAgo.toISOString().split("T")[0]);

      const { data: allActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id);

      const activeCount = (accounts || []).filter(a => ["New", "Contacted", "Engaged", "Proposal"].includes(a.status)).length;
      const wonCount = (accounts || []).filter(a => a.status === "Won").length;
      const lostCount = (accounts || []).filter(a => a.status === "Lost").length;
      const weeklyCount = weekActs?.length || 0;

      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      const { data: recentActs } = await supabase
        .from("activities")
        .select("id")
        .eq("rep_id", rep.id)
        .gte("created_at", fortyEightHoursAgo.toISOString())
        .limit(1);
      const repIsNew = (new Date() - new Date(rep.created_at)) < 48 * 60 * 60 * 1000;
      const atRisk = !repIsNew && (!recentActs || recentActs.length === 0) && activeCount > 0;

      return {
        ...rep,
        activeCount,
        wonCount,
        lostCount,
        logsThisWeek: weeklyCount,
        totalLogs: allActs?.length || 0,
        atRisk,
      };
    }));

    setReps(repsWithStats);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleDelete = async () => {
    const count = selectedIds.length;
    if (!window.confirm(`Delete ${count} rep${count > 1 ? "s" : ""}? This will also remove their profile. This cannot be undone.`)) return;
    setDeleting(true);
    for (const repId of selectedIds) {
      await supabase.from("accounts").update({ rep_id: null }).eq("rep_id", repId);
      await supabase.from("profiles").delete().eq("id", repId);
    }
    setSelectedIds([]);
    await loadData();
    setDeleting(false);
  };

  if (loading) {
    return <div style={styles.loadingPage}><div style={styles.spinner} /></div>;
  }

  const sorted = [...reps].sort((a, b) => sortDirection === "asc"
    ? a.full_name.localeCompare(b.full_name)
    : b.full_name.localeCompare(a.full_name)
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .rep-row {
          display: grid;
          grid-template-columns: 32px 1.8fr 70px 70px 70px 110px 90px 100px;
          gap: 12px; align-items: center;
          padding: 13px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .rep-row:hover { background: #F9F9F8; }
        .rep-row:last-child { border-bottom: none; }
        .rep-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: #367C2B; flex-shrink: 0; }

        .table-scroll {
          max-height: 600px; overflow-y: auto; min-width: 720px;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }
        .rep-row { min-width: 720px; }

        .rep-mobile-kanban { display: none; }
        .desktop-only { display: block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; }
          .desktop-only { display: none !important; }
          .rep-table-card { display: none !important; }
          .rep-mobile-kanban { display: flex !important; flex-direction: column; gap: 8px; padding: 0 16px; width: 100%; }
          .rep-kanban-card {
            background: #fff;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #E8E8E6;
            border-radius: 8px;
            padding: 14px 16px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: background 0.15s;
          }
          .rep-kanban-card:active { background: #F9F9F8; }
          .rep-kanban-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .rep-kanban-name { font-size: 15px; font-weight: 600; color: #1A1A1A; }
          .rep-kanban-badge { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 100px; white-space: nowrap; }
          .rep-kanban-stats { display: flex; gap: 20px; }
          .rep-kanban-stat { display: flex; flex-direction: column; gap: 2px; }
          .rep-kanban-stat-label { font-size: 9px; font-weight: 600; color: #ABABAB; text-transform: uppercase; letter-spacing: 0.06em; }
          .rep-kanban-stat-value { font-size: 14px; font-weight: 500; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/reps" profile={profile} />
        <ManagerBottomNav activePath="/dashboard/reps" />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/reps" />

        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Sales Reps" profile={profile} onSignOut={handleSignOut} />
          <p className="desktop-only" style={styles.subTitle}>{reps.length} rep{reps.length !== 1 ? "s" : ""}</p>

          {selectedIds.length > 0 && (
            <button onClick={handleDelete} disabled={deleting} style={styles.deleteBtn}>
              {deleting ? "Deleting…" : `Delete selected (${selectedIds.length})`}
            </button>
          )}

          <div className="rep-table-card" style={styles.tableCard}>
            {/* Desktop header */}
            <div className="rep-row rep-table-header" style={{ ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1, minWidth: "700px" }}>
              <input
                type="checkbox"
                className="rep-checkbox"
                checked={sorted.length > 0 && sorted.every(r => selectedIds.includes(r.id))}
                onChange={e => setSelectedIds(e.target.checked ? sorted.map(r => r.id) : [])}
              />
              <span style={{ cursor: "pointer" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                Rep {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <span>Active</span>
              <span>Won</span>
              <span>Lost</span>
              <span>Logs This Week</span>
              <span>Total Logs</span>
              <span>Status</span>
            </div>

            <div className="table-scroll">
            {sorted.length === 0 ? (
              <p style={styles.emptyText}>No reps found</p>
            ) : (
              sorted.map(rep => {
                const badgeStyle = {
                  ...styles.statusBadge,
                  background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                  color: rep.atRisk ? "#DC2626" : "#16A34A",
                  border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                };
                return (
                  <div key={rep.id} className="rep-row"
                    onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>

                    <input
                      type="checkbox"
                      className="rep-checkbox"
                      checked={selectedIds.includes(rep.id)}
                      onChange={() => toggleSelect(rep.id)}
                      onClick={e => e.stopPropagation()}
                    />

                    <div className="rep-row-left">
                      <p style={styles.repName}>{rep.full_name}</p>
                      <p style={styles.repEmail}>{rep.email || "—"}</p>
                      <div className="rep-mobile-stats">
                        <p style={styles.mobileStats}>
                          Active: {rep.activeCount} · Won: {rep.wonCount} · Lost: {rep.lostCount} · {rep.logsThisWeek} this week · {rep.totalLogs} total
                        </p>
                      </div>
                    </div>

                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.activeCount}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.wonCount}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.lostCount}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.logsThisWeek}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.totalLogs}</span>
                    <span className="rep-desktop-stats" style={badgeStyle}>{rep.atRisk ? "At Risk" : "On Track"}</span>

                    <div className="rep-row-right rep-mobile-stats">
                      <span style={badgeStyle}>{rep.atRisk ? "At Risk" : "On Track"}</span>
                    </div>

                  </div>
                );
              })
            )}
            </div>
          </div>
          {/* MOBILE: Rep Kanban Cards */}
          <div className="rep-mobile-kanban">
            {sorted.length === 0 ? (
              <p style={styles.emptyText}>No reps found</p>
            ) : (
              sorted.map(rep => (
                <div
                  key={`m-${rep.id}`}
                  className="rep-kanban-card"
                  style={{ borderLeft: `3px solid ${rep.atRisk ? "#DC2626" : "#367C2B"}` }}
                  onClick={() => navigate(`/dashboard/reps/${rep.id}`)}
                >
                  <div className="rep-kanban-top">
                    <span className="rep-kanban-name">{rep.full_name}</span>
                    <span className="rep-kanban-badge" style={{
                      background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                      color: rep.atRisk ? "#DC2626" : "#16A34A",
                      border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                    }}>
                      {rep.atRisk ? "At Risk" : "On Track"}
                    </span>
                  </div>
                  <div className="rep-kanban-stats">
                    <div className="rep-kanban-stat">
                      <span className="rep-kanban-stat-label">Active</span>
                      <span className="rep-kanban-stat-value">{rep.activeCount}</span>
                    </div>
                    <div className="rep-kanban-stat">
                      <span className="rep-kanban-stat-label">Won</span>
                      <span className="rep-kanban-stat-value" style={{ color: "#16A34A" }}>{rep.wonCount}</span>
                    </div>
                    <div className="rep-kanban-stat">
                      <span className="rep-kanban-stat-label">Lost</span>
                      <span className="rep-kanban-stat-value" style={{ color: "#DC2626" }}>{rep.lostCount}</span>
                    </div>
                    <div className="rep-kanban-stat">
                      <span className="rep-kanban-stat-label">Logs/Wk</span>
                      <span className="rep-kanban-stat-value">{rep.logsThisWeek}</span>
                    </div>
                  </div>
                </div>
              ))
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
  subTitle: { fontSize: "13px", color: "#767676" },
  tableCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  tableHeader: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  deleteBtn: { alignSelf: "flex-start", padding: "8px 16px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  repName: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  repEmail: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  statVal: { fontSize: "14px", color: "#374151" },
  statusBadge: { fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center", display: "inline-block" },
  mobileStats: { fontSize: "12px", color: "#767676", marginTop: "3px" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },
};
