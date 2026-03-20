import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import logo from "../assets/uatprologo.png";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";
import RepTopBar from "../components/RepTopBar";

export default function LogActivity() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [primaryContact, setPrimaryContact] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Activity fields
  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");

  // Schedule next activity fields
  const [nextType, setNextType] = useState("Call");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [nextNotes, setNextNotes] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);

  const ACTIVITY_TYPES = ["Call", "Meeting", "Email"];

  const OUTCOMES = {
    Call:    ["Reached — positive", "Reached — neutral", "Left voicemail", "No answer", "Not interested"],
    Meeting: ["Very interested", "Interested", "Needs follow-up", "Not a fit", "Proposal requested"],
    Email:   ["Replied — positive", "Replied — neutral", "No reply", "Out of office"],
  };

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);

    const { data: acc } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .single();
    setAccount(acc);

    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("account_id", id)
      .eq("is_primary", true)
      .single();
    setPrimaryContact(contacts);

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const record = {
      account_id: id,
      rep_id: user.id,
      activity_type: activityType,
      activity_date: activityDate,
      outcome,
      notes,
      ...(scheduleNext && nextDate ? {
        scheduled_next_type: nextType,
        scheduled_next_date: nextDate,
        scheduled_next_time: nextTime || null,
        scheduled_next_notes: nextNotes || null,
      } : {}),
    };

    await supabase.from("activities").insert(record);
    setSaving(false);
    navigate(`/accounts/${id}`);
  };

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
      </div>
    );
  }

  const contactName = primaryContact
    ? `${primaryContact.first_name} ${primaryContact.last_name}`
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .field-input {
          width: 100%; padding: 10px 12px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          appearance: none; -webkit-appearance: none;
        }
        .field-input:focus {
          border-color: #367C2B;
          box-shadow: 0 0 0 3px rgba(54,124,43,0.10);
        }

        .type-tile {
          flex: 1; padding: 12px 8px;
          border: 1.5px solid #E0E0DC;
          border-radius: 8px; background: #fff;
          font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: #767676; cursor: pointer;
          transition: all 0.15s; text-align: center;
        }
        .type-tile:hover { border-color: #367C2B; color: #367C2B; }
        .type-tile.active {
          background: #F0FDF4;
          border-color: #367C2B;
          color: #367C2B;
          font-weight: 600;
        }

        .btn-primary {
          width: 100%; padding: 13px;
          background: #367C2B; color: #fff;
          border: none; border-radius: 6px;
          font-size: 15px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: background 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: #2d6b24; }
        .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .btn-secondary {
          width: 100%; padding: 12px;
          background: #fff; color: #767676;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
        }
        .btn-secondary:hover { border-color: #ABABAB; color: #1A1A1A; }

        .outlook-btn {
          width: 100%; padding: 11px;
          background: #EFF6FF; color: #2563EB;
          border: 1.5px solid #BFDBFE; border-radius: 6px;
          font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
        }
        .outlook-btn:hover { background: #DBEAFE; }

        .toggle-row {
          display: flex; align-items: center;
          justify-content: space-between;
          cursor: pointer;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 86px !important; }
          .log-cards { gap: 8px !important; }
        }
      `}</style>

      <div style={styles.layout}>
        <MobileHeader activePath="/accounts" profile={profile} />
        <Sidebar role="rep" profile={profile} onSignOut={handleSignOut} activePath="/accounts" />
        <div className="main-content" style={styles.page}>
        <RepTopBar title="Log Activity" profile={profile} onSignOut={handleSignOut} />

        {/* ── HEADER ── */}
        <div style={styles.header}>
          <button onClick={() => navigate(`/accounts/${id}`)} style={styles.backBtn}>← Back</button>
          <img src={logo} alt="United Ag & Turf" style={styles.headerLogo} />
          <div style={{ width: "40px" }} />
        </div>

        {/* Subtitle */}
        <div style={styles.subtitleWrap}>
          <h1 style={styles.pageTitle}>Log Activity</h1>
          <p style={styles.subtitle}>
            {account?.name || account?.company}
            {contactName ? ` · ${contactName}` : ""}
          </p>
        </div>

        <div className="log-cards" style={styles.content}>

          {/* ── ACTIVITY TYPE ── */}
          <div style={styles.card}>
            <p style={styles.cardLabel}>Activity Type</p>
            <div style={styles.tileRow}>
              {ACTIVITY_TYPES.map(type => (
                <button
                  key={type}
                  className={`type-tile${activityType === type ? " active" : ""}`}
                  onClick={() => { setActivityType(type); setOutcome(""); }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* ── ACTIVITY FIELDS ── */}
          <div style={styles.card}>
            <div style={styles.field}>
              <label style={styles.fieldLabel}>Date</label>
              <input
                className="field-input"
                type="date"
                value={activityDate}
                onChange={e => setActivityDate(e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.fieldLabel}>Outcome</label>
              <select
                className="field-input"
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
              >
                <option value="">Select outcome...</option>
                {OUTCOMES[activityType].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.fieldLabel}>Notes</label>
              <textarea
                className="field-input"
                rows={4}
                placeholder="What happened?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* ── SCHEDULE NEXT ACTIVITY ── */}
          <div style={styles.card}>
            <div
              className="toggle-row"
              onClick={() => setScheduleNext(p => !p)}
            >
              <p style={styles.cardLabel}>Schedule Next Activity</p>
              <div style={{
                ...styles.toggle,
                background: scheduleNext ? "#367C2B" : "#E0E0DC",
              }}>
                <div style={{
                  ...styles.toggleKnob,
                  transform: scheduleNext ? "translateX(18px)" : "translateX(2px)",
                }} />
              </div>
            </div>

            {scheduleNext && (
              <div style={styles.scheduleFields}>
                {/* Next activity type */}
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Activity Type</label>
                  <select
                    className="field-input"
                    value={nextType}
                    onChange={e => setNextType(e.target.value)}
                  >
                    {ACTIVITY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.rowFields}>
                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>Date</label>
                    <input
                      className="field-input"
                      type="date"
                      value={nextDate}
                      onChange={e => setNextDate(e.target.value)}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>Time</label>
                    <input
                      className="field-input"
                      type="time"
                      value={nextTime}
                      onChange={e => setNextTime(e.target.value)}
                    />
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Notes / Agenda</label>
                  <textarea
                    className="field-input"
                    rows={3}
                    placeholder="What to prep or discuss?"
                    value={nextNotes}
                    onChange={e => setNextNotes(e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <button className="outlook-btn">
                  Add to Outlook calendar
                </button>
              </div>
            )}
          </div>

          {/* ── ACTION BUTTONS ── */}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Activity"}
          </button>

          <button
            className="btn-secondary"
            onClick={() => navigate(`/accounts/${id}`)}
          >
            Cancel
          </button>

        </div>
        </div>
      </div>
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
    paddingBottom: "40px",
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

  subtitleWrap: {
    padding: "16px 20px 8px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #E8E8E6",
  },
  pageTitle: { fontSize: "20px", fontWeight: 600, color: "#1A1A1A" },
  subtitle: { fontSize: "13px", color: "#767676", marginTop: "2px" },

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
    display: "flex", flexDirection: "column", gap: "14px",
  },
  cardLabel: {
    fontSize: "11px", fontWeight: 600, color: "#ABABAB",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },

  // Type tiles
  tileRow: { display: "flex", gap: "8px" },

  // Fields
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#374151" },
  rowFields: { display: "flex", gap: "10px" },

  // Schedule toggle
  toggle: {
    width: "40px", height: "22px", borderRadius: "100px",
    position: "relative", transition: "background 0.2s", flexShrink: 0,
  },
  toggleKnob: {
    position: "absolute", top: "3px",
    width: "16px", height: "16px",
    borderRadius: "50%", backgroundColor: "#ffffff",
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  scheduleFields: {
    display: "flex", flexDirection: "column", gap: "12px",
    paddingTop: "4px",
  },
};
