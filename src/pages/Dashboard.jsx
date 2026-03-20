import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [stats, setStats] = useState({
    activeReps: 0,
    accountsTracked: 0,
    activitiesThisWeek: 0,
    atRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [sprint, setSprint] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  // Export panel state
  const [exportRange, setExportRange] = useState("sprint");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedReps, setSelectedReps] = useState([]);
  const [includeOptions, setIncludeOptions] = useState({
    activity_log: true,
    account_status: true,
    contact_details: true,
    scheduled_activities: true,
    sprint_progress: true,
    at_risk: true,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    if (profileData?.role !== "manager") {
      navigate("/accounts");
      return;
    }

    const { data: repsData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "rep");

    const repsWithData = await Promise.all((repsData || []).map(async (rep) => {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, status")
        .eq("rep_id", rep.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];

      const { data: acts } = await supabase
        .from("activities")
        .select("id")
        .eq("rep_id", rep.id)
        .gte("activity_date", weekAgoStr);

      const { data: allActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id);

      const weeklyCount = acts?.length || 0;
      const totalLogs = allActs?.length || 0;

      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      const { data: recentActs } = await supabase
        .from("activities")
        .select("id")
        .eq("rep_id", rep.id)
        .gte("created_at", fortyEightHoursAgo.toISOString())
        .limit(1);
      const repIsNew = (new Date() - new Date(rep.created_at)) < 48 * 60 * 60 * 1000;
      const activeAccounts = (accounts || []).filter(a => ["New", "Contacted", "Engaged", "Proposal"].includes(a.status));
      const wonAccounts = (accounts || []).filter(a => a.status === "Won");
      const lostAccounts = (accounts || []).filter(a => a.status === "Lost");
      const atRisk = !repIsNew && (!recentActs || recentActs.length === 0) && activeAccounts.length > 0;

      return {
        ...rep,
        accountCount: (accounts || []).length || 0,
        activeCount: activeAccounts.length,
        wonCount: wonAccounts.length,
        lostCount: lostAccounts.length,
        logsThisWeek: weeklyCount,
        totalLogs,
        atRisk,
      };
    }));

    setReps(repsWithData);
    setSelectedReps(repsWithData.map(r => r.id));

    const totalAccounts = repsWithData.reduce((sum, r) => sum + (r.accountCount || 0), 0);
    const totalWeekly = repsWithData.reduce((sum, r) => sum + r.logsThisWeek, 0);
    const atRiskCount = repsWithData.filter(r => r.atRisk).length;

    setStats({
      activeReps: repsWithData.length,
      accountsTracked: totalAccounts,
      activitiesThisWeek: totalWeekly,
      atRisk: atRiskCount,
    });

    const today = new Date().toISOString().split("T")[0];
    const { data: sprintData } = await supabase
      .from("sprints")
      .select("*")
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(1)
      .single();
    setSprint(sprintData);

    setLoading(false);
  };

  const daysLeft = () => {
    if (!sprint) return null;
    const diff = Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const toggleRep = (repId) => {
    setSelectedReps(prev =>
      prev.includes(repId) ? prev.filter(id => id !== repId) : [...prev, repId]
    );
  };

  const toggleInclude = (key) => {
    setIncludeOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const STAT_CARDS = [
    { label: "Active Reps", value: stats.activeReps, color: "#367C2B" },
    { label: "Accounts Tracked", value: stats.accountsTracked, color: "#2563EB" },
    { label: "Activities This Week", value: stats.activitiesThisWeek, color: "#7C3AED" },
    { label: "At Risk", value: stats.atRisk, color: "#DC2626" },
  ];

  const sortedReps = [...reps].sort((a, b) => sortDirection === "asc"
    ? a.full_name.localeCompare(b.full_name)
    : b.full_name.localeCompare(a.full_name)
  );

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .rep-row {
          display: grid;
          grid-template-columns: 1fr 70px 70px 70px 110px 90px 100px;
          gap: 12px; align-items: center;
          padding: 13px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .rep-row:hover { background: #F9F9F8; }
        .rep-row:last-child { border-bottom: none; }

        .field-input {
          padding: 8px 10px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
        }
        .field-input:focus { border-color: #367C2B; }

        .export-btn {
          flex: 1; padding: 10px;
          border-radius: 6px; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.15s; border: none;
        }

        .range-pill {
          padding: 6px 14px; border-radius: 100px;
          font-size: 12px; font-weight: 500;
          border: 1.5px solid #E0E0DC; background: #fff;
          color: #767676; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; white-space: nowrap;
        }
        .range-pill.active {
          background: #367C2B; border-color: #367C2B; color: #fff;
        }

        .table-scroll {
          max-height: 600px; overflow-y: auto; min-width: 600px;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }
        .rep-row { min-width: 600px; }

        /* Kanban — hidden on desktop */
        .rep-kanban { display: none; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
            padding-top: 70px !important;
          }
          .table-scroll { max-height: 70vh; min-width: unset !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .export-btn-row { flex-direction: column !important; }
          .export-btn { flex: none !important; }

          /* Hide desktop table on mobile */
          .rep-table-card { display: none !important; }

          /* Kanban — single column */
          .rep-kanban {
            display: flex !important;
            flex-direction: column;
            gap: 8px;
          }
          .kanban-card {
            background: #fff;
            border: 1px solid #E8E8E6;
            border-radius: 8px;
            padding: 14px 16px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: background 0.15s;
          }
          .kanban-card:active { background: #F9F9F8; }
          .kanban-top-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }
          .kanban-name {
            font-size: 15px;
            font-weight: 600;
            color: #1A1A1A;
          }
          .kanban-badge {
            font-size: 10px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 100px;
            white-space: nowrap;
          }
          .kanban-stats {
            display: flex;
            gap: 20px;
            font-size: 12px;
            color: #374151;
          }
          .kanban-stat-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .kanban-stat-label {
            font-size: 9px;
            font-weight: 600;
            color: #ABABAB;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .kanban-stat-value { font-size: 14px; font-weight: 500; }
        }
      `}</style>

      <div style={styles.layout}>

        <MobileManagerHeader activePath="/dashboard" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Team Dashboard" profile={profile} onSignOut={handleSignOut} />

          {/* Top bar */}
          <div style={styles.topBar}>
            <div style={styles.topBarRight}>
              {daysLeft() !== null && (
                <div style={styles.sprintBadge}>{daysLeft()} days left</div>
              )}
              <button style={styles.exportTopBtn} onClick={() => setShowExport(p => !p)}>
                {showExport ? "Hide Export" : "Export Report"}
              </button>
            </div>
          </div>

          {/* EXPORT PANEL */}
          {showExport && (
            <div style={styles.exportPanel}>
              <p style={styles.exportTitle}>Export Report</p>

              <div style={styles.exportRow}>
                {[["sprint","This Sprint"],["7days","Last 7 Days"],["30days","Last 30 Days"],["custom","Custom Range"]].map(([r, label]) => (
                  <button key={r} className={`range-pill${exportRange === r ? " active" : ""}`}
                    onClick={() => setExportRange(r)}>{label}</button>
                ))}
              </div>

              {exportRange === "custom" && (
                <div style={styles.exportRow}>
                  <input className="field-input" type="date" value={customStart}
                    onChange={e => setCustomStart(e.target.value)} style={{ flex: 1 }} />
                  <span style={{ color: "#767676", fontSize: "13px" }}>to</span>
                  <input className="field-input" type="date" value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)} style={{ flex: 1 }} />
                </div>
              )}

              <div style={styles.exportColumns}>
                <div style={styles.exportCol}>
                  <p style={styles.exportColLabel}>Reps</p>
                  {reps.map(rep => (
                    <label key={rep.id} style={styles.checkRow}>
                      <input type="checkbox" checked={selectedReps.includes(rep.id)}
                        onChange={() => toggleRep(rep.id)} />
                      <span style={{ fontSize: "13px" }}>{rep.full_name}</span>
                    </label>
                  ))}
                </div>

                <div style={styles.exportCol}>
                  <p style={styles.exportColLabel}>Include in Report</p>
                  {Object.entries({
                    activity_log: "Activity Log",
                    account_status: "Account Status",
                    contact_details: "Contact Details",
                    scheduled_activities: "Scheduled Activities",
                    sprint_progress: "Sprint Progress",
                    at_risk: "At-Risk Accounts",
                  }).map(([key, label]) => (
                    <label key={key} style={styles.checkRow}>
                      <input type="checkbox" checked={includeOptions[key]}
                        onChange={() => toggleInclude(key)} />
                      <span style={{ fontSize: "13px" }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="export-btn-row" style={styles.exportBtnRow}>
                <button className="export-btn" style={{ background: "#367C2B", color: "#fff" }}>
                  Export as Excel (.xlsx)
                </button>
                <button className="export-btn" style={{ background: "#fff", color: "#374151", border: "1.5px solid #E0E0DC" }}>
                  Export as PDF (.pdf)
                </button>
              </div>
            </div>
          )}

          {/* STAT CARDS */}
          <div className="stat-grid" style={styles.statGrid}>
            {STAT_CARDS.map(card => (
              <div key={card.label} style={styles.statCard}>
                <p style={styles.statValue}>{card.value}</p>
                <p style={styles.statLabel}>{card.label}</p>
                <div style={{ ...styles.statAccent, background: card.color }} />
              </div>
            ))}
          </div>

          {/* DESKTOP: REP TABLE */}
          <div className="rep-table-card" style={styles.tableCard}>
            <p style={styles.tableTitle}>Rep Activity</p>

            <div className="rep-table-header" style={{ ...styles.repRowStyle, ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1, minWidth: "600px" }}>
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
              {reps.length === 0 ? (
                <p style={styles.emptyText}>No reps found</p>
              ) : (
                sortedReps.map(rep => (
                  <div key={rep.id} className="rep-row"
                    onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                    <span className="rep-col-name" style={styles.repName}>{rep.full_name}</span>
                    <span className="rep-col-active" style={styles.repStat}>{rep.activeCount}</span>
                    <span className="rep-col-won" style={styles.repStat}>{rep.wonCount}</span>
                    <span className="rep-col-lost" style={styles.repStat}>{rep.lostCount}</span>
                    <span className="rep-col-logs" style={styles.repStat}>{rep.logsThisWeek}</span>
                    <span className="rep-col-total" style={styles.repStat}>{rep.totalLogs}</span>
                    <span className="rep-col-status" style={{
                      ...styles.statusBadge,
                      background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                      color: rep.atRisk ? "#DC2626" : "#16A34A",
                      border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                    }}>
                      {rep.atRisk ? "At Risk" : "On Track"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MOBILE: KANBAN GRID */}
          <div className="rep-kanban">
            {reps.length === 0 ? (
              <p style={{ fontSize: "14px", color: "#ABABAB", gridColumn: "1 / -1" }}>No reps found</p>
            ) : (
              sortedReps.map(rep => (
                <div
                  key={rep.id}
                  className="kanban-card"
                  style={{ borderLeft: `3px solid ${rep.atRisk ? "#DC2626" : "#367C2B"}` }}
                  onClick={() => navigate(`/dashboard/reps/${rep.id}`)}
                >
                  <div className="kanban-top-row">
                    <span className="kanban-name">{rep.full_name}</span>
                    <span
                      className="kanban-badge"
                      style={{
                        background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                        color: rep.atRisk ? "#DC2626" : "#16A34A",
                        border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                      }}
                    >
                      {rep.atRisk ? "At Risk" : "On Track"}
                    </span>
                  </div>
                  <div className="kanban-stats">
                    <div className="kanban-stat-item">
                      <span className="kanban-stat-label">Active</span>
                      <span className="kanban-stat-value">{rep.activeCount}</span>
                    </div>
                    <div className="kanban-stat-item">
                      <span className="kanban-stat-label">Won</span>
                      <span className="kanban-stat-value" style={{ color: "#16A34A" }}>{rep.wonCount}</span>
                    </div>
                    <div className="kanban-stat-item">
                      <span className="kanban-stat-label">Lost</span>
                      <span className="kanban-stat-value" style={{ color: "#DC2626" }}>{rep.lostCount}</span>
                    </div>
                    <div className="kanban-stat-item">
                      <span className="kanban-stat-label">Logs/Wk</span>
                      <span className="kanban-stat-value">{rep.logsThisWeek}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

                  </PullToRefresh>
        </div>
      </div>

      <ManagerBottomNav activePath="/dashboard" />
    </>
  );
}

const styles = {
  layout: {
    display: "flex", minHeight: "100vh",
    backgroundColor: "#F5F5F3",
    fontFamily: "'DM Sans', sans-serif",
  },
  loadingPage: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#F5F5F3",
  },
  spinner: {
    width: "32px", height: "32px", borderRadius: "50%",
    border: "3px solid #E0E0DC", borderTopColor: "#367C2B",
    animation: "spin 0.8s linear infinite",
  },
  main: {
    marginLeft: "220px", flex: 1,
    padding: "28px 32px",
    display: "flex", flexDirection: "column", gap: "20px",
    minHeight: "100vh",
  },
  topBar: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: "16px",
  },
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },
  topBarRight: { display: "flex", alignItems: "center", gap: "12px" },
  sprintBadge: {
    backgroundColor: "#FFDE00", color: "#1A1A1A",
    fontSize: "12px", fontWeight: 700,
    padding: "5px 12px", borderRadius: "100px",
  },
  exportTopBtn: {
    padding: "8px 16px", background: "#367C2B", color: "#fff",
    border: "none", borderRadius: "6px",
    fontSize: "13px", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  topBarEmail: { fontSize: "13px", color: "#767676" },
  exportPanel: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "8px", padding: "20px",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  exportTitle: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  exportRow: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  exportColumns: { display: "flex", gap: "32px", flexWrap: "wrap" },
  exportCol: { display: "flex", flexDirection: "column", gap: "8px", minWidth: "180px" },
  exportColLabel: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  checkRow: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  exportBtnRow: { display: "flex", gap: "10px" },
  statGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px",
  },
  statCard: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "8px", padding: "20px 16px",
    position: "relative", overflow: "hidden",
  },
  statValue: { fontSize: "32px", fontWeight: 600, color: "#1A1A1A", lineHeight: 1 },
  statLabel: { fontSize: "12px", color: "#767676", marginTop: "6px" },
  statAccent: { position: "absolute", bottom: 0, left: 0, right: 0, height: "3px" },
  tableCard: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch",
  },
  tableTitle: {
    fontSize: "14px", fontWeight: 600, color: "#1A1A1A",
    padding: "16px 20px 12px", borderBottom: "1px solid #F0F0ED",
  },
  repRowStyle: {
    display: "grid",
    gridTemplateColumns: "1fr 70px 70px 70px 110px 90px 100px",
    gap: "12px", alignItems: "center",
    padding: "13px 20px",
    borderBottom: "1px solid #F0F0ED",
  },
  tableHeader: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  repName: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  repStat: { fontSize: "14px", color: "#374151" },
  statusBadge: {
    fontSize: "11px", fontWeight: 600,
    padding: "4px 10px", borderRadius: "100px",
    whiteSpace: "nowrap", textAlign: "center",
  },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 16px" },
};
