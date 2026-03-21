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
    totalActive: 0,
    totalWon: 0,
    totalLost: 0,
    atRiskAccounts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [sprint, setSprint] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [atRiskAccountsList, setAtRiskAccountsList] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
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
    const totalActive = repsWithData.reduce((sum, r) => sum + r.activeCount, 0);
    const totalWon = repsWithData.reduce((sum, r) => sum + r.wonCount, 0);
    const totalLost = repsWithData.reduce((sum, r) => sum + r.lostCount, 0);

    // Build rep name map for cross-referencing
    const repNameMap = {};
    repsWithData.forEach(r => { repNameMap[r.id] = r.full_name; });

    // Fetch all accounts for name map + at-risk analysis
    const ACTIVE_STATUSES = ["New", "Contacted", "Engaged", "Proposal"];
    const { data: allAccountsData } = await supabase
      .from("accounts")
      .select("id, name, company, status, rep_id");

    const accountNameMap = {};
    (allAccountsData || []).forEach(a => {
      accountNameMap[a.id] = a.name || a.company;
    });

    // Find last activity date per active account
    const activeAccIds = (allAccountsData || [])
      .filter(a => ACTIVE_STATUSES.includes(a.status))
      .map(a => a.id);

    let lastActMap = {};
    if (activeAccIds.length > 0) {
      const { data: lastActs } = await supabase
        .from("activities")
        .select("account_id, activity_date")
        .in("account_id", activeAccIds)
        .order("activity_date", { ascending: false });
      (lastActs || []).forEach(act => {
        if (!lastActMap[act.account_id]) lastActMap[act.account_id] = act.activity_date;
      });
    }

    const cutoff48h = new Date();
    cutoff48h.setHours(cutoff48h.getHours() - 48);

    const atRiskList = (allAccountsData || [])
      .filter(a => ACTIVE_STATUSES.includes(a.status))
      .filter(a => !lastActMap[a.id] || new Date(lastActMap[a.id]) < cutoff48h)
      .map(a => ({
        id: a.id,
        name: a.name || a.company,
        status: a.status,
        repName: repNameMap[a.rep_id] || "Unassigned",
        lastActivity: lastActMap[a.id] || null,
      }));
    setAtRiskAccountsList(atRiskList);

    // Recent activity feed
    const { data: recentActsData } = await supabase
      .from("activities")
      .select("id, activity_type, activity_date, outcome, notes, account_id, rep_id")
      .order("activity_date", { ascending: false })
      .limit(8);
    setRecentActivities((recentActsData || []).map(act => ({
      ...act,
      accountName: accountNameMap[act.account_id] || "Unknown",
      repName: repNameMap[act.rep_id] || "Unknown",
    })));

    setStats({
      activeReps: repsWithData.length,
      accountsTracked: totalAccounts,
      activitiesThisWeek: totalWeekly,
      atRisk: atRiskCount,
      totalActive,
      totalWon,
      totalLost,
      atRiskAccounts: atRiskList.length,
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

  const sprintProgress = () => {
    if (!sprint) return 0;
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const total = (end - start) / (1000 * 60 * 60 * 24);
    const elapsed = (new Date() - start) / (1000 * 60 * 60 * 24);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

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

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

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

        .dashboard-desktop-only { display: none !important; }
        @media (min-width: 769px) {
          .dashboard-desktop-only { display: flex !important; }
        }

        /* Mobile overview — hidden on desktop */
        .dash-mobile { display: none; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
            padding-top: 86px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-bottom: 32px !important;
          }
          .table-scroll { max-height: 70vh; min-width: unset !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .export-btn-row { flex-direction: column !important; }
          .export-btn { flex: none !important; }
          .rep-table-card { display: none !important; }

          /* Mobile overview */
          .dash-mobile {
            display: flex !important;
            flex-direction: column;
            gap: 20px;
            margin-top: 4px;
          }
          .dash-section-label {
            font-size: 11px; font-weight: 600; color: #ABABAB;
            text-transform: uppercase; letter-spacing: 0.08em;
            margin-bottom: 8px;
          }
          .dash-card-list {
            display: flex; flex-direction: column; gap: 8px;
          }
          .dash-kanban-card {
            width: 100%; box-sizing: border-box;
            background: #fff; border: 1px solid #E8E8E6;
            border-radius: 8px; padding: 14px 16px;
            display: flex; flex-direction: column; gap: 8px;
            cursor: pointer; transition: background 0.15s;
          }
          .dash-kanban-card:active { background: #F9F9F8; }
          .dash-card-row {
            display: flex; align-items: center;
            justify-content: space-between; gap: 8px;
          }
          .dash-card-name {
            font-size: 15px; font-weight: 600; color: #1A1A1A;
            flex: 1; min-width: 0; overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap;
          }
          .dash-card-badge {
            font-size: 10px; font-weight: 600;
            padding: 3px 8px; border-radius: 100px; white-space: nowrap;
          }
          .dash-card-meta {
            font-size: 12px; color: #ABABAB; white-space: nowrap;
          }
          .dash-card-meta-left {
            font-size: 12px; color: #ABABAB;
            flex: 1; min-width: 0; overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap;
          }
          .dash-stat-row {
            display: flex; gap: 20px;
          }
          .dash-stat-item {
            display: flex; flex-direction: column; gap: 2px;
          }
          .dash-stat-label {
            font-size: 9px; font-weight: 600; color: #ABABAB;
            text-transform: uppercase; letter-spacing: 0.06em;
          }
          .dash-stat-value { font-size: 14px; font-weight: 500; }

          /* Sprint card */
          .dash-sprint-card {
            width: 100%; box-sizing: border-box;
            background: #fff; border: 1px solid #E8E8E6;
            border-radius: 8px; padding: 16px;
            display: flex; flex-direction: column; gap: 12px;
          }
          .dash-sprint-top {
            display: flex; justify-content: space-between; align-items: center;
          }
          .dash-sprint-name {
            font-size: 14px; font-weight: 600; color: #1A1A1A;
          }
          .dash-sprint-days {
            font-size: 12px; font-weight: 700;
            background: #FFDE00; color: #1A1A1A;
            padding: 3px 10px; border-radius: 100px;
          }
          .dash-progress-track {
            height: 6px; background: #F0F0ED;
            border-radius: 3px; overflow: hidden;
          }
          .dash-progress-fill {
            height: 100%; background: #367C2B;
            border-radius: 3px; transition: width 0.3s ease;
          }
          .dash-sprint-stats {
            display: flex; gap: 24px;
          }
          .dash-sprint-stat {
            display: flex; flex-direction: column; gap: 2px;
          }
          .dash-sprint-stat-label {
            font-size: 9px; font-weight: 600; color: #ABABAB;
            text-transform: uppercase; letter-spacing: 0.06em;
          }
          .dash-sprint-stat-value { font-size: 16px; font-weight: 600; color: #1A1A1A; }

          /* Activity feed */
          .dash-activity-feed {
            background: #fff; border: 1px solid #E8E8E6;
            border-radius: 8px; overflow: hidden;
          }
          .dash-act-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 11px 14px; border-bottom: 1px solid #F0F0ED;
          }
          .dash-act-row:last-child { border-bottom: none; }
          .dash-act-type {
            flex-shrink: 0; font-size: 10px; font-weight: 600;
            padding: 3px 8px; border-radius: 100px; white-space: nowrap; margin-top: 2px;
          }
          .dash-act-middle { flex: 1; min-width: 0; }
          .dash-act-account {
            font-size: 13px; font-weight: 600; color: #1A1A1A; margin-bottom: 2px;
          }
          .dash-act-rep { font-size: 11px; color: #767676; }
          .dash-act-date { font-size: 11px; color: #ABABAB; white-space: nowrap; flex-shrink: 0; }
        }
      `}</style>

      <div style={styles.layout}>

        <MobileManagerHeader activePath="/dashboard" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Team Dashboard" profile={profile} onSignOut={handleSignOut} />

          {/* Desktop top bar */}
          <div style={styles.topBar}>
            <div className="dashboard-desktop-only" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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

          {/* DESKTOP: STAT CARDS */}
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

          {/* ── MOBILE OVERVIEW ── */}
          <div className="dash-mobile">

            {/* 1. Account stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { label: "Active", value: stats.totalActive, color: "#2563EB", bg: "#EFF6FF" },
                { label: "At Risk", value: stats.atRiskAccounts, color: "#DC2626", bg: "#FEF2F2" },
                { label: "Won", value: stats.totalWon, color: "#16A34A", bg: "#F0FDF4" },
                { label: "Lost", value: stats.totalLost, color: "#767676", bg: "#F5F5F3" },
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, borderRadius: "8px", padding: "14px 16px", border: "1px solid #E8E8E6" }}>
                  <p style={{ fontSize: "28px", fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</p>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "#374151", marginTop: "4px" }}>{card.label} Accounts</p>
                </div>
              ))}
            </div>

            {/* 2. Needs Attention */}
            {atRiskAccountsList.length > 0 && (
              <div>
                <p className="dash-section-label">Needs Attention ({atRiskAccountsList.length})</p>
                <div className="dash-card-list">
                  {atRiskAccountsList.slice(0, 6).map(acc => (
                    <div key={acc.id} className="dash-kanban-card"
                      style={{ borderLeft: "3px solid #DC2626" }}>
                      <div className="dash-card-row">
                        <span className="dash-card-name">{acc.name}</span>
                        <span className="dash-card-badge" style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                          {acc.status}
                        </span>
                      </div>
                      <div className="dash-card-row">
                        <span className="dash-card-meta-left">{acc.repName}</span>
                        <span className="dash-card-meta">
                          {acc.lastActivity ? `Last: ${formatDate(acc.lastActivity)}` : "No activity"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {atRiskAccountsList.length > 6 && (
                    <p style={{ fontSize: "12px", color: "#767676", textAlign: "center", paddingTop: "4px" }}>
                      +{atRiskAccountsList.length - 6} more — view in Accounts
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 3. Sprint Progress */}
            {sprint && (
              <div>
                <p className="dash-section-label">Sprint</p>
                <div className="dash-sprint-card">
                  <div className="dash-sprint-top">
                    <span className="dash-sprint-name">{sprint.name || "Current Sprint"}</span>
                    {daysLeft() !== null && (
                      <span className="dash-sprint-days">{daysLeft()}d left</span>
                    )}
                  </div>
                  <div className="dash-progress-track">
                    <div className="dash-progress-fill" style={{ width: `${sprintProgress()}%` }} />
                  </div>
                  <div className="dash-sprint-stats">
                    <div className="dash-sprint-stat">
                      <span className="dash-sprint-stat-label">Won</span>
                      <span className="dash-sprint-stat-value" style={{ color: "#16A34A" }}>{stats.totalWon}</span>
                    </div>
                    <div className="dash-sprint-stat">
                      <span className="dash-sprint-stat-label">Active</span>
                      <span className="dash-sprint-stat-value">{stats.totalActive}</span>
                    </div>
                    <div className="dash-sprint-stat">
                      <span className="dash-sprint-stat-label">Activities / Wk</span>
                      <span className="dash-sprint-stat-value">{stats.activitiesThisWeek}</span>
                    </div>
                    <div className="dash-sprint-stat">
                      <span className="dash-sprint-stat-label">Progress</span>
                      <span className="dash-sprint-stat-value">{sprintProgress()}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Recent Activity */}
            {recentActivities.length > 0 && (
              <div>
                <p className="dash-section-label">Recent Activity</p>
                <div className="dash-activity-feed">
                  {recentActivities.map(act => {
                    const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                    return (
                      <div key={act.id} className="dash-act-row">
                        <span className="dash-act-type" style={{ background: tc.bg, color: tc.color }}>
                          {act.activity_type}
                        </span>
                        <div className="dash-act-middle">
                          <p className="dash-act-account">{act.accountName}</p>
                          <p className="dash-act-rep">{act.repName}</p>
                        </div>
                        <span className="dash-act-date">{formatDate(act.activity_date)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Rep Pulse */}
            <div>
              <p className="dash-section-label">Rep Pulse</p>
              <div className="dash-card-list">
                {sortedReps.map(rep => (
                  <div key={rep.id} className="dash-kanban-card"
                    style={{ borderLeft: `3px solid ${rep.atRisk ? "#DC2626" : "#367C2B"}` }}
                    onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                    <div className="dash-card-row">
                      <span className="dash-card-name">{rep.full_name}</span>
                      <span className="dash-card-badge" style={{
                        background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                        color: rep.atRisk ? "#DC2626" : "#16A34A",
                        border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                      }}>
                        {rep.atRisk ? "At Risk" : "On Track"}
                      </span>
                    </div>
                    <div className="dash-stat-row">
                      <div className="dash-stat-item">
                        <span className="dash-stat-label">Active</span>
                        <span className="dash-stat-value">{rep.activeCount}</span>
                      </div>
                      <div className="dash-stat-item">
                        <span className="dash-stat-label">Won</span>
                        <span className="dash-stat-value" style={{ color: "#16A34A" }}>{rep.wonCount}</span>
                      </div>
                      <div className="dash-stat-item">
                        <span className="dash-stat-label">Lost</span>
                        <span className="dash-stat-value" style={{ color: "#DC2626" }}>{rep.lostCount}</span>
                      </div>
                      <div className="dash-stat-item">
                        <span className="dash-stat-label">Logs/Wk</span>
                        <span className="dash-stat-value">{rep.logsThisWeek}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>{/* end dash-mobile */}

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
