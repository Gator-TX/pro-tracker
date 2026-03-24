import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";
import RepBottomNav from "../components/RepBottomNav";
import RepTopBar from "../components/RepTopBar";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import PullToRefresh from "../components/PullToRefresh";

export default function Accounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState("Active");
  const [search, setSearch] = useState("");
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);

    const { data: accountsData } = await supabase
      .from("target_accounts")
      .select("*, start_date, end_date, target_activities(id, activity_date)")
      .eq("rep_id", user.id)
      .order("created_at", { ascending: false });

    const sorted = (accountsData || []).sort((a, b) => {
      const aDate = a.target_activities?.length
        ? Math.max(...a.target_activities.map(x => new Date(x.activity_date)))
        : new Date(a.created_at);
      const bDate = b.target_activities?.length
        ? Math.max(...b.target_activities.map(x => new Date(x.activity_date)))
        : new Date(b.created_at);
      return bDate - aDate;
    });
    setAccounts(sorted);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getLastContact = (account) => {
    const acts = account.target_activities || [];
    if (!acts.length) return null;
    const latest = new Date(Math.max(...acts.map(a => new Date(a.activity_date))));
    return latest.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredAccounts = accounts.filter(a => {
    const matchSearch = !search ||
      (a.name || a.company || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === "All" ? true
      : filter === "Active" ? ACTIVE_STATUSES.includes(a.status)
      : filter === "Closed" ? ["Won", "Lost"].includes(a.status)
      : a.status === filter;
    return matchSearch && matchStatus;
  });

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
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; }
          .account-card { width: 100%; box-sizing: border-box; }
          .acct-desktop-table { display: none !important; }
          .acct-desktop-topbar { display: none !important; }
        }

        .acct-search-input {
          flex: 1; padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
        }
        .acct-search-input:focus { border-color: #367C2B; }

        .acct-filter-select {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          cursor: pointer; appearance: none; -webkit-appearance: none;
        }
        .acct-filter-select:focus { border-color: #367C2B; }

        .account-card {
          width: 100%; box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #E8E8E6;
          border-left: 3px solid #367C2B;
          border-radius: 8px;
          padding: 14px 16px;
          cursor: pointer;
          transition: box-shadow 0.15s;
        }
        .account-card:hover { box-shadow: 0 2px 8px rgba(54,124,43,0.08); }

        /* Desktop table */
        .acct-desktop-table { display: none; }
        .acct-dt-row {
          display: grid;
          grid-template-columns: 2fr 120px 90px 120px 60px 80px;
          gap: 12px; align-items: center;
          padding: 12px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .acct-dt-row:hover { background: #F9F9F8; }
        .acct-dt-row:last-child { border-bottom: none; }

        @media (min-width: 769px) {
          .acct-mobile-list { display: none !important; }
          .acct-desktop-table { display: block; }
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.layout}>
        <MobileHeader activePath="/accounts" profile={profile} />
        <RepBottomNav activePath="/accounts" />
        <Sidebar role="rep" profile={profile} onSignOut={handleSignOut} activePath="/accounts" />
        <div className="main-content" style={styles.page}>
          <PullToRefresh onRefresh={loadData}>
            <RepTopBar title="My Accounts" profile={profile} onSignOut={handleSignOut} />

            {/* Search + status filter */}
            <div style={styles.filterWrap}>
              <input
                className="acct-search-input"
                type="text"
                placeholder="Search accounts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="acct-filter-select"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              >
                {STATUS_FILTERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* ── DESKTOP TABLE ── */}
            <div className="acct-desktop-table" style={styles.dtTableWrap}>
              <div style={styles.dtTableCard}>
                {/* Header */}
                <div style={styles.dtHeader}>
                  {["Account", "Status", "Days Left", "Last Activity", "Logs", "Actions"].map(h => (
                    <span key={h} style={styles.dtTh}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                {filteredAccounts.length === 0 ? (
                  <p style={styles.emptyText}>No accounts{filter !== "All" ? ` with status "${filter}"` : ""}</p>
                ) : (
                  filteredAccounts.map(account => {
                    const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                    const lastContact = getLastContact(account);
                    const daysLeft = account.end_date
                      ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                      : null;
                    return (
                      <div
                        key={account.id}
                        className="acct-dt-row"
                        onClick={() => navigate(`/accounts/${account.id}`)}
                      >
                        <span style={styles.dtName}>{account.name || account.company}</span>
                        <span style={{
                          ...styles.statusBadge,
                          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                        }}>
                          {account.status || "New"}
                        </span>
                        <span style={styles.dtCell}>{daysLeft !== null ? `${daysLeft}d` : "—"}</span>
                        <span style={styles.dtCell}>{lastContact || "—"}</span>
                        <span style={styles.dtCell}>{account.target_activities?.length || 0}</span>
                        <span>
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/accounts/${account.id}`); }}
                            style={styles.viewLink}
                          >
                            View
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── MOBILE CARD LIST ── */}
            <div className="acct-mobile-list" style={styles.cardList}>
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
                      style={account.status === "Lost" ? { borderLeft: "3px solid #DC2626" } : undefined}
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
                        <div style={styles.progressWrap}>
                          <div style={styles.progressTrack}>
                            <div style={{ ...styles.progressFill, width: `${accountProgress}%` }} />
                          </div>
                        </div>
                      )}
                      <p style={styles.daysLeftLabel}>
                        {accountDaysLeft !== null
                          ? <><span style={styles.daysLeftNum}>{accountDaysLeft}</span> days left</>
                          : "—"}
                      </p>
                    </div>
                  );
                })
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
  page: {
    marginLeft: "220px", flex: 1, minHeight: "100vh",
    display: "flex", flexDirection: "column",
    backgroundColor: "#F5F5F3", fontFamily: "'DM Sans', sans-serif",
    paddingBottom: "40px", overflowX: "hidden",
  },

  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  loadingDot: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },

  filterWrap: { display: "flex", gap: "8px", padding: "16px 16px 0", alignItems: "center" },

  // Desktop table
  dtTableWrap: { padding: "16px 16px 24px" },
  dtTableCard: {
    background: "#ffffff", border: "0.5px solid #E8E8E6",
    borderRadius: "8px", overflow: "hidden",
  },
  dtHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 120px 90px 120px 60px 80px",
    gap: "12px", alignItems: "center",
    padding: "10px 20px",
    background: "#FAFAFA", borderBottom: "1px solid #E8E8E6",
  },
  dtTh: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  dtName: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  dtCell: { fontSize: "13px", color: "#374151" },
  viewLink: {
    fontSize: "13px", fontWeight: 600, color: "#367C2B",
    background: "none", border: "none", padding: 0,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    textDecoration: "underline",
  },

  // Mobile card list
  cardList: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px 16px 0", width: "100%", marginBottom: "95px" },
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
