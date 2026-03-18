import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Accounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [sprint, setSprint] = useState(null);
  const [upcomingActivities, setUpcomingActivities] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const STATUS_FILTERS = ["All", "New", "Contacted", "Engaged", "Proposal", "Won", "Lost"];

  const STATUS_COLORS = {
    New:        { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    Contacted:  { bg: "#FEFCE8", color: "#CA8A04", border: "#FDE68A" },
    Engaged:    { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
    Proposal:   { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
    Won:        { bg: "#367C2B", color: "#FFFFFF", border: "#367C2B" },
    Lost:       { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    // Get current sprint
    const today = new Date().toISOString().split("T")[0];
    const { data: sprintData } = await supabase
      .from("sprints")
      .select("*")
      .eq("rep_id", user.id)
      .lte("start_date", today)
      .gte("end_date", today)
      .single();
    setSprint(sprintData);

    // Get accounts for this rep
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("*, activities(activity_date, activity_type, scheduled_next_date, scheduled_next_type, scheduled_next_time)")
      .eq("rep_id", user.id)
      .order("created_at", { ascending: false });

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

    // Collect upcoming scheduled activities across all accounts
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
    setUpcomingActivities(upcoming.slice(0, 10));

    setLoading(false);
  };

  // Sprint countdown
  const daysLeft = () => {
    if (!sprint) return null;
    const today = new Date();
    const end = new Date(sprint.end_date);
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Sprint progress % elapsed
  const sprintProgress = () => {
    if (!sprint) return 0;
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const today = new Date();
    const total = end - start;
    const elapsed = today - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const formatSprintRange = () => {
    if (!sprint) return "";
    const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `Sprint · ${fmt(sprint.start_date)} – ${fmt(sprint.end_date)}`;
  };

  const getLastContact = (account) => {
    const acts = account.activities || [];
    if (!acts.length) return null;
    const dates = acts.map(a => new Date(a.activity_date));
    const latest = new Date(Math.max(...dates));
    return latest.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr === today;
  };

  const formatChipDate = (dateStr) => {
    if (isToday(dateStr)) return "Today";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredAccounts = filter === "All"
    ? accounts
    : accounts.filter(a => a.status === filter);

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

        .upcoming-strip {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .upcoming-strip::-webkit-scrollbar { display: none; }

        .upcoming-chip {
          flex-shrink: 0;
          padding: 8px 12px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .upcoming-chip:hover { opacity: 0.8; }
      `}</style>

      <div style={styles.page}>

        {/* ── HEADER BAR ── */}
        <div style={styles.header}>
          <img src="/src/assets/uatprologo.png" alt="United Ag & Turf" style={styles.headerLogo} />
          {daysLeft() !== null && (
            <div style={styles.sprintBadge}>
              {daysLeft()} days left
            </div>
          )}
        </div>

        {/* Sprint date range */}
        {sprint && (
          <p style={styles.sprintRange}>{formatSprintRange()}</p>
        )}

        {/* ── UPCOMING ACTIVITIES STRIP ── */}
        {upcomingActivities.length > 0 && (
          <div style={styles.upcomingWrap}>
            <p style={styles.sectionLabel}>Upcoming</p>
            <div className="upcoming-strip">
              {upcomingActivities.map((item, i) => {
                const today = isToday(item.date);
                return (
                  <div
                    key={i}
                    className="upcoming-chip"
                    onClick={() => navigate(`/accounts/${item.accountId}`)}
                    style={{
                      background: today ? "#F0FDF4" : "#EFF6FF",
                      border: `1px solid ${today ? "#BBF7D0" : "#BFDBFE"}`,
                    }}
                  >
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: today ? "#16A34A" : "#2563EB",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
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

        {/* ── FILTER PILLS ── */}
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

        {/* ── ACCOUNT CARDS ── */}
        <div style={styles.cardList}>
          {filteredAccounts.length === 0 ? (
            <p style={styles.emptyText}>No accounts{filter !== "All" ? ` with status "${filter}"` : ""}</p>
          ) : (
            filteredAccounts.map(account => {
              const statusStyle = STATUS_COLORS[account.status] || STATUS_COLORS.New;
              const lastContact = getLastContact(account);
              const progress = sprintProgress();

              return (
                <div
                  key={account.id}
                  className="account-card"
                  onClick={() => navigate(`/accounts/${account.id}`)}
                >
                  <div style={styles.cardTop}>
                    <div>
                      <p style={styles.cardCompany}>{account.name || account.company}</p>
                      {lastContact && (
                        <p style={styles.cardLastContact}>Last contact · {lastContact}</p>
                      )}
                      {!lastContact && (
                        <p style={styles.cardLastContact}>No activity yet</p>
                      )}
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

                  {/* Sprint progress bar */}
                  <div style={styles.progressWrap}>
                    <div style={styles.progressTrack}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${progress}%`,
                      }} />
                    </div>
                    <span style={styles.progressLabel}>{daysLeft()} days left</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: "480px",
    margin: "0 auto",
    paddingBottom: "40px",
  },

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  loadingDot: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "3px solid #E0E0DC",
    borderTopColor: "#367C2B",
    animation: "spin 0.8s linear infinite",
  },

  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #E8E8E6",
    backgroundColor: "#ffffff",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerLogo: {
    height: "32px",
    objectFit: "contain",
  },
  sprintBadge: {
    backgroundColor: "#FFDE00",
    color: "#1A1A1A",
    fontSize: "12px",
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: "100px",
    letterSpacing: "0.01em",
  },

  sprintRange: {
    fontSize: "12px",
    color: "#767676",
    padding: "8px 20px 0",
  },

  // Upcoming strip
  upcomingWrap: {
    padding: "16px 20px 0",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#ABABAB",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  // Filter pills
  filterWrap: {
    display: "flex",
    gap: "8px",
    padding: "16px 20px 0",
    overflowX: "auto",
    scrollbarWidth: "none",
  },

  // Cards
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px 20px 0",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "12px",
  },
  cardCompany: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1A1A1A",
    marginBottom: "2px",
  },
  cardLastContact: {
    fontSize: "12px",
    color: "#767676",
  },
  statusBadge: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "100px",
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },

  // Progress bar
  progressWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  progressTrack: {
    flex: 1,
    height: "4px",
    backgroundColor: "#F0F0ED",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#367C2B",
    borderRadius: "2px",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    fontSize: "11px",
    color: "#ABABAB",
    whiteSpace: "nowrap",
  },

  emptyText: {
    fontSize: "14px",
    color: "#ABABAB",
    textAlign: "center",
    padding: "40px 0",
  },
};
