import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";

export default function RepDetail() {
  const { repId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [rep, setRep] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [sprint, setSprint] = useState(null);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [accountActivities, setAccountActivities] = useState({});
  const [accountContacts, setAccountContacts] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    accountsAssigned: 0,
    logsThisWeek: 0,
    wonThisSprint: 0,
    daysLeft: 0,
  });

  const STATUS_COLORS = {
    New:       { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    Contacted: { bg: "#FEFCE8", color: "#CA8A04", border: "#FDE68A" },
    Engaged:   { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
    Proposal:  { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
    Won:       { bg: "#367C2B", color: "#FFFFFF", border: "#367C2B" },
    Lost:      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  };

  useEffect(() => { loadData(); }, [repId]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    // Manager profile
    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/accounts"); return; }

    // Rep profile
    const { data: repData } = await supabase
      .from("profiles").select("*").eq("id", repId).single();
    setRep(repData);

    // Rep's accounts
    const { data: accountsData } = await supabase
      .from("accounts").select("*").eq("rep_id", repId)
      .order("created_at", { ascending: false });
    setAccounts(accountsData || []);

    // Sprint
    const today = new Date().toISOString().split("T")[0];
    const { data: sprintData } = await supabase
      .from("sprints").select("*").eq("rep_id", repId)
      .lte("start_date", today).gte("end_date", today).single();
    setSprint(sprintData);

    // Stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: weekActs } = await supabase
      .from("activities").select("id")
      .eq("rep_id", repId)
      .gte("activity_date", weekAgo.toISOString().split("T")[0]);

    const wonAccounts = (accountsData || []).filter(a => a.status === "Won").length;
    const daysLeft = sprintData
      ? Math.max(0, Math.ceil((new Date(sprintData.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
      : 0;

    setStats({
      accountsAssigned: (accountsData || []).length,
      logsThisWeek: weekActs?.length || 0,
      wonThisSprint: wonAccounts,
      daysLeft,
    });

    setLoading(false);
  };

  const loadAccountDetail = async (accountId) => {
    if (expandedAccount === accountId) {
      setExpandedAccount(null);
      return;
    }
    setExpandedAccount(accountId);

    // Load activities for this account
    if (!accountActivities[accountId]) {
      const { data: acts } = await supabase
        .from("activities").select("*")
        .eq("account_id", accountId)
        .order("activity_date", { ascending: false });
      setAccountActivities(prev => ({ ...prev, [accountId]: acts || [] }));
    }

    // Load contacts for this account
    if (!accountContacts[accountId]) {
      const { data: cons } = await supabase
        .from("contacts").select("*")
        .eq("account_id", accountId)
        .order("is_primary", { ascending: false });
      setAccountContacts(prev => ({ ...prev, [accountId]: cons || [] }));
    }
  };

  const sprintProgress = () => {
    if (!sprint) return 0;
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const today = new Date();
    return Math.min(100, Math.max(0, Math.round(((today - start) / (end - start)) * 100)));
  };

  const getNextScheduled = (accountId) => {
    const acts = accountActivities[accountId] || [];
    const next = acts.find(a => a.scheduled_next_date);
    if (!next) return null;
    return `${next.scheduled_next_type} · ${new Date(next.scheduled_next_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div style={styles.loadingPage}><div style={styles.spinner} /></div>
    );
  }

  const STAT_CARDS = [
    { label: "Accounts Assigned", value: stats.accountsAssigned },
    { label: "Logs This Week", value: stats.logsThisWeek },
    { label: "Won This Sprint", value: stats.wonThisSprint },
    { label: "Days Left in Sprint", value: stats.daysLeft },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .account-row {
          padding: 14px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .account-row:hover { background: #F9F9F8; }
        .account-row:last-child { border-bottom: none; }

        .account-row-grid {
          display: grid;
          grid-template-columns: 1.5fr 100px 110px 80px 130px;
          gap: 12px; align-items: center;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; }
        }
      `}</style>

      <div style={styles.layout}>

        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>

          {/* Back link */}
          <button onClick={() => navigate("/dashboard")} style={styles.backLink}>
            ← Back to dashboard
          </button>

          {/* Page title */}
          <h1 style={styles.pageTitle}>{rep?.full_name}</h1>

          {/* STAT CARDS */}
          <div style={styles.statGrid}>
            {STAT_CARDS.map(card => (
              <div key={card.label} style={styles.statCard}>
                <p style={styles.statValue}>{card.value}</p>
                <p style={styles.statLabel}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* ACCOUNTS TABLE */}
          <div style={styles.tableCard}>
            <p style={styles.tableTitle}>Accounts</p>

            {/* Table header */}
            <div style={{ ...styles.accountRowGrid, ...styles.tableHeader, padding: "10px 20px" }}>
              <span>Account / Contact</span>
              <span>Status</span>
              <span>Last Activity</span>
              <span>Logs</span>
              <span>Next Scheduled</span>
            </div>

            {accounts.length === 0 ? (
              <p style={styles.emptyText}>No accounts assigned</p>
            ) : (
              accounts.map(account => {
                const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                const isExpanded = expandedAccount === account.id;
                const acts = accountActivities[account.id] || [];
                const cons = accountContacts[account.id] || [];
                const primaryContact = cons.find(c => c.is_primary) || cons[0];

                return (
                  <div key={account.id} className="account-row">
                    {/* Row */}
                    <div
                      className="account-row-grid"
                      onClick={() => loadAccountDetail(account.id)}
                    >
                      <div>
                        <p style={styles.accountName}>{account.name || account.company}</p>
                        {primaryContact && (
                          <p style={styles.accountContact}>
                            {primaryContact.first_name} {primaryContact.last_name}
                          </p>
                        )}
                      </div>
                      <span style={{
                        ...styles.statusBadge,
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                      }}>
                        {account.status || "New"}
                      </span>
                      <span style={styles.cellText}>
                        {isExpanded && acts.length > 0 ? formatDate(acts[0]?.activity_date) : "—"}
                      </span>
                      <span style={styles.cellText}>{acts.length || "—"}</span>
                      <span style={styles.cellText}>
                        {isExpanded ? (getNextScheduled(account.id) || "None") : "—"}
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={styles.expandedDetail}>

                        {/* Company info */}
                        <div style={styles.detailSection}>
                          <p style={styles.detailLabel}>Company</p>
                          <p style={styles.detailValue}>{account.name || account.company}</p>
                          {account.address && (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(account.address)}`}
                              target="_blank" rel="noreferrer"
                              style={styles.addressLink}
                            >
                              {account.address}
                            </a>
                          )}
                        </div>

                        {/* Contacts */}
                        {cons.length > 0 && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Contacts</p>
                            {cons.map(c => (
                              <div key={c.id} style={styles.contactRow}>
                                <span style={styles.contactName}>
                                  {c.first_name} {c.last_name}
                                  {c.title ? ` · ${c.title}` : ""}
                                </span>
                                <div style={styles.contactLinks}>
                                  {c.phone && (
                                    <a href={`tel:${c.phone}`} style={styles.contactLink}>{c.phone}</a>
                                  )}
                                  {c.email && (
                                    <a href={`mailto:${c.email}`} style={styles.contactLink}>{c.email}</a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sprint progress */}
                        {sprint && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Sprint Progress</p>
                            <div style={styles.progressTrack}>
                              <div style={{ ...styles.progressFill, width: `${sprintProgress()}%` }} />
                            </div>
                            <p style={styles.progressNote}>{stats.daysLeft} days left</p>
                          </div>
                        )}

                        {/* Activity log */}
                        <div style={styles.detailSection}>
                          <p style={styles.detailLabel}>Activity Log</p>
                          {acts.length === 0 ? (
                            <p style={styles.emptySmall}>No activity logged</p>
                          ) : (
                            <div style={styles.timeline}>
                              {acts.map((act, i) => (
                                <div key={act.id} style={styles.timelineItem}>
                                  <div style={styles.timelineDotWrap}>
                                    <div style={styles.timelineDot} />
                                    {i < acts.length - 1 && <div style={styles.timelineLine} />}
                                  </div>
                                  <div style={styles.timelineContent}>
                                    <div style={styles.timelineHeader}>
                                      <span style={styles.actType}>{act.activity_type}</span>
                                      <span style={styles.actDate}>{formatDate(act.activity_date)}</span>
                                    </div>
                                    {act.outcome && <p style={styles.actOutcome}>{act.outcome}</p>}
                                    {act.notes && <p style={styles.actNotes}>{act.notes}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })
            )}
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

  // Main
  main: {
    marginLeft: "220px", flex: 1,
    padding: "28px 32px",
    display: "flex", flexDirection: "column", gap: "20px",
    minHeight: "100vh",
  },
  backLink: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", color: "#367C2B", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    textDecoration: "underline", alignSelf: "flex-start",
  },
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },

  // Stat cards
  statGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px",
  },
  statCard: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "8px", padding: "20px 16px",
  },
  statValue: { fontSize: "32px", fontWeight: 600, color: "#1A1A1A", lineHeight: 1 },
  statLabel: { fontSize: "12px", color: "#767676", marginTop: "6px" },

  // Table
  tableCard: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "8px", overflow: "hidden",
  },
  tableTitle: {
    fontSize: "14px", fontWeight: 600, color: "#1A1A1A",
    padding: "16px 20px 12px", borderBottom: "1px solid #F0F0ED",
  },
  accountRowGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 100px 110px 80px 130px",
    gap: "12px", alignItems: "center",
  },
  tableHeader: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: "1px solid #F0F0ED",
  },
  accountName: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  accountContact: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  statusBadge: {
    fontSize: "11px", fontWeight: 600,
    padding: "4px 10px", borderRadius: "100px",
    whiteSpace: "nowrap", textAlign: "center", display: "inline-block",
  },
  cellText: { fontSize: "13px", color: "#374151" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },

  // Expanded detail
  expandedDetail: {
    backgroundColor: "#F9F9F8",
    borderTop: "1px solid #F0F0ED",
    padding: "16px 20px",
    display: "flex", flexDirection: "column", gap: "16px",
    marginTop: "12px",
  },
  detailSection: { display: "flex", flexDirection: "column", gap: "6px" },
  detailLabel: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  detailValue: { fontSize: "14px", color: "#1A1A1A", fontWeight: 500 },
  addressLink: { fontSize: "13px", color: "#367C2B", fontWeight: 500 },

  // Contacts
  contactRow: { display: "flex", flexDirection: "column", gap: "4px", paddingBottom: "8px" },
  contactName: { fontSize: "13px", fontWeight: 500, color: "#1A1A1A" },
  contactLinks: { display: "flex", gap: "16px" },
  contactLink: { fontSize: "12px", color: "#367C2B" },

  // Progress
  progressTrack: {
    height: "5px", backgroundColor: "#F0F0ED",
    borderRadius: "3px", overflow: "hidden",
  },
  progressFill: {
    height: "100%", backgroundColor: "#367C2B",
    borderRadius: "3px",
  },
  progressNote: { fontSize: "12px", color: "#ABABAB" },

  // Timeline
  timeline: { display: "flex", flexDirection: "column" },
  timelineItem: { display: "flex", gap: "10px", paddingBottom: "12px" },
  timelineDotWrap: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  timelineDot: {
    width: "8px", height: "8px", borderRadius: "50%",
    backgroundColor: "#367C2B", marginTop: "4px",
  },
  timelineLine: { flex: 1, width: "1px", backgroundColor: "#E8E8E6", marginTop: "4px" },
  timelineContent: { flex: 1 },
  timelineHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "2px",
  },
  actType: { fontSize: "13px", fontWeight: 600, color: "#1A1A1A" },
  actDate: { fontSize: "11px", color: "#ABABAB" },
  actOutcome: { fontSize: "12px", color: "#374151" },
  actNotes: { fontSize: "12px", color: "#767676" },
  emptySmall: { fontSize: "13px", color: "#ABABAB" },
};
