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
    activeReps: 0, accountsTracked: 0, activitiesThisWeek: 0, atRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [sprint, setSprint] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [accountHealth, setAccountHealth] = useState({
    New: 0, Contacted: 0, Engaged: 0, Proposal: 0, Won: 0, Lost: 0,
  });
  const [atRiskAccountsList, setAtRiskAccountsList] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [sprintRepStats, setSprintRepStats] = useState({ withActivity: 0, withoutActivity: 0 });
  const [atRiskRepsList, setAtRiskRepsList] = useState([]);
  // Export panel state
  const [exportRange, setExportRange] = useState("sprint");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedReps, setSelectedReps] = useState([]);
  const [includeOptions, setIncludeOptions] = useState({
    activity_log: true, account_status: true, contact_details: true,
    scheduled_activities: true, sprint_progress: true, at_risk: true,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/accounts"); return; }

    // Fetch sprint first so start_date is available for activity queries
    const today = new Date().toISOString().split("T")[0];
    const { data: sprintData } = await supabase
      .from("sprints").select("*")
      .lte("start_date", today).gte("end_date", today).limit(1).single();
    setSprint(sprintData);

    // Fetch reps
    const { data: repsData } = await supabase
      .from("profiles").select("*").eq("role", "rep");

    const repsWithData = await Promise.all((repsData || []).map(async (rep) => {
      const { data: accounts } = await supabase
        .from("accounts").select("id, status").eq("rep_id", rep.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];

      const { data: acts } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id).gte("activity_date", weekAgoStr);
      const { data: allActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id);

      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      const { data: recentActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id)
        .gte("created_at", fortyEightHoursAgo.toISOString()).limit(1);

      const { data: lastActRow } = await supabase
        .from("activities").select("activity_date")
        .eq("rep_id", rep.id).order("activity_date", { ascending: false }).limit(1);
      const lastActDate = lastActRow?.[0]?.activity_date || null;

      const repIsNew = (new Date() - new Date(rep.created_at)) < 48 * 60 * 60 * 1000;
      const activeAccounts = (accounts || []).filter(a =>
        ["New", "Contacted", "Engaged", "Proposal"].includes(a.status));
      const wonAccounts = (accounts || []).filter(a => a.status === "Won");
      const lostAccounts = (accounts || []).filter(a => a.status === "Lost");
      const atRisk = !repIsNew && (!recentActs || recentActs.length === 0) && activeAccounts.length > 0;

      return {
        ...rep,
        accountCount: (accounts || []).length || 0,
        activeCount: activeAccounts.length,
        wonCount: wonAccounts.length,
        lostCount: lostAccounts.length,
        logsThisWeek: acts?.length || 0,
        totalLogs: allActs?.length || 0,
        lastActDate,
        atRisk,
      };
    }));

    setReps(repsWithData);
    setSelectedReps(repsWithData.map(r => r.id));

    const atRiskReps = repsWithData.filter(r => r.atRisk).map(r => {
      let sinceLabel = "Never";
      if (r.lastActDate) {
        const hoursAgo = Math.floor((new Date() - new Date(r.lastActDate)) / (1000 * 60 * 60));
        sinceLabel = hoursAgo >= 48 ? `${Math.floor(hoursAgo / 24)}d ago` : `${hoursAgo}h ago`;
      }
      return { ...r, sinceLabel };
    });
    setAtRiskRepsList(atRiskReps);

    const totalAccounts = repsWithData.reduce((s, r) => s + (r.accountCount || 0), 0);
    const totalWeekly = repsWithData.reduce((s, r) => s + r.logsThisWeek, 0);
    const atRiskCount = repsWithData.filter(r => r.atRisk).length;
    setStats({ activeReps: repsWithData.length, accountsTracked: totalAccounts, activitiesThisWeek: totalWeekly, atRisk: atRiskCount });

    const repNameMap = {};
    repsWithData.forEach(r => { repNameMap[r.id] = r.full_name; });

    // All accounts — health counts + name map
    const { data: allAccountsData } = await supabase
      .from("accounts").select("id, name, company, status, rep_id");

    const health = { New: 0, Contacted: 0, Engaged: 0, Proposal: 0, Won: 0, Lost: 0 };
    const accountNameMap = {};
    (allAccountsData || []).forEach(a => {
      accountNameMap[a.id] = a.name || a.company;
      if (Object.hasOwn(health, a.status)) health[a.status]++;
    });
    setAccountHealth(health);

    // At-risk accounts: assigned, active status, no activity in 7+ days
    const ACTIVE = ["New", "Contacted", "Engaged", "Proposal"];
    const activeAccIds = (allAccountsData || [])
      .filter(a => a.rep_id !== null && ACTIVE.includes(a.status)).map(a => a.id);
    let lastActMap = {};
    if (activeAccIds.length > 0) {
      const { data: lastActs } = await supabase
        .from("activities").select("account_id, activity_date")
        .in("account_id", activeAccIds).order("activity_date", { ascending: false });
      (lastActs || []).forEach(act => {
        if (!lastActMap[act.account_id]) lastActMap[act.account_id] = act.activity_date;
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const atRiskList = (allAccountsData || [])
      .filter(a => a.rep_id !== null && ACTIVE.includes(a.status))
      .filter(a => !lastActMap[a.id] || new Date(lastActMap[a.id]) < sevenDaysAgo)
      .map(a => ({
        id: a.id,
        name: a.name || a.company,
        status: a.status,
        repName: repNameMap[a.rep_id] || "Unassigned",
        lastActivity: lastActMap[a.id] || null,
        daysSince: lastActMap[a.id]
          ? Math.floor((new Date() - new Date(lastActMap[a.id])) / (1000 * 60 * 60 * 24))
          : null,
      }))
      .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));
    setAtRiskAccountsList(atRiskList);

    // Recent activities (last 5 displayed)
    const { data: recentActsData } = await supabase
      .from("activities").select("id, activity_type, activity_date, outcome, notes, account_id, rep_id")
      .order("activity_date", { ascending: false }).limit(20);
    setRecentActivities((recentActsData || []).slice(0, 5).map(act => ({
      ...act,
      accountName: accountNameMap[act.account_id] || "Unknown",
      repName: repNameMap[act.rep_id] || "Unknown",
    })));

    // Sprint rep stats: reps who logged at least once since sprint start
    if (sprintData) {
      const { data: sprintActs } = await supabase
        .from("activities").select("rep_id").gte("activity_date", sprintData.start_date);
      const repsWithActSet = new Set((sprintActs || []).map(a => a.rep_id).filter(id => repNameMap[id]));
      const withActivity = repsWithActSet.size;
      setSprintRepStats({ withActivity, withoutActivity: repsWithData.length - withActivity });
    }

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
    const elapsed = (new Date() - start) / (1000 * 60 * 60 * 24);
    const total = (end - start) / (1000 * 60 * 60 * 24);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const todayLabel = () => new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const toggleRep = (repId) => {
    setSelectedReps(prev => prev.includes(repId) ? prev.filter(id => id !== repId) : [...prev, repId]);
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

  const totalHealthAccounts = Object.values(accountHealth).reduce((s, v) => s + v, 0) || 1;
  const activeAccountCount = accountHealth.New + accountHealth.Contacted + accountHealth.Engaged + accountHealth.Proposal;

  const HEALTH_BARS = [
    { key: "New",       color: "#2563EB", bg: "#DBEAFE" },
    { key: "Contacted", color: "#CA8A04", bg: "#FDE68A" },
    { key: "Engaged",   color: "#16A34A", bg: "#BBF7D0" },
    { key: "Proposal",  color: "#7C3AED", bg: "#DDD6FE" },
    { key: "Won",       color: "#367C2B", bg: "#BBF7D0" },
    { key: "Lost",      color: "#DC2626", bg: "#FECACA" },
  ];

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

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
          flex: 1; padding: 10px; border-radius: 6px;
          font-size: 13px; font-weight: 600;
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
        .range-pill.active { background: #367C2B; border-color: #367C2B; color: #fff; }

        .table-scroll {
          max-height: 600px; overflow-y: auto; min-width: 600px;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }
        .rep-row { min-width: 600px; }

        .dashboard-desktop-only { display: none !important; }
        @media (min-width: 769px) {
          .dashboard-desktop-only { display: flex !important; }
        }

        /* Hide desktop-only sections on mobile */
        .dash-dt-only { display: block; }

        /* Mobile overview hidden on desktop */
        .dash-mobile { display: none; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
            padding-top: 86px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-bottom: 8px !important;
          }
          .table-scroll { max-height: 70vh; min-width: unset !important; }
          .export-btn-row { flex-direction: column !important; }
          .export-btn { flex: none !important; }
          .rep-table-card { display: none !important; }
          .dash-dt-only { display: none !important; }

          /* Mobile overview */
          .dash-mobile {
            display: flex !important;
            flex-direction: column;
            gap: 16px;
          }

          /* Section label */
          .dm-label {
            font-size: 11px; font-weight: 600; color: #ABABAB;
            text-transform: uppercase; letter-spacing: 0.08em;
            margin-bottom: 8px;
          }

          /* White card base */
          .dm-card {
            background: #fff; border: 1px solid #E8E8E6;
            border-radius: 8px; padding: 14px 16px;
            width: 100%; box-sizing: border-box;
          }

          /* Stat grid 2x2 */
          .dm-stat-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
          }
          .dm-stat-card {
            background: #fff; border: 1px solid #E8E8E6;
            border-radius: 8px; padding: 14px 16px;
            position: relative; overflow: hidden;
          }
          .dm-stat-value { font-size: 28px; font-weight: 700; color: #1A1A1A; line-height: 1; }
          .dm-stat-lbl { font-size: 11px; color: #767676; margin-top: 4px; }
          .dm-stat-accent { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }

          /* Account health */
          .dm-health-row {
            display: flex; align-items: center; gap: 8px; padding: 5px 0;
          }
          .dm-health-name {
            font-size: 12px; font-weight: 500; color: #374151;
            width: 65px; flex-shrink: 0;
          }
          .dm-health-track {
            flex: 1; height: 7px; background: #F0F0ED;
            border-radius: 4px; overflow: hidden;
          }
          .dm-health-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
          .dm-health-count {
            font-size: 12px; font-weight: 600; color: #374151;
            width: 24px; text-align: right; flex-shrink: 0;
          }

          /* Sprint overview */
          .dm-sprint-numbers {
            display: flex; gap: 12px; margin-bottom: 12px;
          }
          .dm-sprint-num {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; gap: 4px;
          }
          .dm-sprint-val {
            font-size: 24px; font-weight: 700; color: #1A1A1A; line-height: 1;
          }
          .dm-sprint-pill {
            font-size: 9px; font-weight: 700; padding: 3px 8px;
            border-radius: 100px; text-transform: uppercase; letter-spacing: 0.06em;
          }
          .dm-progress-track {
            height: 5px; background: #F0F0ED; border-radius: 3px; overflow: hidden; margin-bottom: 6px;
          }
          .dm-progress-fill { height: 100%; background: #367C2B; border-radius: 3px; }
          .dm-progress-label { font-size: 11px; color: #ABABAB; }

          /* At risk card */
          .dm-risk-card {
            background: #FEF2F2; border: 1px solid #FECACA;
            border-radius: 8px; padding: 14px 16px;
            width: 100%; box-sizing: border-box;
          }
          .dm-risk-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
          }
          .dm-risk-label {
            font-size: 11px; font-weight: 700; color: #DC2626;
            text-transform: uppercase; letter-spacing: 0.08em;
          }
          .dm-risk-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 0; border-bottom: 1px solid #FECACA;
          }
          .dm-risk-row:last-of-type { border-bottom: none; }
          .dm-risk-name { font-size: 13px; font-weight: 600; color: #1A1A1A; }
          .dm-risk-rep { font-size: 11px; color: #767676; margin-top: 1px; }
          .dm-days-pill {
            font-size: 10px; font-weight: 700; padding: 3px 8px;
            border-radius: 100px; background: #FECACA; color: #DC2626;
            white-space: nowrap; flex-shrink: 0;
          }
          .dm-viewall {
            font-size: 12px; font-weight: 600; color: #DC2626;
            background: none; border: none; padding: 8px 0 0;
            cursor: pointer; font-family: 'DM Sans', sans-serif;
          }

          /* Activity feed */
          .dm-act-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 10px 0; border-bottom: 1px solid #F0F0ED;
          }
          .dm-act-row:last-child { border-bottom: none; }
          .dm-act-badge {
            flex-shrink: 0; font-size: 10px; font-weight: 600;
            padding: 3px 8px; border-radius: 100px; white-space: nowrap; margin-top: 2px;
          }
          .dm-act-middle { flex: 1; min-width: 0; }
          .dm-act-account { font-size: 13px; font-weight: 600; color: #1A1A1A; margin-bottom: 2px; }
          .dm-act-sub {
            font-size: 11px; color: #767676;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .dm-act-date { font-size: 11px; color: #ABABAB; white-space: nowrap; flex-shrink: 0; }

          /* Card header row */
          .dm-card-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
          }
          .dm-card-title { font-size: 13px; font-weight: 600; color: #1A1A1A; }
          .dm-viewall-link {
            font-size: 12px; color: #367C2B; font-weight: 600;
            background: none; border: none; padding: 0;
            cursor: pointer; font-family: 'DM Sans', sans-serif;
          }

        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard" />

        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Team Dashboard" profile={profile} onSignOut={handleSignOut} />

          {/* Desktop top bar with sprint badge + export */}
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

          {/* EXPORT PANEL — desktop only */}
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
                      <input type="checkbox" checked={selectedReps.includes(rep.id)} onChange={() => toggleRep(rep.id)} />
                      <span style={{ fontSize: "13px" }}>{rep.full_name}</span>
                    </label>
                  ))}
                </div>
                <div style={styles.exportCol}>
                  <p style={styles.exportColLabel}>Include in Report</p>
                  {Object.entries({
                    activity_log: "Activity Log", account_status: "Account Status",
                    contact_details: "Contact Details", scheduled_activities: "Scheduled Activities",
                    sprint_progress: "Sprint Progress", at_risk: "At-Risk Accounts",
                  }).map(([key, label]) => (
                    <label key={key} style={styles.checkRow}>
                      <input type="checkbox" checked={includeOptions[key]} onChange={() => toggleInclude(key)} />
                      <span style={{ fontSize: "13px" }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="export-btn-row" style={styles.exportBtnRow}>
                <button className="export-btn" style={{ background: "#367C2B", color: "#fff" }}>Export as Excel (.xlsx)</button>
                <button className="export-btn" style={{ background: "#fff", color: "#374151", border: "1.5px solid #E0E0DC" }}>Export as PDF (.pdf)</button>
              </div>
            </div>
          )}

          {/* DESKTOP: Stat cards */}
          <div className="dash-dt-only" style={styles.statGrid}>
            {STAT_CARDS.map(card => (
              <div key={card.label} style={styles.statCard}>
                <p style={styles.statValue}>{card.value}</p>
                <p style={styles.statLabel}>{card.label}</p>
                <div style={{ ...styles.statAccent, background: card.color }} />
              </div>
            ))}
          </div>

          {/* DESKTOP: Rep table */}
          <div className="rep-table-card" style={styles.tableCard}>
            <p style={styles.tableTitle}>Rep Activity</p>
            <div className="rep-table-header" style={{ ...styles.repRowStyle, ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1, minWidth: "600px" }}>
              <span style={{ cursor: "pointer" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                Rep {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <span>Active</span><span>Won</span><span>Lost</span>
              <span>Logs This Week</span><span>Total Logs</span><span>Status</span>
            </div>
            <div className="table-scroll">
              {reps.length === 0 ? (
                <p style={styles.emptyText}>No reps found</p>
              ) : (
                sortedReps.map(rep => (
                  <div key={rep.id} className="rep-row" onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                    <span style={styles.repName}>{rep.full_name}</span>
                    <span style={styles.repStat}>{rep.activeCount}</span>
                    <span style={styles.repStat}>{rep.wonCount}</span>
                    <span style={styles.repStat}>{rep.lostCount}</span>
                    <span style={styles.repStat}>{rep.logsThisWeek}</span>
                    <span style={styles.repStat}>{rep.totalLogs}</span>
                    <span style={{
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

          {/* ══════════ MOBILE OVERVIEW ══════════ */}
          <div className="dash-mobile">

            {/* 1. Date line */}
            <p style={{ fontSize: "12px", color: "#ABABAB", marginBottom: "-8px" }}>{todayLabel()}</p>

            {/* 2. Stat cards 2x2 */}
            <div className="dm-stat-grid">
              {[
                { label: "Active Accounts", value: activeAccountCount, color: "#367C2B" },
                { label: "At Risk Reps", value: stats.atRisk, color: "#DC2626" },
                { label: "Won This Sprint", value: accountHealth.Won, color: "#367C2B" },
                { label: "Lost This Sprint", value: accountHealth.Lost, color: "#CA8A04" },
              ].map(card => (
                <div key={card.label} className="dm-stat-card">
                  <p className="dm-stat-value">{card.value}</p>
                  <p className="dm-stat-lbl">{card.label}</p>
                  <div className="dm-stat-accent" style={{ background: card.color }} />
                </div>
              ))}
            </div>

            {/* 3. Account Health */}
            <div>
              <p className="dm-label">Account Health</p>
              <div className="dm-card">
                {HEALTH_BARS.map(bar => (
                  <div key={bar.key} className="dm-health-row">
                    <span className="dm-health-name">{bar.key}</span>
                    <div className="dm-health-track">
                      <div
                        className="dm-health-fill"
                        style={{
                          width: `${Math.round((accountHealth[bar.key] / totalHealthAccounts) * 100)}%`,
                          background: bar.color,
                        }}
                      />
                    </div>
                    <span className="dm-health-count">{accountHealth[bar.key]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Sprint Overview */}
            {sprint && (
              <div>
                <p className="dm-label">Sprint Overview</p>
                <div className="dm-card">
                  <div className="dm-sprint-numbers">
                    <div className="dm-sprint-num">
                      <span className="dm-sprint-val">{daysLeft()}</span>
                      <span className="dm-sprint-pill" style={{ background: "#FFDE00", color: "#1A1A1A" }}>Days Left</span>
                    </div>
                    <div className="dm-sprint-num">
                      <span className="dm-sprint-val" style={{ color: "#16A34A" }}>{sprintRepStats.withActivity}</span>
                      <span className="dm-sprint-pill" style={{ background: "#F0FDF4", color: "#16A34A" }}>With Activity</span>
                    </div>
                    <div className="dm-sprint-num">
                      <span className="dm-sprint-val" style={{ color: "#DC2626" }}>{sprintRepStats.withoutActivity}</span>
                      <span className="dm-sprint-pill" style={{ background: "#FEF2F2", color: "#DC2626" }}>No Activity</span>
                    </div>
                  </div>
                  <div className="dm-progress-track">
                    <div className="dm-progress-fill" style={{ width: `${sprintProgress()}%` }} />
                  </div>
                  <p className="dm-progress-label">{sprintProgress()}% of sprint elapsed</p>
                </div>
              </div>
            )}

            {/* 5. At Risk Accounts */}
            {atRiskAccountsList.length > 0 && (
              <div>
                <div className="dm-risk-card">
                  <div className="dm-risk-header">
                    <span className="dm-risk-label">At Risk Accounts</span>
                  </div>
                  {atRiskAccountsList.slice(0, 3).map(acc => (
                    <div key={acc.id} className="dm-risk-row">
                      <div>
                        <p className="dm-risk-name">{acc.name}</p>
                        <p className="dm-risk-rep">{acc.repName}</p>
                      </div>
                      <span className="dm-days-pill">
                        {acc.daysSince !== null ? `${acc.daysSince}d ago` : "Never"}
                      </span>
                    </div>
                  ))}
                  {atRiskAccountsList.length > 0 && (
                    <button className="dm-viewall" onClick={() => navigate("/dashboard/accounts")}>
                      View all {atRiskAccountsList.length} →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 6. At Risk Reps */}
            <div>
              <div className="dm-risk-card">
                <div className="dm-risk-header">
                  <span className="dm-risk-label">At Risk Reps</span>
                  {atRiskRepsList.length > 3 && (
                    <button className="dm-viewall" style={{ paddingTop: 0 }} onClick={() => navigate("/dashboard/reps")}>
                      View all {atRiskRepsList.length} →
                    </button>
                  )}
                </div>
                {atRiskRepsList.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#16A34A", fontWeight: 600 }}>✓ All reps on track</p>
                ) : (
                  <>
                    {atRiskRepsList.slice(0, 3).map(rep => (
                      <div key={rep.id} className="dm-risk-row">
                        <div>
                          <p className="dm-risk-name">{rep.full_name}</p>
                          <p className="dm-risk-rep">{rep.accountCount} account{rep.accountCount !== 1 ? "s" : ""}</p>
                        </div>
                        <span className="dm-days-pill">{rep.sinceLabel}</span>
                      </div>
                    ))}
                    {atRiskRepsList.length <= 3 && (
                      <button className="dm-viewall" onClick={() => navigate("/dashboard/reps")}>
                        View all {atRiskRepsList.length} →
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 7. Recent Activity */}
            {recentActivities.length > 0 && (
              <div style={{ marginBottom: "80px" }}>
                <div className="dm-card">
                  <div className="dm-card-header">
                    <span className="dm-card-title">Recent Activity</span>
                    <button className="dm-viewall-link" onClick={() => navigate("/dashboard/activities")}>View all</button>
                  </div>
                  {recentActivities.map(act => {
                    const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                    const sub = [act.repName, act.outcome || act.notes].filter(Boolean).join(" · ");
                    return (
                      <div key={act.id} className="dm-act-row">
                        <span className="dm-act-badge" style={{ background: tc.bg, color: tc.color }}>
                          {act.activity_type}
                        </span>
                        <div className="dm-act-middle">
                          <p className="dm-act-account">{act.accountName}</p>
                          <p className="dm-act-sub">{sub}</p>
                        </div>
                        <span className="dm-act-date">{formatDate(act.activity_date)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
    backgroundColor: "#F5F5F3", fontFamily: "'DM Sans', sans-serif",
  },
  loadingPage: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3",
  },
  spinner: {
    width: "32px", height: "32px", borderRadius: "50%",
    border: "3px solid #E0E0DC", borderTopColor: "#367C2B",
    animation: "spin 0.8s linear infinite",
  },
  main: {
    marginLeft: "220px", flex: 1, padding: "28px 32px",
    display: "flex", flexDirection: "column", gap: "20px", minHeight: "100vh",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
  },
  sprintBadge: {
    backgroundColor: "#FFDE00", color: "#1A1A1A",
    fontSize: "12px", fontWeight: 700, padding: "5px 12px", borderRadius: "100px",
  },
  exportTopBtn: {
    padding: "8px 16px", background: "#367C2B", color: "#fff",
    border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
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
  statGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" },
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
    gap: "12px", alignItems: "center", padding: "13px 20px",
    borderBottom: "1px solid #F0F0ED",
  },
  tableHeader: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  repName: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  repStat: { fontSize: "14px", color: "#374151" },
  statusBadge: {
    fontSize: "11px", fontWeight: 600, padding: "4px 10px",
    borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center",
  },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 16px" },
};
