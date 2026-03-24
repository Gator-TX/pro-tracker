import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import MobileHeader from "../components/MobileHeader";
import RepBottomNav from "../components/RepBottomNav";
import Sidebar from "../components/Sidebar";
import PullToRefresh from "../components/PullToRefresh";

export default function RepHome() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, needsAttention: 0, won: 0, proposal: 0 });
  const [upcomingActivities, setUpcomingActivities] = useState([]);
  const [needsAttentionList, setNeedsAttentionList] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [sprint, setSprint] = useState(null);
  const [pipelineCounts, setPipelineCounts] = useState({ New: 0, Contacted: 0, Engaged: 0, Proposal: 0, Won: 0 });
  const [noActivityCount, setNoActivityCount] = useState(0);

  useEffect(() => { loadData(); }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role === "manager") { navigate("/dashboard"); return; }

    // Sprint
    const today = new Date().toISOString().split("T")[0];
    const { data: sprintData } = await supabase
      .from("target_sprints").select("*")
      .lte("start_date", today).gte("end_date", today).limit(1).single();
    setSprint(sprintData);

    // Load configurable thresholds
    const { data: settingsData } = await supabase
      .from("target_app_settings").select("setting_key, setting_value");
    const settingsMap = {};
    (settingsData || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
    const accountAtRiskDays = parseInt(settingsMap["account_at_risk_days"] || "7", 10);

    // Accounts with activities
    const { data: accountsData } = await supabase
      .from("target_accounts")
      .select("id, name, company, status, created_at, target_activities(id, activity_date, activity_type, notes, outcome, scheduled_next_date, scheduled_next_type, scheduled_next_time)")
      .eq("rep_id", user.id);

    const ACTIVE = ["New", "Contacted", "Engaged", "Proposal"];
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - accountAtRiskDays);

    const active = (accountsData || []).filter(a => ACTIVE.includes(a.status)).length;
    const won = (accountsData || []).filter(a => a.status === "Won").length;
    const proposal = (accountsData || []).filter(a => a.status === "Proposal").length;

    const isAtRisk = (a) => {
      if (!ACTIVE.includes(a.status)) return false;
      if (new Date(a.created_at) >= thresholdDate) return false;
      const acts = a.target_activities || [];
      if (!acts.length) return true;
      const latest = new Date(Math.max(...acts.map(x => new Date(x.activity_date))));
      return latest < thresholdDate;
    };

    const needsAttention = (accountsData || []).filter(isAtRisk).length;
    setStats({ active, needsAttention, won, proposal });

    // Needs attention list
    const attentionList = (accountsData || [])
      .filter(isAtRisk)
      .map(a => {
        const acts = a.target_activities || [];
        const lastDate = acts.length
          ? new Date(Math.max(...acts.map(x => new Date(x.activity_date))))
          : null;
        const daysSince = lastDate
          ? Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24))
          : null;
        return { id: a.id, name: a.name || a.company, status: a.status, daysSince };
      })
      .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));
    setNeedsAttentionList(attentionList);

    // Pipeline counts
    const counts = { New: 0, Contacted: 0, Engaged: 0, Proposal: 0, Won: 0 };
    (accountsData || []).forEach(a => {
      if (Object.prototype.hasOwnProperty.call(counts, a.status)) counts[a.status]++;
    });
    setPipelineCounts(counts);

    // No activity during sprint
    const noActivity = sprintData ? (accountsData || []).filter(a =>
      ACTIVE.includes(a.status) &&
      !(a.target_activities || []).some(act => act.activity_date >= sprintData.start_date)
    ).length : 0;
    setNoActivityCount(noActivity);

    // Upcoming scheduled activities
    const accountNameMap = {};
    (accountsData || []).forEach(a => { accountNameMap[a.id] = a.name || a.company; });

    const { data: upcomingData } = await supabase
      .from("target_activities")
      .select("id, account_id, scheduled_next_date, scheduled_next_type, scheduled_next_time")
      .eq("rep_id", user.id)
      .not("scheduled_next_date", "is", null)
      .gte("scheduled_next_date", today)
      .order("scheduled_next_date", { ascending: true })
      .limit(10);

    setUpcomingActivities((upcomingData || []).map(act => ({
      accountId: act.account_id,
      accountName: accountNameMap[act.account_id] || "—",
      date: act.scheduled_next_date,
      type: act.scheduled_next_type || "Activity",
      time: act.scheduled_next_time,
    })));

    // Recent activities (last 48 hours)
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    const fortyEightHoursAgoStr = fortyEightHoursAgo.toISOString().split("T")[0];

    const allActs = [];
    (accountsData || []).forEach(acc => {
      (acc.target_activities || []).forEach(act => {
        if (act.activity_date >= fortyEightHoursAgoStr) {
          allActs.push({ ...act, accountName: acc.name || acc.company, accountId: acc.id });
        }
      });
    });
    allActs.sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));
    setRecentActivities(allActs);

    setLoading(false);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getFirstName = () => profile?.full_name?.split(" ")[0] || "";

  const todayLabel = () => new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const daysLeft = () => {
    if (!sprint) return null;
    const diff = Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const sprintPct = () => {
    if (!sprint) return 0;
    const total = new Date(sprint.end_date) - new Date(sprint.start_date);
    const elapsed = Math.min(new Date() - new Date(sprint.start_date), total);
    return Math.max(0, Math.round((elapsed / total) * 100));
  };

  const isToday = (dateStr) => new Date().toISOString().split("T")[0] === dateStr;

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

  const PIPELINE_STATUSES = [
    { status: "New",       color: "#6B7280" },
    { status: "Contacted", color: "#2563EB" },
    { status: "Engaged",   color: "#7C3AED" },
    { status: "Proposal",  color: "#D97706" },
    { status: "Won",       color: "#16A34A" },
  ];

  const maxPipelineCount = Math.max(...Object.values(pipelineCounts), 1);

  if (loading) {
    return <div style={styles.loadingPage}><div style={styles.spinner} /></div>;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── MOBILE STYLES ── */
        .rh-page {
          min-height: 100vh; background: #F5F5F3;
          padding: 12px 16px 8px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .rh-greeting { font-size: 20px; font-weight: 700; color: #1A1A1A; }
        .rh-date { font-size: 12px; color: #ABABAB; margin-top: 2px; }
        .rh-sprint { font-size: 12px; color: #767676; margin-top: 2px; }

        .rh-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .rh-stat-card {
          background: #fff; border: 1px solid #E8E8E6;
          border-radius: 8px; padding: 14px 16px;
          position: relative; overflow: hidden;
        }
        .rh-stat-value { font-size: 28px; font-weight: 700; color: #1A1A1A; line-height: 1; }
        .rh-stat-lbl { font-size: 11px; color: #767676; margin-top: 4px; }
        .rh-stat-accent { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }

        .rh-card {
          background: #fff; border: 1px solid #E8E8E6;
          border-radius: 8px; padding: 14px 16px;
          width: 100%; box-sizing: border-box;
        }
        .rh-card-header {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
        }
        .rh-card-title { font-size: 13px; font-weight: 600; color: #1A1A1A; }
        .rh-viewall {
          font-size: 12px; font-weight: 600; color: #367C2B;
          background: none; border: none; padding: 0;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }

        .rh-upcoming-card {
          background: #fff; border: 1px solid #E8E8E6;
          border-radius: 8px; overflow: hidden;
          width: 100%; box-sizing: border-box;
        }
        .rh-upcoming-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; border-bottom: 1px solid #F0F0ED;
        }
        .rh-upcoming-title { font-size: 12px; font-weight: 600; color: #1A1A1A; }
        .rh-upcoming-viewall {
          font-size: 12px; font-weight: 600; color: #367C2B;
          background: none; border: none; padding: 0; cursor: pointer;
          font-family: 'DM Sans', sans-serif; text-decoration: underline;
        }
        .rh-upcoming-row {
          display: flex; align-items: center;
          padding: 10px 16px; border-bottom: 1px solid #F0F0ED; gap: 12px;
          cursor: pointer;
        }
        .rh-upcoming-row:last-child { border-bottom: none; }
        .rh-upcoming-name {
          font-size: 13px; font-weight: 600; color: #1A1A1A;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rh-upcoming-sub { font-size: 11px; color: #767676; margin-top: 2px; }
        .rh-upcoming-empty { padding: 14px 16px; font-size: 13px; color: #ABABAB; }
        .rh-date-pill {
          font-size: 10px; font-weight: 700; padding: 3px 8px;
          border-radius: 100px; white-space: nowrap; flex-shrink: 0;
        }

        .rh-risk-card {
          background: #ffffff; border: 1px solid #E8E8E6;
          border-radius: 8px; padding: 14px 16px;
          width: 100%; box-sizing: border-box;
        }
        .rh-risk-header {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
        }
        .rh-risk-label { font-size: 13px; font-weight: 600; color: #1A1A1A; }
        .rh-risk-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 0; border-bottom: 1px solid #F0F0ED; gap: 8px;
        }
        .rh-risk-row:last-of-type { border-bottom: none; }
        .rh-risk-name { font-size: 13px; font-weight: 600; color: #1A1A1A; }
        .rh-risk-sub { font-size: 11px; color: #767676; margin-top: 1px; }
        .rh-days-pill {
          font-size: 11px; font-weight: 600; padding: 3px 8px;
          border-radius: 100px; background: #F5F5F3; color: #767676;
          border: 1px solid #E0E0DC; white-space: nowrap; flex-shrink: 0;
        }
        .rh-risk-viewall {
          font-size: 12px; font-weight: 600; color: #367C2B;
          background: none; border: none; padding: 8px 0 0;
          cursor: pointer; font-family: 'DM Sans', sans-serif; display: block;
          text-decoration: underline;
        }

        .rh-act-row {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 0; border-bottom: 1px solid #F0F0ED;
        }
        .rh-act-row:last-child { border-bottom: none; }
        .rh-act-badge {
          flex-shrink: 0; font-size: 10px; font-weight: 600;
          padding: 3px 8px; border-radius: 100px; white-space: nowrap; margin-top: 2px;
        }
        .rh-act-middle { flex: 1; min-width: 0; }
        .rh-act-account { font-size: 13px; font-weight: 600; color: #1A1A1A; margin-bottom: 2px; }
        .rh-act-sub {
          font-size: 11px; color: #767676;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rh-act-date { font-size: 11px; color: #ABABAB; white-space: nowrap; flex-shrink: 0; }

        /* ── DESKTOP LAYOUT ── */
        .rh-desktop { display: none; }

        @media (min-width: 769px) {
          .rh-main-content { margin-left: 220px; padding: 24px; background: #F5F5F3; min-height: 100vh; }
          .rh-page { display: none !important; }
          .rh-desktop { display: flex !important; flex-direction: column; gap: 24px; }

          .dt-upcoming-row { cursor: pointer; }
          .dt-upcoming-row:hover { background: #F9F9F7; border-radius: 4px; }
          .dt-upcoming-row:last-of-type { border-bottom: none !important; }

          .dt-risk-row { cursor: pointer; }
          .dt-risk-row:hover { background: #F9F9F7; border-radius: 4px; }
          .dt-risk-row:last-of-type { border-bottom: none !important; }

          .dt-act-tr:hover { background: #F9F9F7; cursor: pointer; }

          .dt-pipeline-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
          .dt-pipeline-row:last-child { margin-bottom: 0; }
        }
      `}</style>

      <MobileHeader activePath="/home" profile={profile} />
      <Sidebar role="rep" profile={profile} onSignOut={handleSignOut} activePath="/home" />
      <RepBottomNav activePath="/home" />

      <div className="rh-main-content">
        <PullToRefresh onRefresh={loadData}>

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          <div className="rh-page">

            {/* Greeting */}
            <div>
              <p className="rh-greeting">{getGreeting()}, {getFirstName()}</p>
              <p className="rh-date">{todayLabel()}</p>
            </div>

            {/* Stat cards 2x2 */}
            <div className="rh-stat-grid">
              {[
                { label: "Active Accounts", value: stats.active, color: "#367C2B" },
                { label: "At Risk", value: stats.needsAttention, color: "#DC2626" },
                { label: "Won This Target", value: stats.won, color: "#367C2B" },
                { label: "In Proposal", value: stats.proposal, color: "#7C3AED" },
              ].map(card => (
                <div key={card.label} className="rh-stat-card">
                  <p className="rh-stat-value">{card.value}</p>
                  <p className="rh-stat-lbl">{card.label}</p>
                  <div className="rh-stat-accent" style={{ background: card.color }} />
                </div>
              ))}
            </div>

            {/* Upcoming Activities */}
            <div className="rh-upcoming-card">
              <div className="rh-upcoming-header">
                <span className="rh-upcoming-title">Upcoming</span>
                <button className="rh-upcoming-viewall" onClick={() => navigate("/activities")}>View all</button>
              </div>
              {upcomingActivities.length === 0 ? (
                <p className="rh-upcoming-empty">No upcoming activities scheduled</p>
              ) : (
                upcomingActivities.slice(0, 5).map((act, i) => (
                  <div key={i} className="rh-upcoming-row" onClick={() => navigate(`/accounts/${act.accountId}`)}>
                    <span className="rh-date-pill" style={{
                      background: isToday(act.date) ? "#F0FDF4" : "#EFF6FF",
                      color: isToday(act.date) ? "#16A34A" : "#2563EB",
                    }}>
                      {isToday(act.date) ? "Today" : formatDate(act.date)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="rh-upcoming-name">{act.accountName}</p>
                      <p className="rh-upcoming-sub">{[act.type, act.time].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* At Risk Accounts */}
            <div className="rh-risk-card">
              <div className="rh-risk-header">
                <span className="rh-risk-label">At Risk Accounts</span>
              </div>
              {needsAttentionList.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#16A34A", fontWeight: 600 }}>✓ All accounts on track</p>
              ) : (
                needsAttentionList.slice(0, 3).map(acc => (
                  <div key={acc.id} className="rh-risk-row" onClick={() => navigate(`/accounts/${acc.id}`)} style={{ cursor: "pointer" }}>
                    <div>
                      <p className="rh-risk-name">{acc.name}</p>
                      <p className="rh-risk-sub">{acc.status}</p>
                    </div>
                    <span className="rh-days-pill">
                      {acc.daysSince !== null ? `${acc.daysSince}d ago` : "Never"}
                    </span>
                  </div>
                ))
              )}
              <button className="rh-risk-viewall" onClick={() => navigate("/accounts")}>
                View all accounts →
              </button>
            </div>

            {/* Recent Activity */}
            {recentActivities.length > 0 && (
              <div className="rh-card" style={{ marginBottom: "95px" }}>
                <div className="rh-card-header">
                  <span className="rh-card-title">Activity (Last 48h)</span>
                  <button className="rh-viewall" onClick={() => navigate("/activities")}>View all</button>
                </div>
                {recentActivities.map(act => {
                  const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                  const sub = [act.outcome, act.notes].filter(Boolean).join(" · ") || "—";
                  return (
                    <div key={act.id} className="rh-act-row">
                      <span className="rh-act-badge" style={{ background: tc.bg, color: tc.color }}>
                        {act.activity_type}
                      </span>
                      <div className="rh-act-middle">
                        <p className="rh-act-account">{act.accountName}</p>
                        <p className="rh-act-sub">{sub}</p>
                      </div>
                      <span className="rh-act-date">{formatDate(act.activity_date)}</span>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          <div className="rh-desktop">

            {/* 1. Top bar */}
            <div style={dt.topHeader}>
              <div>
                <h1 style={dt.greeting}>{getGreeting()}, {getFirstName()}</h1>
                <p style={dt.subGreeting}>{todayLabel()}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A1A1A", fontFamily: "'DM Sans', sans-serif" }}>
                  {profile?.full_name}
                </span>
                <button onClick={handleSignOut} style={{ fontSize: "12px", color: "#767676", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  Sign out
                </button>
              </div>
            </div>

            {/* 2. Stat cards 4 across */}
            <div style={dt.statGrid}>
              {[
                { label: "Active Accounts", value: stats.active,        accent: "#367C2B" },
                { label: "At Risk Accounts", value: stats.needsAttention, accent: "#DC2626" },
                { label: "Won This Target",  value: stats.won,           accent: "#367C2B" },
                { label: "In Proposal",      value: stats.proposal,      accent: "#7C3AED" },
              ].map(c => (
                <div key={c.label} style={dt.statCard}>
                  <p style={dt.statVal}>{c.value}</p>
                  <p style={dt.statLbl}>{c.label}</p>
                  <div style={{ ...dt.statAccent, background: c.accent }} />
                </div>
              ))}
            </div>

            {/* 3. Main 2-column grid */}
            <div style={dt.mainGrid}>

              {/* LEFT COLUMN */}
              <div style={dt.leftCol}>

                {/* Upcoming Activities card */}
                <div style={dt.card}>
                  <div style={dt.cardHeader}>
                    <span style={dt.cardTitle}>Upcoming Activities</span>
                    <button style={dt.viewAll} onClick={() => navigate("/activities")}>View all</button>
                  </div>
                  {upcomingActivities.length === 0 ? (
                    <p style={dt.emptyText}>No upcoming activities scheduled</p>
                  ) : (
                    upcomingActivities.map((act, i) => (
                      <div
                        key={i}
                        className="dt-upcoming-row"
                        style={dt.upcomingRow}
                        onClick={() => navigate(`/accounts/${act.accountId}`)}
                      >
                        <span style={{
                          ...dt.datePill,
                          background: isToday(act.date) ? "#F0FDF4" : "#EFF6FF",
                          color: isToday(act.date) ? "#16A34A" : "#2563EB",
                        }}>
                          {isToday(act.date) ? "Today" : formatDate(act.date)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={dt.upcomingName}>{act.accountName}</p>
                          <p style={dt.upcomingSub}>{[act.type, act.time].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Activity (Last 48h) card */}
                <div style={dt.card}>
                  <div style={dt.cardHeader}>
                    <span style={dt.cardTitle}>Activity (Last 48h)</span>
                    <button style={dt.viewAll} onClick={() => navigate("/activities")}>View all</button>
                  </div>
                  {recentActivities.length === 0 ? (
                    <p style={dt.emptyText}>No activity logged in last 48 hours</p>
                  ) : (
                    <div style={dt.actScroll}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Date", "Account", "Type", "Notes"].map(h => (
                              <th key={h} style={dt.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentActivities.slice(0, 10).map(act => {
                            const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                            return (
                              <tr
                                key={act.id}
                                className="dt-act-tr"
                                onClick={() => navigate(`/accounts/${act.accountId}`)}
                              >
                                <td style={dt.td}>{formatDate(act.activity_date)}</td>
                                <td style={{ ...dt.td, fontWeight: 600 }}>{act.accountName}</td>
                                <td style={dt.td}>
                                  <span style={{ background: tc.bg, color: tc.color, padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>
                                    {act.activity_type}
                                  </span>
                                </td>
                                <td style={{ ...dt.td, color: "#767676", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {act.notes || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN */}
              <div style={dt.rightCol}>

                {/* My Pipeline card */}
                <div style={dt.card}>
                  <p style={dt.sectionLabel}>MY PIPELINE</p>
                  {PIPELINE_STATUSES.map(({ status, color }) => {
                    const count = pipelineCounts[status] || 0;
                    const pct = Math.round((count / maxPipelineCount) * 100);
                    return (
                      <div key={status} className="dt-pipeline-row">
                        <span style={dt.pipelineLbl}>{status}</span>
                        <div style={dt.pipelineTrack}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }} />
                        </div>
                        <span style={{ ...dt.pipelineCount, color }}>{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* At Risk Accounts card */}
                <div style={dt.card}>
                  <div style={dt.cardHeader}>
                    <span style={dt.cardTitle}>At Risk Accounts</span>
                    <button style={dt.viewAll} onClick={() => navigate("/accounts")}>View all →</button>
                  </div>
                  {needsAttentionList.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#16A34A", fontWeight: 600 }}>✓ All accounts on track</p>
                  ) : (
                    <div style={{ maxHeight: "200px", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#E0E0DC transparent" }}>
                      {needsAttentionList.map(acc => (
                        <div
                          key={acc.id}
                          className="dt-risk-row"
                          style={dt.riskRow}
                          onClick={() => navigate(`/accounts/${acc.id}`)}
                        >
                          <div>
                            <p style={dt.riskName}>{acc.name}</p>
                            <p style={dt.riskSub}>{acc.status}</p>
                          </div>
                          <span style={dt.daysPill}>
                            {acc.daysSince !== null ? `${acc.daysSince}d ago` : "Never"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sprint Progress card */}
                <div style={dt.card}>
                  <p style={dt.sectionLabel}>TARGET PROGRESS</p>
                  <div style={dt.sprintStats}>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ ...dt.sprintPill, background: "#FEF9C3", color: "#92400E" }}>
                        {daysLeft() ?? "—"}
                      </span>
                      <p style={dt.sprintStatLbl}>Days Left</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ ...dt.sprintPill, background: "#F0FDF4", color: "#16A34A" }}>
                        {stats.active}
                      </span>
                      <p style={dt.sprintStatLbl}>Active</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ ...dt.sprintPill, background: "#FEF2F2", color: "#DC2626" }}>
                        {noActivityCount}
                      </span>
                      <p style={dt.sprintStatLbl}>No Activity</p>
                    </div>
                  </div>
                  <div style={dt.progressTrack}>
                    <div style={{ ...dt.progressFill, width: `${sprintPct()}%` }} />
                  </div>
                  <p style={dt.progressLabel}>{sprintPct()}% of target elapsed</p>
                </div>

              </div>
            </div>

          </div>

        </PullToRefresh>
      </div>
    </>
  );
}

const styles = {
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
};

const dt = {
  topHeader:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  greeting:    { fontSize: "24px", fontWeight: 700, color: "#1A1A1A", margin: 0 },
  subGreeting: { fontSize: "13px", color: "#767676", marginTop: "4px" },
  sprintBadge: { background: "#FFDE00", color: "#1A1A1A", fontSize: "12px", fontWeight: 700, padding: "6px 14px", borderRadius: "100px", whiteSpace: "nowrap" },

  statGrid:   { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" },
  statCard:   { background: "#fff", border: "1px solid #E8E8E6", borderRadius: "8px", padding: "18px 20px", position: "relative", overflow: "hidden" },
  statVal:    { fontSize: "32px", fontWeight: 700, color: "#1A1A1A", lineHeight: 1 },
  statLbl:    { fontSize: "12px", color: "#767676", marginTop: "6px" },
  statAccent: { position: "absolute", bottom: 0, left: 0, right: 0, height: "3px" },

  mainGrid: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px", alignItems: "start" },
  leftCol:  { display: "flex", flexDirection: "column", gap: "20px" },
  rightCol: { display: "flex", flexDirection: "column", gap: "20px" },

  card:       { background: "#fff", border: "1px solid #E8E8E6", borderRadius: "8px", padding: "16px 20px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" },
  cardTitle:  { fontSize: "13px", fontWeight: 600, color: "#1A1A1A" },
  viewAll:    { fontSize: "12px", fontWeight: 600, color: "#367C2B", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  emptyText:  { fontSize: "13px", color: "#ABABAB" },

  sectionLabel: { fontSize: "11px", fontWeight: 700, color: "#ABABAB", letterSpacing: "0.06em", marginBottom: "14px" },

  upcomingRow:  { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid #F0F0ED" },
  upcomingName: { fontSize: "13px", fontWeight: 600, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  upcomingSub:  { fontSize: "11px", color: "#767676", marginTop: "2px" },
  datePill:     { fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px", whiteSpace: "nowrap", flexShrink: 0 },

  actScroll: { maxHeight: "280px", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#E0E0DC transparent" },
  th: { textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#767676", padding: "6px 8px", borderBottom: "1px solid #E8E8E6", whiteSpace: "nowrap" },
  td: { fontSize: "13px", color: "#1A1A1A", padding: "10px 8px", borderBottom: "1px solid #F0F0ED" },

  pipelineLbl:   { fontSize: "13px", color: "#374151", width: "72px", flexShrink: 0 },
  pipelineTrack: { flex: 1, height: "8px", background: "#F0F0ED", borderRadius: "4px", overflow: "hidden" },
  pipelineCount: { fontSize: "13px", fontWeight: 700, width: "24px", textAlign: "right", flexShrink: 0 },

  riskRow:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F0F0ED", gap: "8px" },
  riskName: { fontSize: "13px", fontWeight: 600, color: "#1A1A1A" },
  riskSub:  { fontSize: "11px", color: "#767676", marginTop: "1px" },
  daysPill: { fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "100px", background: "#F5F5F3", color: "#767676", border: "1px solid #E0E0DC", whiteSpace: "nowrap", flexShrink: 0 },

  sprintStats:   { display: "flex", gap: "16px", marginBottom: "16px" },
  sprintPill:    { display: "inline-block", fontSize: "20px", fontWeight: 700, padding: "8px 16px", borderRadius: "8px" },
  sprintStatLbl: { fontSize: "11px", color: "#767676", marginTop: "4px" },

  progressTrack: { height: "8px", background: "#F0F0ED", borderRadius: "4px", overflow: "hidden", marginBottom: "6px" },
  progressFill:  { height: "100%", background: "#367C2B", borderRadius: "4px", transition: "width 0.3s" },
  progressLabel: { fontSize: "11px", color: "#767676" },
};
