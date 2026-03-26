import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";
import MobileManagerHeader from "../components/MobileManagerHeader";
import RepBottomNav from "../components/RepBottomNav";
import ManagerBottomNav from "../components/ManagerBottomNav";
import RepTopBar from "../components/RepTopBar";
import TopBar from "../components/TopBar";
import PullToRefresh from "../components/PullToRefresh";

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) { navigate(-1); } else { navigate("/leads"); }
  };

  const [profile, setProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [sendingToCRM, setSendingToCRM] = useState(false);
  const [crmSuccess, setCrmSuccess] = useState(false);

  // Notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  // Edit company info
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", address: "" });

  // Add / edit contact
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactForm, setContactForm] = useState({
    first_name: "", last_name: "", title: "", phone: "", email: "", is_primary: false,
  });

  const STATUSES = ["New", "Contacted", "Engaged", "Proposal", "Won", "Lost"];

  const STATUS_COLORS = {
    New:       { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    Contacted: { bg: "#FEFCE8", color: "#CA8A04", border: "#FDE68A" },
    Engaged:   { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
    Proposal:  { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
    Won:       { bg: "#367C2B", color: "#FFFFFF", border: "#367C2B" },
    Lost:      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  };

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);

    // Account
    const { data: acc } = await supabase
      .from("target_leads")
      .select("*, start_date, end_date")
      .eq("id", id)
      .single();
    setAccount(acc);
    setNotesValue(acc?.notes || "");
    setCompanyForm({ name: acc?.name || "", address: acc?.address || "" });

    // Contacts
    const { data: cons } = await supabase
      .from("target_lead_contacts")
      .select("*")
      .eq("account_id", id)
      .order("is_primary", { ascending: false });
    setContacts(cons || []);

    // Activities
    const { data: acts } = await supabase
      .from("target_lead_activities")
      .select("*")
      .eq("account_id", id)
      .order("activity_date", { ascending: false });
    setActivities(acts || []);

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ── Send to CRM ──
  const sendToCRM = async () => {
    if (profile?.role !== "manager") return;
    setSendingToCRM(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      console.log("sendToCRM - currentUser.id:", currentUser?.id);
      console.log("sendToCRM - profile.role:", profile?.role);

      const { data: { session } } = await supabase.auth.getSession();
      console.log("sendToCRM - session user id:", session?.user?.id);
      console.log("sendToCRM - session email:", session?.user?.email);

      const insertUserId = session?.user?.id;
      console.log("sendToCRM - insertUserId:", insertUserId);

      // Step 1 - Get fresh contacts and activities
      const { data: freshContacts } = await supabase
        .from("target_lead_contacts").select("*").eq("account_id", id);

      const { data: freshActivities } = await supabase
        .from("target_lead_activities").select("*").eq("account_id", id);

      // Step 2 - Insert into CRM accounts with rep assignment
      const { data: crmAccount, error: accountError } = await supabase
        .from("accounts")
        .insert({
          company_name: account?.name || account?.company || "Unknown",
          address: account?.address || null,
          notes: account?.notes || null,
          user_id: insertUserId,
        })
        .select()
        .single();

      if (accountError) throw accountError;

      // Step 3 - Insert contacts into CRM contacts table
      if (freshContacts && freshContacts.length > 0) {
        for (const contact of freshContacts) {
          const { error: contactError } = await supabase
            .from("contacts")
            .insert({
              account_id: crmAccount.id,
              user_id: insertUserId,
              first_name: contact.first_name || "",
              last_name: contact.last_name || null,
              email: contact.email || null,
              phone: contact.phone || null,
              is_primary: contact.is_primary || false,
            });
          if (contactError) console.error("Contact insert error:", contactError);
        }

        // Update contact_name on account from primary contact
        const primary = freshContacts.find(c => c.is_primary) || freshContacts[0];
        const contactName = `${primary.first_name || ""} ${primary.last_name || ""}`.trim();
        if (contactName) {
          await supabase
            .from("accounts")
            .update({ contact_name: contactName })
            .eq("id", crmAccount.id);
        }
      }

      // Step 4 - Insert activities into CRM activities table
      if (freshActivities && freshActivities.length > 0) {
        for (const activity of freshActivities) {
          const { error: activityError } = await supabase
            .from("activities")
            .insert({
              account_id: crmAccount.id,
              user_id: insertUserId,
              activity_type: activity.activity_type || null,
              outcome: activity.outcome || null,
              notes: activity.notes || null,
              activity_date: activity.activity_date || null,
              scheduled_next_type: activity.scheduled_next_type || null,
              scheduled_next_date: activity.scheduled_next_date || null,
              scheduled_next_time: activity.scheduled_next_time || null,
              scheduled_next_notes: activity.scheduled_next_notes || null,
            });
          if (activityError) console.error("Activity insert error:", activityError);
        }
      }

      // Step 5 - Delete from Target10
      await supabase.from("target_lead_activities").delete().eq("account_id", id);
      await supabase.from("target_lead_contacts").delete().eq("account_id", id);
      const { error: deleteError } = await supabase
        .from("target_leads").delete().eq("id", id);

      if (deleteError) throw deleteError;

      setShowCrmModal(false);
      setCrmSuccess(true);

      setTimeout(() => {
        if (profile?.role === "manager") {
          navigate("/dashboard/accounts");
        } else {
          navigate("/leads");
        }
      }, 1500);

    } catch (err) {
      console.error("Send to CRM error:", err);
      alert("Failed to send to CRM: " + err.message);
    } finally {
      setSendingToCRM(false);
    }
  };

  // ── Status update ──
  const updateStatus = async (status) => {
    await supabase.from("target_leads").update({ status }).eq("id", id);
    setAccount(prev => ({ ...prev, status }));
  };

  // ── Save notes ──
  const saveNotes = async () => {
    await supabase.from("target_leads").update({ notes: notesValue }).eq("id", id);
    setAccount(prev => ({ ...prev, notes: notesValue }));
    setEditingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  // ── Save company info ──
  const saveCompany = async () => {
    await supabase.from("target_leads")
      .update({ name: companyForm.name, address: companyForm.address })
      .eq("id", id);
    setAccount(prev => ({ ...prev, name: companyForm.name, address: companyForm.address }));
    setEditingCompany(false);
  };

  // ── Contact helpers ──
  const openAddContact = () => {
    setContactForm({ first_name: "", last_name: "", title: "", phone: "", email: "", is_primary: false });
    setEditingContactId(null);
    setShowAddContact(true);
  };

  const openEditContact = (contact) => {
    setContactForm({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      email: contact.email || "",
      is_primary: contact.is_primary || false,
    });
    setEditingContactId(contact.id);
    setShowAddContact(true);
  };

  const saveContact = async () => {
    if (editingContactId) {
      await supabase.from("target_lead_contacts").update(contactForm).eq("id", editingContactId);
    } else {
      await supabase.from("target_lead_contacts").insert({ ...contactForm, account_id: id });
    }
    setShowAddContact(false);
    setEditingContactId(null);
    loadData();
  };

  // ── Sprint progress ──
  const sprintProgress = () => {
    if (!account?.start_date || !account?.end_date) return 0;
    const start = new Date(account.start_date);
    const end = new Date(account.end_date);
    const today = new Date();
    return Math.min(100, Math.max(0, Math.round(((today - start) / (end - start)) * 100)));
  };

  const daysLeft = () => {
    if (!account?.end_date) return null;
    const diff = Math.ceil((new Date(account.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // ── Scheduled next activity ──
  const nextActivity = activities.find(a => a.scheduled_next_date);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const formatActivityDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[account?.status] || STATUS_COLORS.New;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .green-link {
          background: none; border: none; padding: 0;
          color: #367C2B; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; text-decoration: underline;
        }
        .green-link:hover { color: #2d6b24; }

        .field-input {
          width: 100%; padding: 10px 12px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input:focus {
          border-color: #367C2B;
          box-shadow: 0 0 0 3px rgba(54,124,43,0.10);
        }

        .status-pill {
          padding: 6px 14px; border-radius: 100px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; border: 2px solid transparent;
          transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }

        .btn-primary {
          background: #367C2B; color: #fff;
          border: none; border-radius: 6px;
          padding: 12px; font-size: 15px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: background 0.15s;
          width: 100%;
        }
        .btn-primary:hover { background: #2d6b24; }

        .btn-secondary {
          background: #fff; color: #767676;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          padding: 11px; font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
          width: 100%;
        }
        .btn-secondary:hover { border-color: #ABABAB; color: #1A1A1A; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; }
          .desktop-header { display: none !important; }
          .detail-cards { gap: 8px !important; }
        }
      `}</style>

      <div style={styles.layout}>
        {profile?.role === "manager" ? (
          <>
            <MobileManagerHeader activePath="/dashboard/accounts" profile={profile} />
            <ManagerBottomNav activePath="/dashboard/accounts" />
            <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/accounts" />
          </>
        ) : (
          <>
            <MobileHeader activePath="/leads" profile={profile} />
            <RepBottomNav activePath="/leads" />
            <Sidebar role="rep" profile={profile} onSignOut={handleSignOut} activePath="/leads" />
          </>
        )}
        <div className="main-content" style={styles.page}>
          {profile?.role === "manager"
            ? <TopBar profile={profile} onSignOut={handleSignOut} />
            : <RepTopBar profile={profile} onSignOut={handleSignOut} />
          }
          <PullToRefresh onRefresh={loadData}>

        {/* ── HEADER ── */}
        <div className="desktop-header" style={styles.header}>
          <button onClick={handleBack} style={styles.backBtn}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              ...styles.statusBadgeSmall,
              background: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
            }}>
              {account?.status || "New"}
            </span>
            {profile?.role === "manager" && (
              <button
                onClick={() => setShowCrmModal(true)}
                style={{
                  background: "#fff", border: "1.5px solid #367C2B", color: "#367C2B",
                  borderRadius: "6px", padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                }}
              >
                Send to CRM as Account
              </button>
            )}
          </div>
        </div>

        {/* Account name */}
        <div style={styles.pageTitleWrap}>
          <h1 style={styles.pageTitle}>{account?.name || account?.company}</h1>
        </div>

        <div className="detail-cards" style={styles.content}>

          {/* ── COMPANY INFO CARD ── */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <p style={styles.cardLabel}>Company Info</p>
              {!editingCompany && (
                <button className="green-link" onClick={() => setEditingCompany(true)}>Edit</button>
              )}
            </div>

            {editingCompany ? (
              <div style={styles.formStack}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Company Name</label>
                  <input className="field-input" value={companyForm.name}
                    onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Address</label>
                  <input className="field-input" value={companyForm.address}
                    onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div style={styles.rowBtns}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveCompany}>Save</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingCompany(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={styles.infoStack}>
                <p style={styles.infoValue}>{account?.name || "—"}</p>
                {account?.address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(account.address)}`}
                    target="_blank" rel="noreferrer"
                    style={styles.addressLink}
                  >
                    {account.address}
                  </a>
                ) : (
                  <p style={styles.infoMuted}>No address added</p>
                )}
              </div>
            )}
          </div>

          {/* ── NOTES ── */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <p style={styles.cardLabel}>Notes</p>
              {!editingNotes && (
                <button className="green-link" onClick={() => setEditingNotes(true)}>Edit</button>
              )}
            </div>
            {editingNotes ? (
              <div style={styles.formStack}>
                <textarea
                  className="field-input"
                  rows={4}
                  style={{ resize: "vertical" }}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="Add notes about this lead..."
                />
                <div style={styles.rowBtns}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveNotes}>Save</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingNotes(false); setNotesValue(account?.notes || ""); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                {account?.notes
                  ? <p style={{ fontSize: "14px", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{account.notes}</p>
                  : <p style={styles.infoMuted}>Add notes about this lead...</p>
                }
                {notesSaved && <p style={{ fontSize: "12px", color: "#16A34A", marginTop: "6px" }}>Notes saved</p>}
              </div>
            )}
          </div>

          {/* ── CONTACTS ── */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <p style={styles.cardLabel}>Contacts</p>
              <button className="green-link" onClick={openAddContact}>+ Add contact</button>
            </div>

            {/* Add / Edit contact form */}
            {showAddContact && (
              <div style={styles.formStack}>
                <div style={styles.rowFields}>
                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>First name</label>
                    <input className="field-input" value={contactForm.first_name}
                      onChange={e => setContactForm(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>Last name</label>
                    <input className="field-input" value={contactForm.last_name}
                      onChange={e => setContactForm(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Title</label>
                  <input className="field-input" value={contactForm.title}
                    onChange={e => setContactForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Phone</label>
                  <input className="field-input" type="tel" value={contactForm.phone}
                    onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Email</label>
                  <input className="field-input" type="email" value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={contactForm.is_primary}
                    onChange={e => setContactForm(p => ({ ...p, is_primary: e.target.checked }))} />
                  <span style={{ fontSize: "13px", color: "#374151" }}>Primary contact</span>
                </label>
                <div style={styles.rowBtns}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveContact}>
                    {editingContactId ? "Save changes" : "Add contact"}
                  </button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddContact(false); setEditingContactId(null); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Contact list */}
            {contacts.length === 0 && !showAddContact && (
              <p style={styles.infoMuted}>No contacts added yet</p>
            )}
            {contacts.map(contact => (
              <div key={contact.id} style={styles.contactCard}>
                <div style={styles.contactTop}>
                  <div>
                    <p style={styles.contactName}>
                      {contact.first_name} {contact.last_name}
                      {contact.is_primary && (
                        <span style={styles.primaryBadge}>Primary</span>
                      )}
                    </p>
                    {contact.title && <p style={styles.contactTitle}>{contact.title}</p>}
                  </div>
                  <button className="green-link" onClick={() => openEditContact(contact)}>Edit</button>
                </div>
                <div style={styles.contactLinks}>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} style={styles.contactLink}>📞 {contact.phone}</a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={styles.contactLink}>✉️ {contact.email}</a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── STATUS SELECTOR ── */}
          <div style={styles.card}>
            <p style={styles.cardLabel}>Lead Status</p>
            <div style={styles.statusRow}>
              {STATUSES.map(s => {
                const sc = STATUS_COLORS[s];
                const isActive = account?.status === s;
                return (
                  <button
                    key={s}
                    className="status-pill"
                    onClick={() => updateStatus(s)}
                    style={{
                      background: sc.bg,
                      color: sc.color,
                      borderColor: isActive ? sc.color : "transparent",
                      outline: isActive ? `2px solid ${sc.color}` : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SCHEDULED NEXT ACTIVITY ── */}
          {nextActivity && (
            <div style={styles.scheduledCard}>
              <div style={styles.cardHeader}>
                <p style={styles.cardLabel}>Scheduled Next Activity</p>
              </div>
              <p style={styles.scheduledType}>{nextActivity.scheduled_next_type}</p>
              <p style={styles.scheduledDate}>
                {formatDate(nextActivity.scheduled_next_date)}
                {nextActivity.scheduled_next_time ? ` · ${nextActivity.scheduled_next_time}` : ""}
              </p>
              {nextActivity.scheduled_next_notes && (
                <p style={styles.scheduledNotes}>{nextActivity.scheduled_next_notes}</p>
              )}
              <p style={styles.outlookNote}>✓ Added to Outlook calendar</p>
            </div>
          )}

          {/* ── SPRINT PROGRESS ── */}
          {account?.end_date && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <p style={styles.cardLabel}>Target Progress</p>
                <span style={styles.daysLeftText}>{daysLeft()} days left</span>
              </div>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${sprintProgress()}%` }} />
              </div>
            </div>
          )}

          {/* ── ACTIVITY HISTORY ── */}
          <div style={styles.card}>
            <p style={styles.cardLabel}>Activity History</p>
            {activities.length === 0 ? (
              <p style={styles.infoMuted}>No activity logged yet</p>
            ) : (
              <div style={styles.timeline}>
                {activities.map((act, i) => (
                  <div key={act.id} style={styles.timelineItem}>
                    <div style={styles.timelineDotWrap}>
                      <div style={styles.timelineDot} />
                      {i < activities.length - 1 && <div style={styles.timelineLine} />}
                    </div>
                    <div style={styles.timelineContent}>
                      <div style={styles.timelineHeader}>
                        <span style={styles.activityType}>{act.activity_type}</span>
                        <span style={styles.activityDate}>{formatActivityDate(act.activity_date)}</span>
                      </div>
                      {act.outcome && <p style={styles.activityOutcome}>{act.outcome}</p>}
                      {act.notes && <p style={styles.activityNotes}>{act.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── LOG ACTIVITY BUTTON ── */}
          {profile?.role === "rep" && (
            <button
              className="btn-primary"
              style={{ marginBottom: "95px" }}
              onClick={() => navigate(`/leads/${id}/log`)}
            >
              + Log Activity
            </button>
          )}

        </div>
                  </PullToRefresh>
        </div>
      </div>

      {/* ── CRM Confirmation Modal ── */}
      {showCrmModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "24px", maxWidth: "420px", width: "90%", fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px", color: "#1A1A1A" }}>
              Send to CRM as Account?
            </div>
            <div style={{ fontSize: "13px", color: "#767676", marginBottom: "20px", lineHeight: 1.5 }}>
              This lead and all its activity will be moved to the CRM accounts and removed from Target10.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCrmModal(false)}
                style={{ background: "#fff", border: "1.5px solid #E0E0DC", color: "#767676", borderRadius: "6px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={sendToCRM}
                disabled={sendingToCRM}
                style={{ background: "#367C2B", border: "none", color: "#fff", borderRadius: "6px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                {sendingToCRM ? "Sending..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CRM Success Toast ── */}
      {crmSuccess && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "#367C2B", color: "#fff", padding: "12px 20px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, zIndex: 1000, fontFamily: "'DM Sans', sans-serif" }}>
          Successfully sent to CRM!
        </div>
      )}
    </>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#F5F5F3",
  },
  page: {
    marginLeft: "220px",
    flex: 1,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#F5F5F3",
    fontFamily: "'DM Sans', sans-serif",
    padding: "28px 32px 40px",
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

  // Header
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #E8E8E6",
    position: "sticky", top: 0, zIndex: 10,
  },
  backBtn: {
    background: "none", border: "none", padding: 0,
    fontSize: "14px", color: "#367C2B", fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  headerLogo: { height: "28px", objectFit: "contain" },
  statusBadgeSmall: {
    fontSize: "11px", fontWeight: 600,
    padding: "4px 10px", borderRadius: "100px",
  },

  pageTitleWrap: {
    padding: "16px 20px 8px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #E8E8E6",
  },
  pageTitle: {
    fontSize: "20px", fontWeight: 600, color: "#1A1A1A",
  },

  content: {
    padding: "16px 20px",
    display: "flex", flexDirection: "column", gap: "12px",
  },

  // Cards
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #E8E8E6",
    borderRadius: "8px",
    padding: "16px",
    display: "flex", flexDirection: "column", gap: "12px",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  cardLabel: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },

  // Company info
  infoStack: { display: "flex", flexDirection: "column", gap: "4px" },
  infoValue: { fontSize: "15px", fontWeight: 500, color: "#1A1A1A" },
  infoMuted: { fontSize: "13px", color: "#ABABAB" },
  addressLink: { fontSize: "13px", color: "#367C2B", fontWeight: 500 },

  // Form
  formStack: { display: "flex", flexDirection: "column", gap: "12px" },
  rowFields: { display: "flex", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", flex: 1 },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#374151" },
  rowBtns: { display: "flex", gap: "10px" },
  checkboxRow: {
    display: "flex", alignItems: "center", gap: "8px", cursor: "pointer",
  },

  // Contacts
  contactCard: {
    borderTop: "1px solid #F0F0ED",
    paddingTop: "12px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  contactTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  contactName: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", gap: "8px" },
  contactTitle: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  primaryBadge: {
    fontSize: "10px", fontWeight: 600, color: "#367C2B",
    background: "#F0FDF4", border: "1px solid #BBF7D0",
    borderRadius: "100px", padding: "2px 8px",
  },
  contactLinks: { display: "flex", flexDirection: "column", gap: "4px" },
  contactLink: { fontSize: "13px", color: "#367C2B", fontWeight: 500, textDecoration: "none" },

  // Status
  statusRow: { display: "flex", flexWrap: "wrap", gap: "8px" },

  // Scheduled
  scheduledCard: {
    backgroundColor: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: "8px",
    padding: "16px",
    display: "flex", flexDirection: "column", gap: "6px",
  },
  scheduledType: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  scheduledDate: { fontSize: "13px", color: "#767676" },
  scheduledNotes: { fontSize: "13px", color: "#374151" },
  outlookNote: { fontSize: "12px", color: "#16A34A", marginTop: "4px" },

  // Sprint progress
  daysLeftText: { fontSize: "12px", color: "#767676" },
  progressTrack: {
    height: "6px", backgroundColor: "#F0F0ED",
    borderRadius: "3px", overflow: "hidden",
  },
  progressFill: {
    height: "100%", backgroundColor: "#367C2B",
    borderRadius: "3px", transition: "width 0.3s ease",
  },

  // Timeline
  timeline: { display: "flex", flexDirection: "column", gap: "0" },
  timelineItem: { display: "flex", gap: "12px", paddingBottom: "16px" },
  timelineDotWrap: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  timelineDot: { width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#367C2B", marginTop: "4px" },
  timelineLine: { flex: 1, width: "1px", backgroundColor: "#E8E8E6", marginTop: "4px" },
  timelineContent: { flex: 1, paddingBottom: "4px" },
  timelineHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" },
  activityType: { fontSize: "13px", fontWeight: 600, color: "#1A1A1A" },
  activityDate: { fontSize: "12px", color: "#ABABAB" },
  activityOutcome: { fontSize: "13px", color: "#374151", marginBottom: "2px" },
  activityNotes: { fontSize: "13px", color: "#767676" },

};
