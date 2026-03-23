import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import ManagerBottomNav from "../components/ManagerBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function ManagerAccounts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRep, setFilterRep] = useState("all");
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || "active");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [accountDetails, setAccountDetails] = useState({});
  const [sprintEdits, setSprintEdits] = useState({});
  const [sprintSaved, setSprintSaved] = useState({});
  const [sortDirection, setSortDirection] = useState("asc");
  const [unassignMsg, setUnassignMsg] = useState(null);

  const STATUS_COLORS = {
    New:       { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    Contacted: { bg: "#FEFCE8", color: "#CA8A04", border: "#FDE68A" },
    Engaged:   { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
    Proposal:  { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
    Won:       { bg: "#367C2B", color: "#FFFFFF", border: "#367C2B" },
    Lost:      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role !== "manager") { navigate("/accounts"); return; }

    const { data: repsData } = await supabase
      .from("profiles").select("*").eq("role", "rep");
    setReps(repsData || []);

    const { data: accountsData } = await supabase
      .from("accounts")
      .select("*, start_date, end_date, activities(activity_date)")
      .order("created_at", { ascending: false });
    setAccounts(accountsData || []);

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getRepName = (repId) => {
    const rep = reps.find(r => r.id === repId);
    return rep?.full_name || "Unassigned";
  };

  const getLastActivity = (account) => {
    const acts = account.activities || [];
    if (!acts.length) return null;
    const latest = acts.reduce((a, b) =>
      new Date(a.activity_date) > new Date(b.activity_date) ? a : b
    );
    return new Date(latest.activity_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} account${selectedIds.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    await supabase.from("accounts").delete().in("id", selectedIds);
    setSelectedIds([]);
    await loadData();
    setDeleting(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAccount = async (accountId) => {
    if (expandedAccount === accountId) { setExpandedAccount(null); return; }
    setExpandedAccount(accountId);
    if (!accountDetails[accountId]) {
      const [{ data: acts }, { data: cons }] = await Promise.all([
        supabase.from("activities").select("*").eq("account_id", accountId)
          .order("activity_date", { ascending: false }),
        supabase.from("contacts").select("*").eq("account_id", accountId)
          .order("is_primary", { ascending: false }),
      ]);
      setAccountDetails(prev => ({ ...prev, [accountId]: { acts: acts || [], cons: cons || [] } }));
    }
    const acct = accounts.find(a => a.id === accountId);
    if (acct && !sprintEdits[accountId]) {
      setSprintEdits(prev => ({ ...prev, [accountId]: { start_date: acct.start_date || "", end_date: acct.end_date || "" } }));
    }
  };

  const handleUnassign = async (accountId) => {
    await supabase.from("accounts").update({ rep_id: null }).eq("id", accountId);
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, rep_id: null } : a));
    setUnassignMsg(accountId);
    setTimeout(() => setUnassignMsg(null), 3000);
  };

  const saveDates = async (accountId) => {
    const edit = sprintEdits[accountId] || {};
    await supabase.from("accounts")
      .update({ start_date: edit.start_date, end_date: edit.end_date })
      .eq("id", accountId);
    setAccounts(prev => prev.map(a =>
      a.id === accountId ? { ...a, start_date: edit.start_date, end_date: edit.end_date } : a
    ));
    setSprintSaved(prev => ({ ...prev, [accountId]: true }));
    setTimeout(() => setSprintSaved(prev => ({ ...prev, [accountId]: false })), 3000);
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const ACTIVE_STATUSES = ["New", "Contacted", "Engaged", "Proposal"];

  const filtered = accounts.filter(a => {
    const matchSearch = !search ||
      (a.name || a.company || "").toLowerCase().includes(search.toLowerCase());
    const matchRep = filterRep === "all" || a.rep_id === filterRep;
    const matchStatus = filterStatus === "all"
      ? true
      : filterStatus === "active"
      ? ACTIVE_STATUSES.includes(a.status || "New")
      : a.status === filterStatus;
    return matchSearch && matchRep && matchStatus;
  }).sort((a, b) => {
    const nameA = (a.name || a.company || "").toLowerCase();
    const nameB = (b.name || b.company || "").toLowerCase();
    return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });

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

        .account-row {
          display: grid;
          grid-template-columns: 32px 2fr 120px 120px 110px 80px 80px 90px;
          gap: 12px; align-items: center;
          padding: 13px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .account-row:hover { background: #F9F9F8; }
        .account-row:last-child { border-bottom: none; }

        .filter-select {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          cursor: pointer;
        }
        .filter-select:focus { border-color: #367C2B; }

        .search-input {
          padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          width: 220px;
        }
        .search-input:focus { border-color: #367C2B; }

        .field-input {
          padding: 7px 10px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: #367C2B; }

        .table-scroll {
          max-height: 600px; overflow-y: auto; min-width: 800px;
          scrollbar-width: thin; scrollbar-color: #E0E0DC transparent;
        }
        .account-row { min-width: 800px; }
        .mobile-only { display: none; }
        .desktop-only { display: block; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; padding-left: 16px !important; padding-right: 16px !important; }
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column; gap: 8px; margin-top: 8px; }
          .acct-filter-bar { gap: 8px !important; }
          .acct-mobile-card {
            background: #fff;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #E8E8E6;
            border-radius: 8px;
            padding: 14px 16px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: background 0.15s;
          }
          .acct-mobile-card:active { background: #F9F9F8; }
          .acct-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .acct-card-name { font-size: 15px; font-weight: 600; color: #1A1A1A; flex: 1; min-width: 0; }
          .acct-card-row2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .acct-card-rep { font-size: 12px; color: #767676; }
          .acct-card-days { font-size: 12px; color: #ABABAB; }
          .acct-card-row3 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .acct-card-meta { font-size: 12px; color: #ABABAB; }
          .acct-card-expanded { border-top: 1px solid #F0F0ED; padding-top: 12px; margin-top: 0; display: flex; flex-direction: column; gap: 14px; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/accounts" profile={profile} />
        <ManagerBottomNav activePath="/dashboard/accounts" />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/accounts" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <PullToRefresh onRefresh={loadData}>
          <TopBar title="Accounts" profile={profile} onSignOut={handleSignOut} />
          <p className="desktop-only" style={styles.subTitle}>{filtered.length} accounts</p>

          {/* Filters */}
          <div className="acct-filter-bar" style={styles.filterBar}>
            <input
              className="search-input"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="filter-select" value={filterRep}
              onChange={e => setFilterRep(e.target.value)}>
              <option value="all">All Reps</option>
              {reps.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.full_name}</option>
              ))}
            </select>
            <select className="filter-select" value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Delete button */}
          {selectedIds.length > 0 && (
            <button onClick={handleDelete} disabled={deleting} style={styles.deleteBtn}>
              {deleting ? "Deleting…" : `Delete selected (${selectedIds.length})`}
            </button>
          )}

          {/* Table */}
          <div className="acct-table-card desktop-only" style={styles.tableCard}>
            <div className="acct-table-header" style={{ ...styles.accountRow, ...styles.tableHeader, boxShadow: "0 2px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1, minWidth: "800px" }}>
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(a => selectedIds.includes(a.id))}
                onChange={e => setSelectedIds(e.target.checked ? filtered.map(a => a.id) : [])}
                style={styles.checkbox}
              />
              <span style={{ cursor: "pointer" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                Account {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <span>Status</span>
              <span>Assigned Rep</span>
              <span>Last Activity</span>
              <span>Days Left</span>
              <span>Logs</span>
              <span>Actions</span>
            </div>

            <div className="table-scroll">
            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No accounts found</p>
            ) : (
              filtered.map(account => {
                const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                const isExpanded = expandedAccount === account.id;
                const acts = accountDetails[account.id]?.acts || [];
                const cons = accountDetails[account.id]?.cons || [];

                const daysLeft = account.end_date
                  ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                  : null;
                const progress = (account.start_date && account.end_date)
                  ? Math.min(100, Math.max(0, Math.round(
                      ((new Date() - new Date(account.start_date)) /
                      (new Date(account.end_date) - new Date(account.start_date))) * 100
                    )))
                  : 0;

                return (
                  <div key={account.id} style={{ borderBottom: "1px solid #F0F0ED" }}>
                    {/* Main row */}
                    <div className="account-row" style={{ borderBottom: "none" }}
                      onClick={() => toggleAccount(account.id)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(account.id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(account.id); }}
                        onClick={e => e.stopPropagation()}
                        style={styles.checkbox}
                      />
                      <span className="acct-name" style={styles.accountName}>{account.name || account.company}</span>
                      <span className="acct-status" style={{
                        ...styles.statusBadge,
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                      }}>
                        {account.status || "New"}
                      </span>
                      <span className="acct-rep" style={styles.cellText}>{getRepName(account.rep_id)}</span>
                      <span className="acct-last" style={styles.cellText}>{getLastActivity(account) || "—"}</span>
                      <span className="acct-days" style={styles.cellText}>
                        {account.end_date ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : "—"}
                      </span>
                      <span className="acct-logs" style={styles.cellText}>{account.activities?.length || 0}</span>
                      <span onClick={e => e.stopPropagation()}>
                        {account.rep_id ? (
                          <button
                            onClick={e => { e.stopPropagation(); handleUnassign(account.id); }}
                            style={styles.unassignLink}>
                            Unassign
                          </button>
                        ) : (
                          <span style={styles.cellText}>—</span>
                        )}
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={styles.expandedDetail}>

                        {/* Company */}
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
                                  {c.phone && <a href={`tel:${c.phone}`} style={styles.contactLink}>{c.phone}</a>}
                                  {c.email && <a href={`mailto:${c.email}`} style={styles.contactLink}>{c.email}</a>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sprint progress */}
                        {account.end_date && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Target Progress</p>
                            <div style={styles.progressTrack}>
                              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                            </div>
                            <p style={styles.progressNote}>{daysLeft} days left</p>
                          </div>
                        )}

                        {/* Sprint Dates */}
                        <div style={styles.detailSection}>
                          <p style={styles.detailLabel}>Target Dates</p>
                          <div style={styles.sprintDateRow}>
                            <div style={styles.sprintDateField}>
                              <label style={styles.sprintDateLabel}>Start Date</label>
                              <input
                                type="date"
                                className="field-input"
                                style={styles.sprintDateInput}
                                value={sprintEdits[account.id]?.start_date || ""}
                                onChange={e => setSprintEdits(prev => ({ ...prev, [account.id]: { ...prev[account.id], start_date: e.target.value } }))}
                              />
                            </div>
                            <div style={styles.sprintDateField}>
                              <label style={styles.sprintDateLabel}>End Date</label>
                              <input
                                type="date"
                                className="field-input"
                                style={styles.sprintDateInput}
                                value={sprintEdits[account.id]?.end_date || ""}
                                onChange={e => setSprintEdits(prev => ({ ...prev, [account.id]: { ...prev[account.id], end_date: e.target.value } }))}
                              />
                            </div>
                            <div style={styles.sprintSaveWrap}>
                              <button style={styles.saveDatesBtn} onClick={() => saveDates(account.id)}>
                                Save Dates
                              </button>
                              {sprintSaved[account.id] && (
                                <span style={styles.savedMsg}>Dates saved</span>
                              )}
                            </div>
                          </div>
                        </div>

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

                        {/* Notes */}
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

          {/* MOBILE: Account Cards */}
          <div className="mobile-only">
            {filtered.length === 0 ? (
              <p style={styles.emptyText}>No accounts found</p>
            ) : (
              filtered.map(account => {
                const sc = STATUS_COLORS[account.status] || STATUS_COLORS.New;
                const isExpanded = expandedAccount === account.id;
                const acts = accountDetails[account.id]?.acts || [];
                const cons = accountDetails[account.id]?.cons || [];
                const daysLeft = account.end_date
                  ? Math.max(0, Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
                  : null;
                const progress = (account.start_date && account.end_date)
                  ? Math.min(100, Math.max(0, Math.round(
                      ((new Date() - new Date(account.start_date)) /
                      (new Date(account.end_date) - new Date(account.start_date))) * 100
                    )))
                  : 0;
                const status = account.status || "New";
                const isActive = ["New", "Contacted", "Engaged", "Proposal"].includes(status);
                const leftBorder = isActive ? "3px solid #367C2B" : status === "Lost" ? "3px solid #DC2626" : "1px solid #E8E8E6";
                return (
                  <div
                    key={`m-${account.id}`}
                    className="acct-mobile-card"
                    style={{ borderLeft: leftBorder }}
                    onClick={() => toggleAccount(account.id)}
                  >
                    {/* Top row: name + status badge */}
                    <div className="acct-card-top">
                      <span className="acct-card-name">{account.name || account.company}</span>
                      <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
                        {status}
                      </span>
                    </div>
                    {/* Second row: rep left, days right */}
                    <div className="acct-card-row2">
                      <span className="acct-card-rep">{getRepName(account.rep_id)}</span>
                      <span className="acct-card-days">{daysLeft !== null ? `${daysLeft}d left` : "—"}</span>
                    </div>
                    {/* Third row: activity info + unassign */}
                    <div className="acct-card-row3">
                      <span className="acct-card-meta">
                        {getLastActivity(account) ? `Last: ${getLastActivity(account)}` : "No activity"} · {account.activities?.length || 0} logs
                      </span>
                      {account.rep_id && (
                        unassignMsg === account.id
                          ? <span style={{ fontSize: "12px", color: "#16A34A" }}>Unassigned</span>
                          : <button onClick={e => { e.stopPropagation(); handleUnassign(account.id); }} style={styles.unassignLink}>Unassign</button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="acct-card-expanded">
                        {account.address && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Address</p>
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(account.address)}`}
                              target="_blank" rel="noreferrer" style={styles.addressLink}
                              onClick={e => e.stopPropagation()}>{account.address}</a>
                          </div>
                        )}
                        {cons.length > 0 && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Contacts</p>
                            {cons.map(c => (
                              <div key={c.id} style={styles.contactRow}>
                                <span style={styles.contactName}>{c.first_name} {c.last_name}{c.title ? ` · ${c.title}` : ""}</span>
                                <div style={styles.contactLinks}>
                                  {c.phone && <a href={`tel:${c.phone}`} style={styles.contactLink} onClick={e => e.stopPropagation()}>{c.phone}</a>}
                                  {c.email && <a href={`mailto:${c.email}`} style={styles.contactLink} onClick={e => e.stopPropagation()}>{c.email}</a>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {account.end_date && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Target Progress</p>
                            <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${progress}%` }} /></div>
                            <p style={styles.progressNote}>{daysLeft} days left</p>
                          </div>
                        )}
                        <div style={styles.detailSection}>
                          <p style={styles.detailLabel}>Activity Log</p>
                          {acts.length === 0 ? <p style={styles.emptySmall}>No activity logged</p> : (
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
                        {account.notes && (
                          <div style={styles.detailSection}>
                            <p style={styles.detailLabel}>Notes</p>
                            <p style={{ fontSize: "13px", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{account.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
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
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
  main: { marginLeft: "220px", flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px", minHeight: "100vh" },
  topBar: { display: "flex", alignItems: "baseline", gap: "12px" },
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },
  subTitle: { fontSize: "13px", color: "#767676" },
  filterBar: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  tableCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  accountRow: { display: "grid", gridTemplateColumns: "32px 2fr 120px 120px 110px 80px 80px 90px", gap: "12px", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #F0F0ED" },
  checkbox: { width: "16px", height: "16px", cursor: "pointer", accentColor: "#367C2B" },
  deleteBtn: { alignSelf: "flex-start", padding: "8px 16px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  tableHeader: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "default" },
  accountName: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  statusBadge: { fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center", display: "inline-block" },
  cellText: { fontSize: "13px", color: "#374151" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },

  // Expanded detail
  expandedDetail: { backgroundColor: "#F9F9F8", borderTop: "1px solid #F0F0ED", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" },
  detailSection: { display: "flex", flexDirection: "column", gap: "6px" },
  detailLabel: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  detailValue: { fontSize: "14px", color: "#1A1A1A", fontWeight: 500 },
  addressLink: { fontSize: "13px", color: "#367C2B", fontWeight: 500 },
  contactRow: { display: "flex", flexDirection: "column", gap: "4px", paddingBottom: "8px" },
  contactName: { fontSize: "13px", fontWeight: 500, color: "#1A1A1A" },
  contactLinks: { display: "flex", gap: "16px" },
  contactLink: { fontSize: "12px", color: "#367C2B" },
  progressTrack: { height: "5px", backgroundColor: "#F0F0ED", borderRadius: "3px", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#367C2B", borderRadius: "3px" },
  progressNote: { fontSize: "12px", color: "#ABABAB" },
  timeline: { display: "flex", flexDirection: "column" },
  timelineItem: { display: "flex", gap: "10px", paddingBottom: "12px" },
  timelineDotWrap: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  timelineDot: { width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#367C2B", marginTop: "4px" },
  timelineLine: { flex: 1, width: "1px", backgroundColor: "#E8E8E6", marginTop: "4px" },
  timelineContent: { flex: 1 },
  timelineHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" },
  actType: { fontSize: "13px", fontWeight: 600, color: "#1A1A1A" },
  actDate: { fontSize: "11px", color: "#ABABAB" },
  actOutcome: { fontSize: "12px", color: "#374151" },
  actNotes: { fontSize: "12px", color: "#767676" },
  emptySmall: { fontSize: "13px", color: "#ABABAB" },
  sprintDateRow: { display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" },
  sprintDateField: { display: "flex", flexDirection: "column", gap: "4px" },
  sprintDateLabel: { fontSize: "11px", fontWeight: 600, color: "#374151" },
  sprintDateInput: { width: "150px" },
  sprintSaveWrap: { display: "flex", alignItems: "center", gap: "10px" },
  saveDatesBtn: { padding: "7px 14px", backgroundColor: "#367C2B", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  savedMsg: { fontSize: "12px", color: "#16A34A", fontWeight: 500 },
  unassignLink: { background: "none", border: "none", fontSize: "12px", color: "#DC2626", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif", padding: 0 },
};
