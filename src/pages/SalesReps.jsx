// RLS policy needed in Supabase if delete fails:
// CREATE POLICY "Managers can delete rep profiles"
// ON profiles FOR DELETE TO authenticated
// USING (
//   (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
//   AND role = 'rep'
// );

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function SalesReps() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [filterRisk, setFilterRisk] = useState(location.state?.filterRisk || "all");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/leads"); return; }

    const { data: settings } = await supabase
      .from("app_settings").select("setting_key, setting_value");
    const repAtRiskDays = parseInt(settings?.find(s => s.setting_key === "rep_at_risk_days")?.setting_value || "2");

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

      const repAtRiskMs = repAtRiskDays * 24 * 60 * 60 * 1000;
      const repAtRiskCutoff = new Date(Date.now() - repAtRiskMs);
      const { data: recentActs } = await supabase
        .from("activities")
        .select("id")
        .eq("rep_id", rep.id)
        .gte("created_at", repAtRiskCutoff.toISOString())
        .limit(1);
      const repIsNew = (new Date() - new Date(rep.created_at)) < repAtRiskMs;
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

  const sorted = [...reps]
    .filter(r => filterRisk === "all" ? true : filterRisk === "atRisk" ? r.atRisk : !r.atRisk)
    .sort((a, b) => sortDirection === "asc"
      ? a.full_name.localeCompare(b.full_name)
      : b.full_name.localeCompare(a.full_name)
    );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .data-row:hover { background: #F9F9F8; }
        .data-row:last-child td { border-bottom: none; }

        .filter-select {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none; cursor: pointer;
        }
        .filter-select:focus { border-color: #367C2B; }

        .rep-mobile-kanban { display: none; }
        .desktop-only { display: flex; flex-direction: column; flex: 1; min-height: 0; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; padding-left: 16px !important; padding-right: 16px !important; }
          .desktop-only { display: none !important; }
          .rep-mobile-kanban { display: flex !important; flex-direction: column; gap: 8px; }
          .rep-kanban-card {
            background: #fff; width: 100%; box-sizing: border-box;
            border: 1px solid #E8E8E6; border-radius: 8px;
            padding: 14px 16px; cursor: pointer;
            display: flex; flex-direction: column; gap: 10px;
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


          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select className="filter-select" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
              <option value="all">All Reps</option>
              <option value="onTrack">On Track</option>
              <option value="atRisk">At Risk</option>
            </select>
          </div>

          {selectedIds.length > 0 && (
            <div style={{ backgroundColor: "#ffffff", border: "0.5px solid #E0E0DC", borderRadius: "6px", padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A1A1A" }}>{selectedIds.length} selected</span>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setSelectedIds([])} style={{ background: "none", border: "none", color: "#767676", fontSize: "13px", cursor: "pointer", marginLeft: "auto", fontFamily: "'DM Sans', sans-serif" }}>Clear selection</button>
            </div>
          )}

          <div className="desktop-only">
          <div style={{ backgroundColor: "#ffffff", border: "0.5px solid #E8E8E6", borderRadius: "8px", flex: 1, overflowY: "auto", minHeight: 0 }}>
            {sorted.length === 0 ? (
              <div style={{ fontSize: "14px", color: "#ABABAB", padding: "40px 0", textAlign: "center" }}>No reps found</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: "40px", padding: "10px 12px" }}>
                      <input type="checkbox"
                        checked={sorted.length > 0 && sorted.every(r => selectedIds.includes(r.id))}
                        onChange={e => setSelectedIds(e.target.checked ? sorted.map(r => r.id) : [])}
                        style={styles.checkbox}
                      />
                    </th>
                    <th style={{ ...styles.th, cursor: "pointer", userSelect: "none" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                      Rep {sortDirection === "asc" ? "↑" : "↓"}
                    </th>
                    <th style={styles.th}>Active</th>
                    <th style={styles.th}>Won</th>
                    <th style={styles.th}>Lost</th>
                    <th style={styles.th}>Logs/Week</th>
                    <th style={styles.th}>Total Logs</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(rep => (
                    <tr key={rep.id} className="data-row" style={{ cursor: "pointer" }} onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                      <td style={{ ...styles.td, padding: "12px 12px", width: "40px" }} onClick={e => { e.stopPropagation(); toggleSelect(rep.id); }}>
                        <input type="checkbox" checked={selectedIds.includes(rep.id)} readOnly style={styles.checkbox} />
                      </td>
                      <td style={styles.td} onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>{rep.full_name}</div>
                        <div style={{ fontSize: "12px", color: "#767676", marginTop: "2px" }}>{rep.email || "—"}</div>
                      </td>
                      <td style={styles.td}>{rep.activeCount}</td>
                      <td style={styles.td}>{rep.wonCount}</td>
                      <td style={styles.td}>{rep.lostCount}</td>
                      <td style={styles.td}>{rep.logsThisWeek}</td>
                      <td style={styles.td}>{rep.totalLogs}</td>
                      <td style={styles.td}>
                        <span style={{
                          fontSize: "12px", fontWeight: 500, padding: "2px 10px", borderRadius: "999px",
                          background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                          color: rep.atRisk ? "#DC2626" : "#16A34A",
                          border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                        }}>
                          {rep.atRisk ? "At Risk" : "On Track"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  main: { marginLeft: "220px", flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: "14px", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" },
  checkbox: { width: "16px", height: "16px", cursor: "pointer", accentColor: "#367C2B" },
  th: {
    backgroundColor: "#ffffff", fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    position: "sticky", top: 0, zIndex: 1, padding: "10px 20px", textAlign: "left",
    borderBottom: "1px solid #E8E8E6", textTransform: "uppercase", letterSpacing: "0.06em",
  },
  td: { fontSize: "13px", color: "#374151", padding: "12px 20px", borderBottom: "1px solid #F0F0ED" },
};
