import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";

export default function ExportReports() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null

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

  const INCLUDE_LABELS = {
    activity_log: "Activity Log",
    account_status: "Account Status",
    contact_details: "Contact Details",
    scheduled_activities: "Scheduled Activities",
    sprint_progress: "Sprint Progress",
    at_risk: "At-Risk Accounts",
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
    setSelectedReps((repsData || []).map(r => r.id));
    setLoading(false);
  };

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

  const getDateRange = () => {
    const today = new Date();
    if (exportRange === "7days") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { start: start.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
    }
    if (exportRange === "30days") {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { start: start.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
    }
    if (exportRange === "custom") {
      return { start: customStart, end: customEnd };
    }
    return null; // sprint = no date filter
  };

  const fetchExportData = async () => {
    const dateRange = getDateRange();
    const today = new Date().toISOString().split("T")[0];

    // Query 1: accounts for selected reps
    const { data: allAccounts } = await supabase
      .from("accounts").select("*").in("rep_id", selectedReps);

    const accountIds = (allAccounts || []).map(a => a.id);

    // Queries 2-4 in parallel using account ids and rep ids
    let actsQuery = supabase.from("activities").select("*")
      .in("account_id", accountIds).order("activity_date", { ascending: false });
    if (dateRange?.start) actsQuery = actsQuery.gte("activity_date", dateRange.start);
    if (dateRange?.end) actsQuery = actsQuery.lte("activity_date", dateRange.end);

    const [
      { data: allActivities },
      { data: allContacts },
      { data: allSprints },
    ] = await Promise.all([
      actsQuery,
      supabase.from("contacts").select("*").in("account_id", accountIds),
      supabase.from("sprints").select("*").in("rep_id", selectedReps)
        .lte("start_date", today).gte("end_date", today),
    ]);

    // Index by id for fast lookup
    const sprintByRep = {};
    (allSprints || []).forEach(s => { sprintByRep[s.rep_id] = s; });

    const actsByAccount = {};
    const actsByRep = {};
    (allActivities || []).forEach(a => {
      if (!actsByAccount[a.account_id]) actsByAccount[a.account_id] = [];
      actsByAccount[a.account_id].push(a);
      if (!actsByRep[a.rep_id]) actsByRep[a.rep_id] = [];
      actsByRep[a.rep_id].push(a);
    });

    const contactsByAccount = {};
    (allContacts || []).forEach(c => {
      if (!contactsByAccount[c.account_id]) contactsByAccount[c.account_id] = [];
      contactsByAccount[c.account_id].push(c);
    });

    const results = [];
    for (const account of (allAccounts || [])) {
      const rep = reps.find(r => r.id === account.rep_id);
      if (!rep) continue;

      const activities = actsByAccount[account.id] || [];
      const contacts = contactsByAccount[account.id] || [];
      const sprint = sprintByRep[account.rep_id] || null;

      const daysLeft = sprint
        ? Math.max(0, Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
        : null;

      const repIsNew = (new Date() - new Date(rep.created_at)) < 48 * 60 * 60 * 1000;
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recentActs = (actsByRep[rep.id] || []).filter(a =>
        new Date(a.activity_date) >= fortyEightHoursAgo
      );
      const repAccounts = (allAccounts || []).filter(a => a.rep_id === rep.id);
      const atRisk = !repIsNew && recentActs.length === 0 && repAccounts.length > 0;

      const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
      const lastAct = activities[0];
      const nextAct = activities.find(a => a.scheduled_next_date);

      results.push({
        rep: rep.full_name,
        account: account.name || account.company,
        address: account.address || "",
        status: account.status || "New",
        contactName: primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : "",
        contactPhone: primaryContact?.phone || "",
        contactEmail: primaryContact?.email || "",
        lastActivity: lastAct ? `${lastAct.activity_type} on ${lastAct.activity_date}` : "None",
        lastNotes: lastAct?.notes || "",
        activityCount: activities.length,
        nextScheduled: nextAct ? `${nextAct.scheduled_next_type} on ${nextAct.scheduled_next_date}` : "None",
        sprintDaysLeft: daysLeft !== null ? `${daysLeft} days` : "No sprint",
        atRisk: atRisk ? "At Risk" : "On Track",
      });
    }

    results.sort((a, b) => {
      const repCompare = a.rep.toLowerCase().localeCompare(b.rep.toLowerCase());
      if (repCompare !== 0) return repCompare;
      return a.account.toLowerCase().localeCompare(b.account.toLowerCase());
    });

    return results;
  };

  const exportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const data = await fetchExportData();

      const headers = [];
      if (includeOptions.account_status) headers.push("Rep", "Account", "Address", "Status");
      if (includeOptions.contact_details) headers.push("Contact Name", "Phone", "Email");
      if (includeOptions.activity_log) headers.push("Last Activity", "Notes", "Total Activities");
      if (includeOptions.scheduled_activities) headers.push("Next Scheduled");
      if (includeOptions.sprint_progress) headers.push("Days Left in Sprint");
      if (includeOptions.at_risk) headers.push("Risk Status");

      const rows = data.map(row => {
        const r = [];
        if (includeOptions.account_status) r.push(row.rep, row.account, row.address, row.status);
        if (includeOptions.contact_details) r.push(row.contactName, row.contactPhone, row.contactEmail);
        if (includeOptions.activity_log) r.push(row.lastActivity, row.lastNotes, row.activityCount);
        if (includeOptions.scheduled_activities) r.push(row.nextScheduled);
        if (includeOptions.sprint_progress) r.push(row.sprintDaysLeft);
        if (includeOptions.at_risk) r.push(row.atRisk);
        return r;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pro-Tracker Report");

      // Style header row
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        if (cell) cell.s = { font: { bold: true } };
      }

      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `ProTracker-Report-${date}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
    }
    setExporting(null);
  };

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const data = await fetchExportData();
      const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      // Group rows by rep
      const repGroups = [];
      for (const row of data) {
        const last = repGroups[repGroups.length - 1];
        if (last && last.rep === row.rep) {
          last.rows.push(row);
        } else {
          repGroups.push({ rep: row.rep, rows: [row] });
        }
      }

      const tableHeaders = `
        <tr>
          ${includeOptions.account_status ? "<th>Account</th><th>Status</th>" : ""}
          ${includeOptions.contact_details ? "<th>Contact</th><th>Phone</th>" : ""}
          ${includeOptions.activity_log ? "<th>Last Activity</th><th>Logs</th>" : ""}
          ${includeOptions.scheduled_activities ? "<th>Next Scheduled</th>" : ""}
          ${includeOptions.sprint_progress ? "<th>Days Left</th>" : ""}
          ${includeOptions.at_risk ? "<th>Status</th>" : ""}
        </tr>`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Pro-Tracker Report</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1A1A1A; padding: 32px; }
            h2 { font-size: 18px; color: #367C2B; margin-bottom: 4px; }
            .acct-count { font-size: 12px; color: #767676; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
            th { background: #367C2B; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
            td { padding: 7px 10px; border-bottom: 1px solid #E8E8E6; vertical-align: top; }
            tr:nth-child(even) { background: #F9F9F8; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: bold; }
            .at-risk { background: #FEF2F2; color: #DC2626; }
            .on-track { background: #F0FDF4; color: #16A34A; }
            .accent { height: 3px; background: #FFDE00; margin-bottom: 16px; border-radius: 2px; width: 120px; }
            .rep-section { page-break-after: always; }
            .rep-section:last-child { page-break-after: avoid; }
            .page-header { margin-bottom: 8px; }
            .page-header-logo { font-size: 16px; font-weight: bold; color: #367C2B; margin-bottom: 6px; }
            .accent-line { height: 3px; background: #FFDE00; border-radius: 2px; width: 120px; margin-bottom: 8px; }
            .header-meta { font-size: 11px; color: #767676; display: flex; gap: 6px; align-items: center; margin-bottom: 16px; }
            .header-divider { color: #D0D0CC; }
            .page-header-rule { border: none; border-top: 1px solid #E8E8E6; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          ${repGroups.map(group => `
            <div class="rep-section">
              <div class="page-header">
                <div class="page-header-logo">PRO-TRACKER</div>
                <div class="accent-line"></div>
                <div class="header-meta">
                  <span class="report-title">Pro-Tracker Report</span>
                  <span class="header-divider">·</span>
                  <span>United Ag &amp; Turf</span>
                  <span class="header-divider">·</span>
                  <span>Generated ${date}</span>
                </div>
              </div>
              <hr class="page-header-rule">
              <h2>${group.rep}</h2>
              <div class="accent"></div>
              <p class="acct-count">${group.rows.length} account${group.rows.length !== 1 ? "s" : ""}</p>
              <table>
                <thead>${tableHeaders}</thead>
                <tbody>
                  ${group.rows.map(row => `
                    <tr>
                      ${includeOptions.account_status ? `<td>${row.account}</td><td>${row.status}</td>` : ""}
                      ${includeOptions.contact_details ? `<td>${row.contactName}</td><td>${row.contactPhone}</td>` : ""}
                      ${includeOptions.activity_log ? `<td>${row.lastActivity}</td><td>${row.activityCount}</td>` : ""}
                      ${includeOptions.scheduled_activities ? `<td>${row.nextScheduled}</td>` : ""}
                      ${includeOptions.sprint_progress ? `<td>${row.sprintDaysLeft}</td>` : ""}
                      ${includeOptions.at_risk ? `<td><span class="badge ${row.atRisk === 'At Risk' ? 'at-risk' : 'on-track'}">${row.atRisk}</span></td>` : ""}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `).join("")}
        </body>
        </html>
      `;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      console.error("PDF export error:", err);
    }
    setExporting(null);
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

        .range-pill {
          padding: 8px 18px; border-radius: 100px;
          font-size: 13px; font-weight: 500;
          border: 1.5px solid #E0E0DC; background: #fff;
          color: #767676; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; white-space: nowrap;
        }
        .range-pill.active {
          background: #367C2B; border-color: #367C2B; color: #fff; font-weight: 600;
        }
        .range-pill:hover:not(.active) { border-color: #367C2B; color: #367C2B; }

        .field-input {
          padding: 9px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
        }
        .field-input:focus { border-color: #367C2B; }

        .check-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 0; border-bottom: 1px solid #F0F0ED;
          cursor: pointer; font-size: 14px; color: #374151;
        }
        .check-row:last-child { border-bottom: none; }
        .check-row input { accent-color: #367C2B; width: 16px; height: 16px; }

        .export-btn {
          flex: 1; padding: 13px 20px;
          border-radius: 6px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .export-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 70px !important; overflow-x: hidden; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/export" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/export" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <TopBar title="Export Reports" profile={profile} onSignOut={handleSignOut} />

          <div style={styles.exportCard}>

            {/* Date range */}
            <div style={styles.section}>
              <p style={styles.sectionLabel}>Date Range</p>
              <div style={styles.pillRow}>
                {[
                  ["sprint", "This Sprint"],
                  ["7days", "Last 7 Days"],
                  ["30days", "Last 30 Days"],
                  ["custom", "Custom Range"],
                ].map(([key, label]) => (
                  <button key={key}
                    className={`range-pill${exportRange === key ? " active" : ""}`}
                    onClick={() => setExportRange(key)}>
                    {label}
                  </button>
                ))}
              </div>

              {exportRange === "custom" && (
                <div style={styles.dateRow}>
                  <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>Start Date</label>
                    <input className="field-input" type="date"
                      value={customStart} onChange={e => setCustomStart(e.target.value)} />
                  </div>
                  <span style={styles.dateSep}>to</span>
                  <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>End Date</label>
                    <input className="field-input" type="date"
                      value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div style={styles.divider} />

            {/* Columns layout */}
            <div style={styles.columns}>

              {/* Rep selector */}
              <div style={styles.col}>
                <div style={styles.colHeader}>
                  <p style={styles.sectionLabel}>Sales Reps</p>
                  <div style={styles.selectLinks}>
                    <button style={styles.textLink}
                      onClick={() => setSelectedReps(reps.map(r => r.id))}>
                      All
                    </button>
                    <span style={styles.textLinkDivider}>·</span>
                    <button style={styles.textLink}
                      onClick={() => setSelectedReps([])}>
                      None
                    </button>
                  </div>
                </div>
                <div style={styles.checkList}>
                  {reps.map(rep => (
                    <label key={rep.id} className="check-row">
                      <input type="checkbox"
                        checked={selectedReps.includes(rep.id)}
                        onChange={() => toggleRep(rep.id)} />
                      {rep.full_name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Include options */}
              <div style={styles.col}>
                <p style={styles.sectionLabel}>Include in Report</p>
                <div style={styles.checkList}>
                  {Object.entries(INCLUDE_LABELS).map(([key, label]) => (
                    <label key={key} className="check-row">
                      <input type="checkbox"
                        checked={includeOptions[key]}
                        onChange={() => toggleInclude(key)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

            </div>

            <div style={styles.divider} />

            {/* Summary */}
            <div style={styles.summary}>
              <p style={styles.summaryText}>
                Exporting <strong>{selectedReps.length} rep{selectedReps.length !== 1 ? "s" : ""}</strong> ·{" "}
                <strong>{Object.values(includeOptions).filter(Boolean).length} sections</strong> ·{" "}
                <strong>
                  {exportRange === "sprint" && "This Sprint"}
                  {exportRange === "7days" && "Last 7 Days"}
                  {exportRange === "30days" && "Last 30 Days"}
                  {exportRange === "custom" && (customStart && customEnd ? `${customStart} to ${customEnd}` : "Custom range")}
                </strong>
              </p>
            </div>

            {/* Export buttons */}
            <div style={styles.btnRow}>
              <button
                className="export-btn"
                disabled={!!exporting || selectedReps.length === 0}
                onClick={exportExcel}
                style={{
                  background: "#367C2B", color: "#fff", border: "none",
                }}
              >
                {exporting === "excel" ? "Generating…" : "Export as Excel (.xlsx)"}
              </button>
              <button
                className="export-btn"
                disabled={!!exporting || selectedReps.length === 0}
                onClick={exportPDF}
                style={{
                  background: "#fff", color: "#374151",
                  border: "1.5px solid #E0E0DC",
                }}
              >
                {exporting === "pdf" ? "Generating…" : "Export as PDF (.pdf)"}
              </button>
            </div>

          </div>
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
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },
  exportCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", padding: "28px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" },
  section: { display: "flex", flexDirection: "column", gap: "14px" },
  sectionLabel: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.08em" },
  pillRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  dateRow: { display: "flex", gap: "16px", alignItems: "flex-end" },
  dateField: { display: "flex", flexDirection: "column", gap: "6px" },
  dateSep: { fontSize: "13px", color: "#767676", paddingBottom: "10px" },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#374151" },
  divider: { height: "1px", backgroundColor: "#F0F0ED" },
  columns: { display: "flex", gap: "48px" },
  col: { flex: 1, display: "flex", flexDirection: "column", gap: "12px" },
  colHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  selectLinks: { display: "flex", gap: "6px", alignItems: "center" },
  textLink: { background: "none", border: "none", padding: 0, fontSize: "12px", color: "#367C2B", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textDecoration: "underline" },
  textLinkDivider: { fontSize: "12px", color: "#ABABAB" },
  checkList: { display: "flex", flexDirection: "column" },
  summary: { backgroundColor: "#F9F9F8", borderRadius: "6px", padding: "12px 14px" },
  summaryText: { fontSize: "13px", color: "#374151" },
  btnRow: { display: "flex", gap: "12px" },
};
