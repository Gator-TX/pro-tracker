import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";

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

      const weeklyCount = acts?.length || 0;
      const atRisk = weeklyCount === 0 && (accounts || []).length > 0;

      return {
        ...rep,
        accountCount: (accounts || []).length,
        logsThisWeek: weeklyCount,
        atRisk,
      };
    }));

    setReps(repsWithData);
    setSelectedReps(repsWithData.map(r => r.id));

    const totalAccounts = repsWithData.reduce((sum, r) => sum + r.accountCount, 0);
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
          grid-template-columns: 1fr 80px 120px 100px;
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
          max-height: 600px; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 70px !important; overflow-x: hidden; }
          .table-scroll { max-height: 70vh; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .rep-table-header { display: none !important; }
          .rep-table-card { background: transparent !important; border: none !important; border-radius: 0 !important; overflow: visible !important; }
          .rep-row {
            display: flex !important; flex-direction: column !important;
            padding: 14px 16px !important; gap: 6px !important;
            background: #fff; border: 1px solid #E8E8E6; border-radius: 8px;
            margin: 0 0 8px; border-bottom: none !important;
          }
          .rep-col-name { font-size: 15px !important; font-weight: 600 !important; margin-bottom: 2px !important; }
          .rep-col-accounts::before { content: "ACCOUNTS  "; font-size: 11px; color: #ABABAB; font-weight: 600; }
          .rep-col-logs::before { content: "LOGS THIS WEEK  "; font-size: 11px; color: #ABABAB; font-weight: 600; }
          .rep-col-status { align-self: flex-start; }
          .export-btn-row { flex-direction: column !important; }
          .export-btn { flex: none !important; }
        }
      `}</style>

      <div style={styles.layout}>

        <MobileManagerHeader activePath="/dashboard" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
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
                  📊 Export as Excel (.xlsx)
                </button>
                <button className="export-btn" style={{ background: "#fff", color: "#374151", border: "1.5px solid #E0E0DC" }}>
                  📄 Export as PDF (.pdf)
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

          {/* REP TABLE */}
          <div className="rep-table-card" style={styles.tableCard}>
            <p style={styles.tableTitle}>Rep Activity</p>

            <div className="rep-table-header" style={{ ...styles.repRowStyle, ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1 }}>
              <span style={{ cursor: "pointer" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                Rep {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <span>Accounts</span>
              <span>Logs This Week</span>
              <span>Status</span>
            </div>

            <div className="table-scroll">
              {reps.length === 0 ? (
                <p style={styles.emptyText}>No reps found</p>
              ) : (
                [...reps].sort((a, b) => sortDirection === "asc"
                  ? a.full_name.localeCompare(b.full_name)
                  : b.full_name.localeCompare(a.full_name)
                ).map(rep => (
                  <div key={rep.id} className="rep-row"
                    onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                    <span className="rep-col-name" style={styles.repName}>{rep.full_name}</span>
                    <span className="rep-col-accounts" style={styles.repStat}>{rep.accountCount}</span>
                    <span className="rep-col-logs" style={styles.repStat}>{rep.logsThisWeek}</span>
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

        </div>
      </div>
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
    borderRadius: "8px", overflow: "hidden",
  },
  tableTitle: {
    fontSize: "14px", fontWeight: 600, color: "#1A1A1A",
    padding: "16px 20px 12px", borderBottom: "1px solid #F0F0ED",
  },
  repRowStyle: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 120px 100px",
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
