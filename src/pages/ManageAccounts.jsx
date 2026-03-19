import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";
import * as XLSX from "xlsx";

export default function ManageAccounts() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [activeTab, setActiveTab] = useState("import");
  const [loading, setLoading] = useState(true);

  // Tab 1 — Import
  const [dragOver, setDragOver] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [importStep, setImportStep] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);

  // Tab 2 — Add manually
  const [manualForm, setManualForm] = useState({
    company: "", address: "", contact_name: "", phone: "", email: "", rep_id: "",
  });
  const [savingManual, setSavingManual] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  // Tab 3 — Assign
  const [selectedRep, setSelectedRep] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [repAccounts, setRepAccounts] = useState([]);
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  const PROTO_FIELDS = [
    "Company name", "Physical address", "Contact name",
    "Contact phone", "Contact email", "Assigned rep",
  ];

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
      .from("accounts").select("id, name, company, rep_id");
    setAllAccounts(accountsData || []);

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ── TAB 1: Import ──
  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files[0] || e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

      setImportRows(rows);
      // Auto-map columns
      const autoMap = {};
      PROTO_FIELDS.forEach(field => {
        const match = headers.find(h =>
          h.toLowerCase().includes(field.toLowerCase().split(" ")[0])
        );
        autoMap[field] = match || "";
      });
      setColumnMap(autoMap);
      setImportStep(2);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setImporting(true);
    let imported = 0;

    for (const row of importRows) {
      const companyName = row[columnMap["Company name"]] || "";
      const address = row[columnMap["Physical address"]] || "";
      const contactName = row[columnMap["Contact name"]] || "";
      const phone = row[columnMap["Contact phone"]] || "";
      const email = row[columnMap["Contact email"]] || "";
      const assignedRepName = row[columnMap["Assigned rep"]] || "";

      const matchedRep = reps.find(r =>
        r.full_name?.toLowerCase() === assignedRepName.toLowerCase()
      );

      const { data: newAccount } = await supabase
        .from("accounts")
        .insert({
          name: companyName,
          company: companyName,
          address,
          rep_id: matchedRep?.id || null,
          status: "New",
          start_date: new Date().toISOString().split("T")[0],
          end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        })
        .select().single();

      if (newAccount && contactName) {
        const parts = contactName.split(" ");
        await supabase.from("contacts").insert({
          account_id: newAccount.id,
          first_name: parts[0] || "",
          last_name: parts.slice(1).join(" ") || "",
          phone,
          email,
          is_primary: true,
        });
      }
      imported++;
    }

    setImportSuccess(imported);
    setImporting(false);
    setImportStep(1);
    setImportFile(null);
    setImportRows([]);
  };

  // ── TAB 2: Manual ──
  const handleManualSave = async () => {
    setSavingManual(true);
    const { data: newAccount } = await supabase
      .from("accounts")
      .insert({
        name: manualForm.company,
        company: manualForm.company,
        address: manualForm.address,
        rep_id: manualForm.rep_id || null,
        status: "New",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      })
      .select().single();

    if (newAccount && manualForm.contact_name) {
      const parts = manualForm.contact_name.split(" ");
      await supabase.from("contacts").insert({
        account_id: newAccount.id,
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" ") || "",
        phone: manualForm.phone,
        email: manualForm.email,
        is_primary: true,
      });
    }

    setManualForm({ company: "", address: "", contact_name: "", phone: "", email: "", rep_id: "" });
    setSavingManual(false);
    setManualSuccess(true);
    setTimeout(() => setManualSuccess(false), 3000);
    loadData();
  };

  // ── TAB 3: Assign ──
  const selectRep = async (rep) => {
    setSelectedRep(rep);
    setAssignSuccess(false);

    const assigned = allAccounts.filter(a => a.rep_id === rep.id).map(a => a.id);
    setRepAccounts(assigned);

    const today = new Date().toISOString().split("T")[0];
    const { data: sprintData } = await supabase
      .from("sprints").select("*").eq("rep_id", rep.id)
      .lte("start_date", today).gte("end_date", today).single();

    if (sprintData) {
      setSprintStart(sprintData.start_date);
      setSprintEnd(sprintData.end_date);
    } else {
      const sixtyDaysOut = new Date();
      sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
      const endDate = sixtyDaysOut.toISOString().split("T")[0];
      setSprintStart(today);
      setSprintEnd(endDate);
    }
  };

  const toggleAccountAssign = (accountId) => {
    setRepAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const saveAssignments = async () => {
    if (!selectedRep) return;
    setSavingAssign(true);

    // Remove rep from all their current accounts
    await supabase.from("accounts")
      .update({ rep_id: null })
      .eq("rep_id", selectedRep.id);

    // Assign selected accounts
    for (const accountId of repAccounts) {
      await supabase.from("accounts")
        .update({ rep_id: selectedRep.id })
        .eq("id", accountId);
    }

    // Upsert sprint
    if (sprintStart && sprintEnd) {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("sprints").select("id").eq("rep_id", selectedRep.id)
        .lte("start_date", today).gte("end_date", today).single();

      if (existing) {
        await supabase.from("sprints")
          .update({ start_date: sprintStart, end_date: sprintEnd })
          .eq("id", existing.id);
      } else {
        await supabase.from("sprints").insert({
          rep_id: selectedRep.id,
          start_date: sprintStart,
          end_date: sprintEnd,
        });
      }
    }

    setSavingAssign(false);
    setAssignSuccess(true);
    loadData();
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

        .tab-btn {
          padding: 10px 20px; font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          border: none; background: none; color: #767676;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .tab-btn:hover { color: #367C2B; }
        .tab-btn.active { color: #367C2B; border-bottom-color: #367C2B; font-weight: 600; }

        .field-input {
          width: 100%; padding: 10px 12px; font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          transition: border-color 0.15s;
          appearance: none; -webkit-appearance: none;
        }
        .field-input:focus { border-color: #367C2B; }

        .btn-primary {
          padding: 11px 20px; background: #367C2B; color: #fff;
          border: none; border-radius: 6px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: background 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: #2d6b24; }
        .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .drop-zone {
          border: 2px dashed #E0E0DC; border-radius: 8px;
          padding: 48px 24px; text-align: center;
          cursor: pointer; transition: all 0.15s;
          background: #fff;
        }
        .drop-zone.drag-over {
          border-color: #367C2B; background: #F0FDF4;
        }
        .drop-zone:hover { border-color: #ABABAB; }

        .rep-select-row {
          padding: 10px 14px; border-radius: 6px;
          cursor: pointer; transition: background 0.15s;
          font-size: 14px; color: #374151;
          border: 1px solid transparent;
        }
        .rep-select-row:hover { background: #F5F5F3; }
        .rep-select-row.selected {
          background: #F0FDF4; color: #367C2B;
          border-color: #BBF7D0; font-weight: 600;
        }

        .account-check-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 0; border-bottom: 1px solid #F0F0ED;
          font-size: 13px; color: #374151; cursor: pointer;
        }
        .account-check-row:last-child { border-bottom: none; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 70px !important; overflow-x: hidden; }
        }
      `}</style>

      <div style={styles.layout}>

        <MobileManagerHeader activePath="/manage" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/manage" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>

          <TopBar title="Manage Accounts" profile={profile} onSignOut={handleSignOut} />

          {/* TABS */}
          <div style={styles.tabBar}>
            {[
              ["import", "Import from Excel"],
              ["manual", "Add Manually"],
              ["assign", "Assign to Reps"],
            ].map(([key, label]) => (
              <button key={key}
                className={`tab-btn${activeTab === key ? " active" : ""}`}
                onClick={() => setActiveTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── TAB 1: IMPORT ── */}
          {activeTab === "import" && (
            <div style={styles.card}>
              {importSuccess && (
                <div style={styles.successBanner}>
                  {importSuccess} accounts imported successfully
                </div>
              )}

              {importStep === 1 && (
                <>
                  <div
                    className={`drop-zone${dragOver ? " drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById("file-input").click()}
                  >
                    <p style={styles.dropIcon}>📂</p>
                    <p style={styles.dropTitle}>Drag and drop your file here</p>
                    <p style={styles.dropSub}>or click to browse · .xlsx and .csv · max 500 rows</p>
                  </div>
                  <input
                    id="file-input" type="file"
                    accept=".csv,.xlsx"
                    style={{ display: "none" }}
                    onChange={(e) => processFile(e.target.files[0])}
                  />
                </>
              )}

              {importStep === 2 && (
                <>
                  <div style={styles.successBanner}>
                    {importRows.length} accounts ready · Mapping columns from {importFile?.name}
                  </div>

                  <p style={styles.sectionLabel}>Match Your Columns</p>

                  <div style={styles.mapTable}>
                    <div style={styles.mapHeader}>
                      <span>Pro-Tracker Field</span>
                      <span>Your Excel Column</span>
                    </div>
                    {PROTO_FIELDS.map(field => (
                      <div key={field} style={styles.mapRow}>
                        <span style={styles.mapField}>{field}</span>
                        <select
                          className="field-input"
                          style={{ width: "auto", flex: 1 }}
                          value={columnMap[field] || ""}
                          onChange={e => setColumnMap(prev => ({ ...prev, [field]: e.target.value }))}
                        >
                          <option value="">— skip —</option>
                          {importRows.length > 0 && Object.keys(importRows[0]).map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div style={styles.importActions}>
                    <button className="btn-primary"
                      disabled={importing}
                      onClick={handleImport}>
                      {importing ? "Importing…" : `Import ${importRows.length} Accounts`}
                    </button>
                    <button
                      style={styles.cancelLink}
                      onClick={() => { setImportStep(1); setImportFile(null); setImportRows([]); }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB 2: MANUAL ── */}
          {activeTab === "manual" && (
            <div style={styles.card}>
              {manualSuccess && (
                <div style={styles.successBanner}>Account added successfully</div>
              )}

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Company Name</label>
                  <input className="field-input" value={manualForm.company}
                    onChange={e => setManualForm(p => ({ ...p, company: e.target.value }))}
                    placeholder="Acme Farm Supply" />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Physical Address</label>
                  <input className="field-input" value={manualForm.address}
                    onChange={e => setManualForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="123 Main St, City, State" />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Contact Name</label>
                  <input className="field-input" value={manualForm.contact_name}
                    onChange={e => setManualForm(p => ({ ...p, contact_name: e.target.value }))}
                    placeholder="John Smith" />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Phone</label>
                  <input className="field-input" type="tel" value={manualForm.phone}
                    onChange={e => setManualForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="555-555-5555" />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Email</label>
                  <input className="field-input" type="email" value={manualForm.email}
                    onChange={e => setManualForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="john@example.com" />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Assign to Rep</label>
                  <select className="field-input" value={manualForm.rep_id}
                    onChange={e => setManualForm(p => ({ ...p, rep_id: e.target.value }))}>
                    <option value="">— Unassigned —</option>
                    {reps.map(rep => (
                      <option key={rep.id} value={rep.id}>{rep.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button className="btn-primary"
                disabled={savingManual || !manualForm.company}
                onClick={handleManualSave}>
                {savingManual ? "Saving…" : "Add Account"}
              </button>
            </div>
          )}

          {/* ── TAB 3: ASSIGN ── */}
          {activeTab === "assign" && (
            <div style={styles.assignLayout}>

              {/* Rep list */}
              <div style={styles.repList}>
                <p style={styles.sectionLabel}>Select a Rep</p>
                {reps.map(rep => (
                  <div key={rep.id}
                    className={`rep-select-row${selectedRep?.id === rep.id ? " selected" : ""}`}
                    onClick={() => selectRep(rep)}>
                    {rep.full_name}
                  </div>
                ))}
              </div>

              {/* Account assignments */}
              <div style={styles.assignRight}>
                {!selectedRep ? (
                  <p style={styles.emptyText}>Select a rep to manage their assignments</p>
                ) : (
                  <>
                    <div style={styles.assignHeader}>
                      <p style={styles.sectionLabel}>{selectedRep.full_name}'s Accounts</p>
                      <span style={styles.counterBadge}>
                        {repAccounts.length}/10 assigned
                      </span>
                    </div>

                    {assignSuccess && (
                      <div style={styles.successBanner}>Assignments saved successfully</div>
                    )}

                    {/* Sprint dates */}
                    <div style={styles.sprintRow}>
                      <div style={styles.field}>
                        <label style={styles.fieldLabel}>Sprint Start</label>
                        <input className="field-input" type="date"
                          value={sprintStart}
                          onChange={e => setSprintStart(e.target.value)} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.fieldLabel}>Sprint End</label>
                        <input className="field-input" type="date"
                          value={sprintEnd}
                          onChange={e => setSprintEnd(e.target.value)} />
                      </div>
                    </div>

                    {/* Account checklist */}
                    <div style={styles.accountChecklist}>
                      {allAccounts.length === 0 ? (
                        <p style={styles.emptyText}>No accounts in system yet</p>
                      ) : (
                        allAccounts.map(account => (
                          <label key={account.id} className="account-check-row">
                            <input type="checkbox"
                              checked={repAccounts.includes(account.id)}
                              onChange={() => toggleAccountAssign(account.id)} />
                            <span>{account.name || account.company}</span>
                          </label>
                        ))
                      )}
                    </div>

                    <button className="btn-primary"
                      disabled={savingAssign}
                      onClick={saveAssignments}>
                      {savingAssign ? "Saving…" : "Save Assignments"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

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
  main: {
    marginLeft: "220px", flex: 1,
    padding: "28px 32px",
    display: "flex", flexDirection: "column", gap: "20px",
    minHeight: "100vh",
  },
  pageTitle: { fontSize: "22px", fontWeight: 600, color: "#1A1A1A" },

  // Tabs
  tabBar: {
    display: "flex", borderBottom: "1px solid #E8E8E6",
    backgroundColor: "#ffffff", borderRadius: "8px 8px 0 0",
    padding: "0 4px",
  },

  // Card
  card: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "0 0 8px 8px",
    padding: "24px",
    display: "flex", flexDirection: "column", gap: "20px",
  },

  // Drop zone
  dropIcon: { fontSize: "32px", marginBottom: "8px" },
  dropTitle: { fontSize: "15px", fontWeight: 600, color: "#1A1A1A", marginBottom: "4px" },
  dropSub: { fontSize: "13px", color: "#767676" },

  // Success banner
  successBanner: {
    backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0",
    borderRadius: "6px", padding: "10px 14px",
    fontSize: "13px", color: "#16A34A", fontWeight: 500,
  },

  // Column mapping
  sectionLabel: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  mapTable: { display: "flex", flexDirection: "column", gap: "0", border: "1px solid #E8E8E6", borderRadius: "6px", overflow: "hidden" },
  mapHeader: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "12px", padding: "10px 14px",
    backgroundColor: "#F9F9F8",
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: "1px solid #E8E8E6",
  },
  mapRow: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "12px", padding: "10px 14px", alignItems: "center",
    borderBottom: "1px solid #F0F0ED",
  },
  mapField: { fontSize: "13px", fontWeight: 500, color: "#374151" },
  importActions: { display: "flex", alignItems: "center", gap: "16px" },
  cancelLink: {
    background: "none", border: "none", padding: 0,
    fontSize: "13px", color: "#767676", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", textDecoration: "underline",
  },

  // Manual form
  formGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#374151" },

  // Assign layout
  assignLayout: {
    display: "grid", gridTemplateColumns: "220px 1fr",
    gap: "0",
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
    borderRadius: "0 0 8px 8px", overflow: "hidden",
    minHeight: "500px",
  },
  repList: {
    borderRight: "1px solid #E8E8E6",
    padding: "20px 12px",
    display: "flex", flexDirection: "column", gap: "4px",
  },
  assignRight: {
    padding: "20px 24px",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  assignHeader: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
  },
  counterBadge: {
    fontSize: "12px", fontWeight: 600,
    backgroundColor: "#F0FDF4", color: "#367C2B",
    border: "1px solid #BBF7D0",
    padding: "4px 10px", borderRadius: "100px",
  },
  sprintRow: { display: "flex", gap: "16px" },
  accountChecklist: {
    border: "1px solid #E8E8E6", borderRadius: "6px",
    padding: "4px 14px", maxHeight: "320px", overflowY: "auto",
  },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "20px 0" },
};
