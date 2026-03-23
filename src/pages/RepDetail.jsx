import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";

export default function RepDetail() {
  const { repId } = useParams();
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) { navigate(-1); } else { navigate("/dashboard/reps"); }
  };

  const [profile, setProfile] = useState(null);
  const [rep, setRep] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [accountActivities, setAccountActivities] = useState({});
  const [accountContacts, setAccountContacts] = useState({});
  const [loading, setLoading] = useState(true);
  const [unassignMsg, setUnassignMsg] = useState(null);
  const [accountFilter, setAccountFilter] = useState("active");
  const [stats, setStats] = useState({
    activeAccounts: 0,
    logsThisWeek: 0,
    wonThisSprint: 0,
    lostThisSprint: 0,
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

    // Settings
    const { data: settings } = await supabase
      .from("app_settings").select("setting_key, setting_value");
    const repAtRiskDays = parseInt(settings?.find(s => s.setting_key === "rep_at_risk_days")?.setting_value || "2");
    const accountAtRiskDays = parseInt(settings?.find(s => s.setting_key === "account_at_risk_days")?.setting_value || "7"); // eslint-disable-line no-unused-vars

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
      .from("accounts").select("*, start_date, end_date").eq("rep_id", repId)
      .order("created_at", { ascending: false });
    setAccounts(accountsData || []);

    // Bulk-fetch all activities for this rep's accounts upfront
    const accountIds = (accountsData || []).map(a => a.id);
    if (accountIds.length > 0) {
      const { data: allActs } = await supabase
        .from("activities").select("*")
        .in("account_id", accountIds)
        .order("activity_date", { ascending: false });
      const actsByAccount = {};
      (allActs || []).forEach(act => {
        if (!actsByAccount[act.account_id]) actsByAccount[act.account_id] = [];
        actsByAccount[act.account_id].push(act);
      });
      setAccountActivities(actsByAccount);
    }

    // Stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: weekActs } = await supabase
      .from("activities").select("id")
      .eq("rep_id", repId)
      .gte("activity_date", weekAgo.toISOString().split("T")[0]);

    const ACTIVE_STATUSES_LOAD = ["New", "Contacted", "Engaged", "Proposal"];
    const activeCount = (accountsData || []).filter(a => ACTIVE_STATUSES_LOAD.includes(a.status || "New")).length;
    const wonAccounts = (accountsData || []).filter(a => a.status === "Won").length;
    const lostAccounts = (accountsData || []).filter(a => a.status === "Lost").length;

    setStats({
      activeAccounts: activeCount,
      logsThisWeek: weekActs?.length || 0,
      wonThisSprint: wonAccounts,
      lostThisSprint: lostAccounts,
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

  const getNextScheduled = (accountId) => {
    const acts = accountActivities[accountId] || [];
    const next = acts.find(a => a.scheduled_next_date);
    if (!next) return null;
    return `${next.scheduled_next_type} · ${new Date(next.scheduled_next_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  const ACTIVE_STATUSES = ["New", "Contacted", "Engaged", "Proposal"];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleUnassign = async (accountId) => {
    await supabase.from("accounts").update({ rep_id: null }).eq("id", accountId);
    const removedAccount = accounts.find(a => a.id === accountId);
    setAccounts(prev => prev.filter(a => a.id !== accountId));
    if (removedAccount && ACTIVE_STATUSES.includes(removedAccount.status || "New")) {
      setStats(prev => ({ ...prev, activeAccounts: prev.activeAccounts - 1 }));
    }
    setUnassignMsg(accountId);
    setTimeout(() => setUnassignMsg(null), 3000);
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div style={styles.loadingPage}><div style={styles.spinner} /></div>
    );
  }

  const visibleAccounts = accountFilter === "active"
    ? accounts.filter(a => ACTIVE_STATUSES.includes(a.status || "New"))
    : accounts.filter(a => a.status === accountFilter);

  const STAT_CARDS = [
    { label: "Active Accounts", value: stats.activeAccounts },
    { label: "Logs This Week", value: stats.logsThisWeek },
    { label: "Won This Sprint", value: stats.wonThisSprint },
    { label: "Lost This Sprint", value: stats.lostThisSprint },
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
          grid-template-columns: 1.5fr 100px 110px 80px 80px 130px 80px;
          gap: 12px; align-items: center;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .desktop-only { display: block; }
        .mobile-only { display: none; }

        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; padding-left: 16px !important; padding-right: 16px !important; overflow-x: hidden; }
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .rd-mobile-card-list { display: flex !important; flex-direction: column; gap: 8px; }
          .rd-mobile-card {
            width: 100%;
            box-sizing: border-box;
            background: #fff;
            border: 1px solid #E8E8E6;
            border-radius: 8px;
            padding: 14px 16px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: background 0.15s;
          }
          .rd-mobile-card:active { background: #F9F9F8; }
          .rd-card-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
          .rd-card-name { font-size: 15px; font-weight: 600; color: #1A1A1A; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .rd-card-meta { font-size: 12px; color: #ABABAB; white-space: nowrap; }
          .rd-card-stats { display: flex; justify-content: space-between; gap: 16px; }
          .rd-card-stat-item { display: flex; flex-direction: column; gap: 2px; }
          .rd-card-stat-label { font-size: 9px; font-weight: 600; color: #ABABAB; text-transform: uppercase; letter-spacing: 0.06em; }
          .rd-card-stat-value { font-size: 13px; font-weight: 500; color: #374151; }
        }
      `}</style>

      <div style={styles.layout}>

        <MobileManagerHeader activePath="/dashboard/reps" profile={profile} />
        <ManagerBottomNav activePath="/dashboard/reps" />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/reps" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <TopBar title={rep?.full_name} profile={profile} onSignOut={handleSignOut} />

          {/* Back link */}
          <button onClick={handleBack} style={styles.backLink}>
            ← Back
          </button>

          {/* STAT CARDS */}
          <div className="stat-grid" style={styles.statGrid}>
            {STAT_CARDS.map(card => (
              <div key={card.label} style={styles.statCard}>
                <p style={styles.statValue}>{card.value}</p>
                <p style={styles.statLabel}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* DESKTOP: accounts table inside tableCard */}
          <div className="desktop-only" style={styles.tableCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", borderBottom: "1px solid #F0F0ED", flexWrap: "wrap" }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A", marginRight: "8px" }}>Accounts</p>
              {[
                { key: "active", label: `Active: ${stats.activeAccounts}`, bg: accountFilter === "active" ? "#367C2B" : "#fff", color: accountFilter === "active" ? "#fff" : "#367C2B", border: "#367C2B" },
                { key: "Won", label: `Won: ${stats.wonThisSprint}`, bg: accountFilter === "Won" ? "#367C2B" : "#F0FDF4", color: accountFilter === "Won" ? "#fff" : "#16A34A", border: "#BBF7D0" },
                { key: "Lost", label: `Lost: ${stats.lostThisSprint}`, bg: accountFilter === "Lost" ? "#DC2626" : "#FEF2F2", color: accountFilter === "Lost" ? "#fff" : "#DC2626", border: "#FECACA" },
              ].map(pill => (
                <button key={pill.key} onClick={() => setAccountFilter(pill.key)} style={{
                  background: pill.bg, color: pill.color,
                  border: `1.5px solid ${pill.border}`,
                  borderRadius: "100px", padding: "4px 12px",
                  fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s",
                }}>
                  {pill.label}
                </button>
              ))}
            </div>
            <div>
              <div style={{ ...styles.accountRowGrid, ...styles.tableHeader, padding: "10px 20px" }}>
                <span>Account / Contact</span>
                <span>Status</span>
                <span>Last Activity</span>
                <span>Logs</span>
                <span>Days Left</span>
                <span>Next Scheduled</span>
                <span></span>
              </div>

              {visibleAccounts.length === 0 ? (
                <p style={styles.emptyText}>{accountFilter === "active" ? "No active accounts" : `No ${accountFilter} accounts`}</p>
              ) : (
                visibleAccounts.map(account => {
                  const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                  const isExpanded = expandedAccount === account.id;
                  const acts = accountActivities[account.id] || [];
                  const cons = accountContacts[account.id] || [];
                  const primaryContact = cons.find(c => c.is_primary) || cons[0];

                  return (
                    <div key={account.id} className="account-row">
                      <div className="account-row-grid" onClick={() => loadAccountDetail(account.id)}>
                        <div>
                          <p style={styles.accountName}>{account.name || account.company}</p>
                          {primaryContact && (
                            <p style={styles.accountContact}>
                              {primaryContact.first_name} {primaryContact.last_name}
                            </p>
                          )}
                        </div>
                        <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {account.status || "New"}
                        </span>
                        <span style={styles.cellText}>{acts.length > 0 ? formatDate(acts[0]?.activity_date) : "—"}</span>
                        <span style={styles.cellText}>{acts.length || "—"}</span>
                        <span style={styles.cellText}>
                          {account.end_date
                            ? `${Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))}d`
                            : "—"}
                        </span>
                        <span style={styles.cellText}>{getNextScheduled(account.id) || "—"}</span>
                        <span>
                          {unassignMsg === account.id ? (
                            <span style={styles.unassignConfirm}>Unassigned</span>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); handleUnassign(account.id); }} style={styles.unassignLink}>
                              Unassign
                            </button>
                          )}
                        </span>
                      </div>

                      {isExpanded && (
                        <div style={styles.expandedDetail}>
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Company</p>
                            <p style={styles.detailValue}>{account.name || account.company}</p>
                            {account.address && (
                              <a href={`https://maps.google.com/?q=${encodeURIComponent(account.address)}`} target="_blank" rel="noreferrer" style={styles.addressLink}>
                                {account.address}
                              </a>
                            )}
                          </div>
                          {cons.length > 0 && (
                            <div style={styles.detailSection}>
                              <p style={styles.detailLabel}>Contacts</p>
                              {cons.map(c => (
                                <div key={c.id} style={styles.contactRow}>
                                  <span style={styles.contactName}>{c.first_name} {c.last_name}{c.title ? ` · ${c.title}` : ""}</span>
                                  <div style={styles.contactLinks}>
                                    {c.phone && <a href={`tel:${c.phone}`} style={styles.contactLink}>{c.phone}</a>}
                                    {c.email && <a href={`mailto:${c.email}`} style={styles.contactLink}>{c.email}</a>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Notes</p>
                            {account.notes
                              ? <p style={{ fontSize: "13px", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{account.notes}</p>
                              : <p style={styles.emptySmall}>No notes added</p>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* MOBILE: filter pills + standalone cards */}
          <div className="mobile-only">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingBottom: "8px" }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A", marginRight: "8px" }}>Accounts</p>
              {[
                { key: "active", label: `Active: ${stats.activeAccounts}`, bg: accountFilter === "active" ? "#367C2B" : "#fff", color: accountFilter === "active" ? "#fff" : "#367C2B", border: "#367C2B" },
                { key: "Won", label: `Won: ${stats.wonThisSprint}`, bg: accountFilter === "Won" ? "#367C2B" : "#F0FDF4", color: accountFilter === "Won" ? "#fff" : "#16A34A", border: "#BBF7D0" },
                { key: "Lost", label: `Lost: ${stats.lostThisSprint}`, bg: accountFilter === "Lost" ? "#DC2626" : "#FEF2F2", color: accountFilter === "Lost" ? "#fff" : "#DC2626", border: "#FECACA" },
              ].map(pill => (
                <button key={pill.key} onClick={() => setAccountFilter(pill.key)} style={{
                  background: pill.bg, color: pill.color,
                  border: `1.5px solid ${pill.border}`,
                  borderRadius: "100px", padding: "4px 12px",
                  fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s",
                }}>
                  {pill.label}
                </button>
              ))}
            </div>
            <div className="rd-mobile-card-list">
              {visibleAccounts.length === 0 ? (
                <p style={styles.emptyText}>{accountFilter === "active" ? "No active accounts" : `No ${accountFilter} accounts`}</p>
              ) : (
                visibleAccounts.map(account => {
                  const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                  const isExpanded = expandedAccount === account.id;
                  const acts = accountActivities[account.id] || [];
                  const cons = accountContacts[account.id] || [];
                  const isActive = ACTIVE_STATUSES.includes(account.status || "New");
                  const isLost = account.status === "Lost";
                  const leftBorder = isActive ? "3px solid #367C2B" : isLost ? "3px solid #DC2626" : "1px solid #E8E8E6";
                  const daysLeft = account.end_date
                    ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null;
                  const lastActDate = acts.length > 0 ? formatDate(acts[0]?.activity_date) : null;
                  const nextSched = getNextScheduled(account.id);

                  return (
                    <div
                      key={account.id}
                      className="rd-mobile-card"
                      style={{ borderLeft: leftBorder }}
                      onClick={() => loadAccountDetail(account.id)}
                    >
                      {/* Row 1: name + status badge */}
                      <div className="rd-card-row">
                        <span className="rd-card-name">{account.name || account.company}</span>
                        <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: "10px", padding: "3px 8px" }}>
                          {account.status || "New"}
                        </span>
                      </div>

                      {/* Row 2: last activity + days left */}
                      <div className="rd-card-row">
                        <span className="rd-card-meta">{lastActDate ? `Last activity · ${lastActDate}` : "No activity yet"}</span>
                        <span className="rd-card-meta">{daysLeft !== null ? `${daysLeft}d left` : "—"}</span>
                      </div>

                      {/* Row 3: activity count + next scheduled */}
                      <div className="rd-card-stats">
                        <div className="rd-card-stat-item">
                          <span className="rd-card-stat-label">Activities</span>
                          <span className="rd-card-stat-value">{acts.length}</span>
                        </div>
                        <div className="rd-card-stat-item" style={{ alignItems: "flex-end" }}>
                          <span className="rd-card-stat-label">Next Scheduled</span>
                          <span className="rd-card-stat-value">{nextSched || "—"}</span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ ...styles.expandedDetail, marginTop: 0 }}>
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Company</p>
                            <p style={styles.detailValue}>{account.name || account.company}</p>
                            {account.address && (
                              <a href={`https://maps.google.com/?q=${encodeURIComponent(account.address)}`} target="_blank" rel="noreferrer" style={styles.addressLink}>
                                {account.address}
                              </a>
                            )}
                          </div>
                          {cons.length > 0 && (
                            <div style={styles.detailSection}>
                              <p style={styles.detailLabel}>Contacts</p>
                              {cons.map(c => (
                                <div key={c.id} style={styles.contactRow}>
                                  <span style={styles.contactName}>{c.first_name} {c.last_name}{c.title ? ` · ${c.title}` : ""}</span>
                                  <div style={styles.contactLinks}>
                                    {c.phone && <a href={`tel:${c.phone}`} style={styles.contactLink}>{c.phone}</a>}
                                    {c.email && <a href={`mailto:${c.email}`} style={styles.contactLink}>{c.email}</a>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Notes</p>
                            {account.notes
                              ? <p style={{ fontSize: "13px", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{account.notes}</p>
                              : <p style={styles.emptySmall}>No notes added</p>
                            }
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
    gridTemplateColumns: "1.5fr 100px 110px 80px 80px 130px 80px",
    gap: "12px", alignItems: "center",
  },
  unassignLink: {
    background: "none", border: "none", padding: 0,
    fontSize: "12px", color: "#DC2626", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", textDecoration: "none", fontWeight: 500,
  },
  unassignConfirm: { fontSize: "12px", color: "#16A34A", fontWeight: 500 },
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
