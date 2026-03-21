import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import MobileHeader from "../components/MobileHeader";
import RepBottomNav from "../components/RepBottomNav";
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

  useEffect(() => { loadData(); }, []);

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
      .from("sprints").select("*")
      .lte("start_date", today).gte("end_date", today).limit(1).single();
    setSprint(sprintData);

    // Accounts with activities
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, name, company, status, created_at, activities(id, activity_date, activity_type, notes, outcome, scheduled_next_date, scheduled_next_type, scheduled_next_time)")
      .eq("rep_id", user.id);

    const ACTIVE = ["New", "Contacted", "Engaged", "Proposal"];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const active = (accountsData || []).filter(a => ACTIVE.includes(a.status)).length;
    const won = (accountsData || []).filter(a => a.status === "Won").length;
    const proposal = (accountsData || []).filter(a => a.status === "Proposal").length;

    const isAtRisk = (a) => {
      if (!ACTIVE.includes(a.status)) return false;
      if (new Date(a.created_at) >= sevenDaysAgo) return false;
      const acts = a.activities || [];
      if (!acts.length) return true;
      const latest = new Date(Math.max(...acts.map(x => new Date(x.activity_date))));
      return latest < sevenDaysAgo;
    };

    const needsAttention = (accountsData || []).filter(isAtRisk).length;
    setStats({ active, needsAttention, won, proposal });

    // Needs attention list
    const attentionList = (accountsData || [])
      .filter(isAtRisk)
      .map(a => {
        const acts = a.activities || [];
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

    // Upcoming scheduled activities
    const upcoming = [];
    (accountsData || []).forEach(acc => {
      (acc.activities || []).forEach(act => {
        if (act.scheduled_next_date) {
          upcoming.push({
            accountName: acc.name || acc.company,
            accountId: acc.id,
            type: act.scheduled_next_type || "Activity",
            date: act.scheduled_next_date,
            time: act.scheduled_next_time,
          });
        }
      });
    });
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    setUpcomingActivities(upcoming.slice(0, 5));

    // Recent activities (last 48 hours)
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    const fortyEightHoursAgoStr = fortyEightHoursAgo.toISOString().split("T")[0];

    const allActs = [];
    (accountsData || []).forEach(acc => {
      (acc.activities || []).forEach(act => {
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

  const isToday = (dateStr) => new Date().toISOString().split("T")[0] === dateStr;

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

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

        .rh-upcoming-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 0; border-bottom: 1px solid #F0F0ED; gap: 8px;
        }
        .rh-upcoming-row:last-child { border-bottom: none; }
        .rh-upcoming-name {
          font-size: 13px; font-weight: 600; color: #1A1A1A;
          flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          cursor: pointer;
        }
        .rh-upcoming-name:active { opacity: 0.7; }
        .rh-date-pill {
          font-size: 10px; font-weight: 700; padding: 3px 8px;
          border-radius: 100px; white-space: nowrap; flex-shrink: 0;
        }

        .rh-risk-card {
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 8px; padding: 14px 16px;
          width: 100%; box-sizing: border-box;
        }
        .rh-risk-header {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
        }
        .rh-risk-label {
          font-size: 11px; font-weight: 700; color: #DC2626;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .rh-risk-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 0; border-bottom: 1px solid #FECACA; gap: 8px;
        }
        .rh-risk-row:last-of-type { border-bottom: none; }
        .rh-risk-name {
          font-size: 13px; font-weight: 600; color: #1A1A1A;
        }
        .rh-risk-sub {
          font-size: 11px; color: #767676; margin-top: 1px;
        }
        .rh-days-pill {
          font-size: 10px; font-weight: 700; padding: 3px 8px;
          border-radius: 100px; background: #FECACA; color: #DC2626;
          white-space: nowrap; flex-shrink: 0;
        }
        .rh-risk-viewall {
          font-size: 12px; font-weight: 600; color: #DC2626;
          background: none; border: none; padding: 8px 0 0;
          cursor: pointer; font-family: 'DM Sans', sans-serif; display: block;
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
      `}</style>

      <MobileHeader activePath="/home" profile={profile} />
      <RepBottomNav activePath="/home" />

      <PullToRefresh onRefresh={loadData}>
        <div className="rh-page">

          {/* Greeting */}
          <div>
            <p className="rh-greeting">{getGreeting()}, {getFirstName()}</p>
            <p className="rh-date">{todayLabel()}</p>
            {daysLeft() !== null && (
              <p className="rh-sprint">{daysLeft()} sprint day{daysLeft() !== 1 ? "s" : ""} left</p>
            )}
          </div>

          {/* Stat cards 2x2 */}
          <div className="rh-stat-grid">
            {[
              { label: "Active Accounts", value: stats.active, color: "#367C2B" },
              { label: "Needs Attention", value: stats.needsAttention, color: "#DC2626" },
              { label: "Won This Sprint", value: stats.won, color: "#367C2B" },
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
          {upcomingActivities.length > 0 && (
            <div className="rh-card">
              <div className="rh-card-header">
                <span className="rh-card-title">Upcoming</span>
                <button className="rh-viewall" onClick={() => navigate("/accounts")}>View all</button>
              </div>
              {upcomingActivities.map((act, i) => (
                <div key={i} className="rh-upcoming-row">
                  <span
                    className="rh-upcoming-name"
                    onClick={() => navigate(`/accounts/${act.accountId}`)}
                  >
                    {act.accountName}
                  </span>
                  <span className="rh-date-pill" style={{
                    background: isToday(act.date) ? "#F0FDF4" : "#EFF6FF",
                    color: isToday(act.date) ? "#16A34A" : "#2563EB",
                  }}>
                    {isToday(act.date) ? "Today" : formatDate(act.date)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Needs Attention */}
          <div className="rh-risk-card">
            <div className="rh-risk-header">
              <span className="rh-risk-label">Needs Attention</span>
              {needsAttentionList.length > 3 && (
                <button className="rh-risk-viewall" style={{ paddingTop: 0 }} onClick={() => navigate("/accounts")}>
                  View all {needsAttentionList.length} →
                </button>
              )}
            </div>
            {needsAttentionList.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#16A34A", fontWeight: 600 }}>All accounts on track</p>
            ) : (
              <>
                {needsAttentionList.slice(0, 3).map(acc => (
                  <div key={acc.id} className="rh-risk-row" onClick={() => navigate(`/accounts/${acc.id}`)} style={{ cursor: "pointer" }}>
                    <div>
                      <p className="rh-risk-name">{acc.name}</p>
                      <p className="rh-risk-sub">{acc.status}</p>
                    </div>
                    <span className="rh-days-pill">
                      {acc.daysSince !== null ? `${acc.daysSince}d ago` : "Never"}
                    </span>
                  </div>
                ))}
                {needsAttentionList.length <= 3 && (
                  <button className="rh-risk-viewall" onClick={() => navigate("/accounts")}>
                    View all {needsAttentionList.length} →
                  </button>
                )}
              </>
            )}
          </div>

          {/* Recent Activity */}
          {recentActivities.length > 0 && (
            <div className="rh-card" style={{ marginBottom: "80px" }}>
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
      </PullToRefresh>
    </>
  );
}

const styles = {
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
};
