import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";
import RepTopBar from "../components/RepTopBar";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Accounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [upcomingActivities, setUpcomingActivities] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, closed: 0, needsAttention: 0 });
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [filter, setFilter] = useState("Active");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const ACTIVE_STATUSES = ["New", "Contacted", "Engaged", "Proposal"];
  const STATUS_FILTERS = ["Active", "New", "Contacted", "Engaged", "Proposal", "Closed", "All"];

  const STATUS_COLORS = {
    New:        { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    Contacted:  { bg: "#FEFCE8", color: "#CA8A04", border: "#FDE68A" },
    Engaged:    { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
    Proposal:   { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
    Won:        { bg: "#367C2B", color: "#FFFFFF", border: "#367C2B" },
    Lost:       { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  };

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);

    const { data: accountsData, error: accountsError } = await supabase
      .from("accounts")
      .select("*, start_date, end_date, activities(id, activity_date, activity_type, notes, outcome, scheduled_next_date, scheduled_next_type, scheduled_next_time)")
      .eq("rep_id", user.id)
      .order("created_at", { ascending: false });
    console.log("user.id:", user.id);
    console.log("accountsData:", accountsData);
    console.log("accounts error:", JSON.stringify(accountsError));

    // Sort by most recently active
    const sorted = (accountsData || []).sort((a, b) => {
      const aDate = a.activities?.length
        ? Math.max(...a.activities.map(x => new Date(x.activity_date)))
        : new Date(a.created_at);
      const bDate = b.activities?.length
        ? Math.max(...b.activities.map(x => new Date(x.activity_date)))
        : new Date(b.created_at);
      return bDate - aDate;
    });
    setAccounts(sorted);

    // Stats for mobile dashboard
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const total = (accountsData || []).length;
    const active = (accountsData || []).filter(a => ACTIVE_STATUSES.includes(a.status)).length;
    const closed = (accountsData || []).filter(a => ["Won", "Lost"].includes(a.status)).length;
    const needsAttention = (accountsData || []).filter(a => {
      if (!ACTIVE_STATUSES.includes(a.status)) return false;
      const acts = a.activities || [];
      if (acts.length === 0) return true;
      const latest = new Date(Math.max(...acts.map(x => new Date(x.activity_date))));
      return latest < sevenDaysAgo;
    }).length;
    setStats({ total, active, closed, needsAttention });

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
            notes: act.notes,
          });
        }
      });
    });
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    setUpcomingActivities(upcoming.slice(0, 10));

    // Recent logged activities (flattened, sorted by date)
    const allActs = [];
    (accountsData || []).forEach(acc => {
      (acc.activities || []).forEach(act => {
        allActs.push({
          ...act,
          accountName: acc.name || acc.company,
          accountId: acc.id,
        });
      });
    });
    allActs.sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));
    setRecentActivities(allActs.slice(0, 10));

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getLastContact = (account) => {
    const acts = account.activities || [];
    if (!acts.length) return null;
    const dates = acts.map(a => new Date(a.activity_date));
    const latest = new Date(Math.max(...dates));
    return latest.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isToday = (dateStr) => new Date().toISOString().split("T")[0] === dateStr;

  const formatChipDate = (dateStr) => {
    if (isToday(dateStr)) return "Today";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getFirstName = () => profile?.full_name?.split(" ")[0] || "";

  const formatTodayDate = () => new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const filteredAccounts = filter === "All"
    ? accounts
    : filter === "Active"
    ? accounts.filter(a => ACTIVE_STATUSES.includes(a.status))
    : filter === "Closed"
    ? accounts.filter(a => ["Won", "Lost"].includes(a.status))
    : accounts.filter(a => a.status === filter);

  const visibleUpcoming = showAllUpcoming ? upcomingActivities : upcomingActivities.slice(0, 5);

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingDot} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ffffff; font-family: 'DM Sans', sans-serif; }

        .mobile-only { display: none; }
        .desktop-only { display: block; }
        @media (max-width: 768px) {
          .mobile-only { display: block; }
          .desktop-only { display: none; }
          .main-content { margin-left: 0 !important; padding-top: 70px !important; }
        }

        .filter-pill {
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          border: 1.5px solid #E0E0DC;
          background: #ffffff;
          color: #767676;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .filter-pill:hover { border-color: #367C2B; color: #367C2B; }
        .filter-pill.active {
          background: #367C2B;
          border-color: #367C2B;
          color: #ffffff;
        }

        .account-card {
          background: #ffffff;
          border: 1px solid #E8E8E6;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .account-card:hover {
          border-color: #367C2B;
          box-shadow: 0 2px 8px rgba(54,124,43,0.08);
        }

        .act-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 0;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer;
        }
        .act-row:last-child { border-bottom: none; }
        .act-row:active { background: #F9F9F8; }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.layout}>
        <MobileHeader activePath="/accounts" profile={profile} />
        <Sidebar role="rep" profile={profile} onSignOut={handleSignOut} activePath="/accounts" />
        <div className="main-content" style={styles.page}>
          <RepTopBar title="My Accounts" profile={profile} onSignOut={handleSignOut} />

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          <div className="mobile-only">

            {/* Greeting */}
            <div style={styles.greetingWrap}>
              <h1 style={styles.greetingText}>{getGreeting()}, {getFirstName()}</h1>
              <p style={styles.greetingDate}>{formatTodayDate()}</p>
            </div>

            {/* 2×2 Stat grid */}
            <div style={styles.statGrid}>
              {[
                { label: "Total Accounts", value: stats.total, color: "#2563EB", bg: "#EFF6FF" },
                { label: "Active Accounts", value: stats.active, color: "#16A34A", bg: "#F0FDF4" },
                { label: "Closed Accounts", value: stats.closed, color: "#367C2B", bg: "#DCFCE7" },
                { label: "Needs Attention", value: stats.needsAttention, color: "#DC2626", bg: "#FEF2F2" },
              ].map(card => (
                <div key={card.label} style={{ ...styles.statCard, backgroundColor: card.bg }}>
                  <p style={{ ...styles.statValue, color: card.color }}>{card.value}</p>
                  <p style={styles.statLabel}>{card.label}</p>
                </div>
              ))}
            </div>

            {/* Upcoming section */}
            {upcomingActivities.length > 0 && (
              <div style={styles.mobileSection}>
                <div style={styles.mobileSectionHeader}>
                  <p style={styles.mobileSectionLabel}>Upcoming</p>
                  {upcomingActivities.length > 5 && (
                    <button style={styles.viewAllBtn} onClick={() => setShowAllUpcoming(v => !v)}>
                      {showAllUpcoming ? "Show less" : "View all"}
                    </button>
                  )}
                </div>
                <div style={styles.mobileCard}>
                  {visibleUpcoming.map((item, i) => {
                    const tc = TYPE_COLORS[item.type] || TYPE_COLORS.Call;
                    const today = isToday(item.date);
                    return (
                      <div key={i} className="act-row" onClick={() => navigate(`/accounts/${item.accountId}`)}>
                        <span style={{ ...styles.typeBadge, background: tc.bg, color: tc.color }}>
                          {item.type}
                        </span>
                        <div style={styles.actMiddle}>
                          <p style={styles.actAccount}>{item.accountName}</p>
                          {item.notes && <p style={styles.actNotes}>{item.notes}</p>}
                        </div>
                        <div style={styles.actRight}>
                          {today
                            ? <span style={styles.todayBadge}>Today</span>
                            : <span style={styles.actDate}>{formatChipDate(item.date)}</span>
                          }
                          {item.time && <span style={styles.actTime}>{item.time}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Activity section */}
            {recentActivities.length > 0 && (
              <div style={styles.mobileSection}>
                <div style={styles.mobileSectionHeader}>
                  <p style={styles.mobileSectionLabel}>Recent Activity</p>
                </div>
                <div style={styles.mobileCard}>
                  {recentActivities.map((act, i) => {
                    const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                    return (
                      <div key={act.id || i} className="act-row" onClick={() => navigate(`/accounts/${act.accountId}`)}>
                        <span style={{ ...styles.typeBadge, background: tc.bg, color: tc.color }}>
                          {act.activity_type}
                        </span>
                        <div style={styles.actMiddle}>
                          <p style={styles.actAccount}>{act.accountName}</p>
                          {(act.outcome || act.notes) && (
                            <p style={styles.actNotes}>
                              {(act.outcome || act.notes || "").substring(0, 60)}
                              {(act.outcome || act.notes || "").length > 60 ? "…" : ""}
                            </p>
                          )}
                        </div>
                        <span style={styles.actDate}>
                          {new Date(act.activity_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentActivities.length === 0 && upcomingActivities.length === 0 && (
              <p style={styles.emptyText}>No activity yet — tap an account to get started</p>
            )}

            {/* My Accounts list */}
            <div style={styles.mobileSection}>
              <div style={styles.mobileSectionHeader}>
                <p style={styles.mobileSectionLabel}>My Accounts ({accounts.length})</p>
              </div>
              {accounts.length === 0 ? (
                <p style={styles.emptyText}>No accounts assigned yet</p>
              ) : (
                <div style={styles.mobileAccountList}>
                  {accounts.map(account => {
                    const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                    const daysLeft = account.end_date
                      ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                      : null;
                    return (
                      <div
                        key={account.id}
                        className="account-card"
                        onClick={() => navigate(`/accounts/${account.id}`)}
                      >
                        <div style={styles.cardTop}>
                          <p style={styles.cardCompany}>{account.name || account.company}</p>
                          <span style={{
                            ...styles.statusBadge,
                            background: sc.bg, color: sc.color,
                            border: `1px solid ${sc.border}`,
                          }}>
                            {account.status || "New"}
                          </span>
                        </div>
                        {daysLeft !== null && (
                          <p style={styles.daysLeftLabel}>
                            <span style={styles.daysLeftNum}>{daysLeft}</span> days left
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          <div className="desktop-only">

            {/* Upcoming strip */}
            {upcomingActivities.length > 0 && (
              <div style={styles.upcomingWrap}>
                <p style={styles.sectionLabel}>Upcoming</p>
                <div style={styles.upcomingStrip}>
                  {upcomingActivities.map((item, i) => {
                    const today = isToday(item.date);
                    return (
                      <div
                        key={i}
                        onClick={() => navigate(`/accounts/${item.accountId}`)}
                        style={{
                          ...styles.upcomingChip,
                          background: today ? "#F0FDF4" : "#EFF6FF",
                          border: `1px solid ${today ? "#BBF7D0" : "#BFDBFE"}`,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{
                          fontSize: "11px", fontWeight: 600,
                          color: today ? "#16A34A" : "#2563EB",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>
                          {item.type}
                        </span>
                        <span style={{ fontSize: "12px", color: "#1A1A1A", fontWeight: 500 }}>
                          {item.accountName}
                        </span>
                        <span style={{ fontSize: "11px", color: "#767676" }}>
                          {formatChipDate(item.date)}{item.time ? ` · ${item.time}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter pills */}
            <div style={styles.filterWrap}>
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  className={`filter-pill${filter === s ? " active" : ""}`}
                  onClick={() => setFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Account cards */}
            <div style={styles.cardList}>
              {filteredAccounts.length === 0 ? (
                <p style={styles.emptyText}>No accounts{filter !== "All" ? ` with status "${filter}"` : ""}</p>
              ) : (
                filteredAccounts.map(account => {
                  const statusStyle = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                  const lastContact = getLastContact(account);
                  const accountDaysLeft = account.end_date
                    ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null;
                  const accountProgress = (account.start_date && account.end_date)
                    ? Math.min(100, Math.max(0, Math.round(
                        ((new Date() - new Date(account.start_date)) /
                        (new Date(account.end_date) - new Date(account.start_date))) * 100
                      )))
                    : 0;

                  return (
                    <div
                      key={account.id}
                      className="account-card"
                      onClick={() => navigate(`/accounts/${account.id}`)}
                    >
                      <div style={styles.cardTop}>
                        <div>
                          <p style={styles.cardCompany}>{account.name || account.company}</p>
                          {lastContact
                            ? <p style={styles.cardLastContact}>Last contact · {lastContact}</p>
                            : <p style={styles.cardLastContact}>No activity yet</p>
                          }
                        </div>
                        <span style={{
                          ...styles.statusBadge,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                        }}>
                          {account.status || "New"}
                        </span>
                      </div>
                      {account.end_date && (
                        <>
                          <div style={styles.progressWrap}>
                            <div style={styles.progressTrack}>
                              <div style={{ ...styles.progressFill, width: `${accountProgress}%` }} />
                            </div>
                          </div>
                          <p style={styles.daysLeftLabel}>
                            <span style={styles.daysLeftNum}>{accountDaysLeft}</span> days left
                          </p>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#ffffff" },
  page: {
    marginLeft: "220px", flex: 1, minHeight: "100vh",
    display: "flex", flexDirection: "column",
    backgroundColor: "#ffffff", fontFamily: "'DM Sans', sans-serif",
    paddingBottom: "40px",
  },

  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  loadingDot: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },

  // ── Mobile ──
  greetingWrap: { padding: "20px 16px 12px" },
  greetingText: { fontSize: "20px", fontWeight: 600, color: "#1A1A1A", marginBottom: "4px" },
  greetingDate: { fontSize: "13px", color: "#ABABAB" },

  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "0 16px 4px" },
  statCard: { borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" },
  statValue: { fontSize: "28px", fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: "11px", fontWeight: 600, color: "#374151", lineHeight: 1.3 },

  mobileSection: { padding: "16px 16px 0" },
  mobileSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  mobileSectionLabel: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.08em" },
  viewAllBtn: { background: "none", border: "none", fontSize: "12px", color: "#367C2B", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textDecoration: "underline" },
  mobileCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "10px", padding: "0 14px" },

  mobileAccountList: { display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "24px" },
  typeBadge: { flexShrink: 0, fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "100px", whiteSpace: "nowrap", marginTop: "2px" },
  actMiddle: { flex: 1, minWidth: 0 },
  actAccount: { fontSize: "13px", fontWeight: 600, color: "#367C2B", marginBottom: "2px" },
  actNotes: { fontSize: "12px", color: "#767676", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  actRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 },
  actDate: { fontSize: "11px", color: "#ABABAB", whiteSpace: "nowrap" },
  actTime: { fontSize: "10px", color: "#ABABAB" },
  todayBadge: { fontSize: "10px", fontWeight: 700, color: "#16A34A", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "100px", padding: "2px 7px" },

  // ── Desktop ──
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A", padding: "20px 20px 0" },
  sectionLabel: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.08em" },
  upcomingWrap: { padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: "10px" },
  upcomingStrip: { display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none" },
  upcomingChip: { flexShrink: 0, padding: "8px 12px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "2px" },

  filterWrap: { display: "flex", gap: "8px", padding: "16px 20px 0", overflowX: "auto", scrollbarWidth: "none" },

  cardList: { display: "flex", flexDirection: "column", gap: "10px", padding: "16px 20px 0" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" },
  cardCompany: { fontSize: "15px", fontWeight: 600, color: "#1A1A1A", marginBottom: "2px" },
  cardLastContact: { fontSize: "12px", color: "#767676" },
  statusBadge: { flexShrink: 0, fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", letterSpacing: "0.02em", whiteSpace: "nowrap" },

  progressWrap: { marginBottom: "6px" },
  progressTrack: { height: "4px", backgroundColor: "#F0F0ED", borderRadius: "2px", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#367C2B", borderRadius: "2px", transition: "width 0.3s ease" },
  daysLeftLabel: { fontSize: "11px", color: "#ABABAB" },
  daysLeftNum: { fontWeight: 600, color: "#374151" },

  emptyText: { fontSize: "14px", color: "#ABABAB", textAlign: "center", padding: "40px 0" },
};
