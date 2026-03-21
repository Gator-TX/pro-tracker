import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import MobileHeader from "../components/MobileHeader";
import RepBottomNav from "../components/RepBottomNav";
import PullToRefresh from "../components/PullToRefresh";

export default function RepActivities() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activities, setActivities] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState("all");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role === "manager") { navigate("/dashboard"); return; }

    const today = new Date().toISOString().split("T")[0];

    const { data: accountsData } = await supabase
      .from("accounts").select("id, name, company").eq("rep_id", user.id);
    setAccounts(accountsData || []);

    // Past logged activities
    const { data: actsData } = await supabase
      .from("activities").select("*")
      .eq("rep_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(200);
    setActivities(actsData || []);

    // Upcoming scheduled activities
    const { data: upcomingData } = await supabase
      .from("activities")
      .select("id, account_id, scheduled_next_date, scheduled_next_type, scheduled_next_time, notes")
      .eq("rep_id", user.id)
      .not("scheduled_next_date", "is", null)
      .gte("scheduled_next_date", today)
      .order("scheduled_next_date", { ascending: true })
      .limit(50);
    setUpcoming(upcomingData || []);

    setLoading(false);
  };

  const getAccountName = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc?.name || acc?.company || "—";
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const formatShortDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const isToday = (dateStr) => new Date().toISOString().split("T")[0] === dateStr;

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

  const showUpcoming = filterView === "all" || filterView === "upcoming";
  const showPast = filterView === "all" || filterView === "completed";

  if (loading) {
    return <div style={styles.loadingPage}><div style={styles.spinner} /></div>;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ra-page {
          min-height: 100vh; background: #F5F5F3;
          padding: 12px 16px 8px;
          display: flex; flex-direction: column; gap: 12px;
        }

        .ra-section-label {
          font-size: 10px; font-weight: 600; color: #ABABAB;
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: -4px;
        }

        .ra-filter-select {
          width: 100%; padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none; cursor: pointer;
          appearance: none; -webkit-appearance: none;
        }
        .ra-filter-select:focus { border-color: #367C2B; }

        .ra-card-list {
          display: flex; flex-direction: column; gap: 8px;
        }
        .ra-card-list-last {
          display: flex; flex-direction: column; gap: 8px; margin-bottom: 80px;
        }
        .ra-card {
          width: 100%; box-sizing: border-box;
          background: #ffffff; border: 1px solid #E8E8E6;
          border-left: 3px solid #367C2B;
          border-radius: 8px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 6px;
          cursor: pointer;
        }
        .ra-card-upcoming {
          width: 100%; box-sizing: border-box;
          background: #ffffff; border: 1px solid #E8E8E6;
          border-left: 3px solid #FFDE00;
          border-radius: 8px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 6px;
          cursor: pointer;
        }
        .ra-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ra-badge {
          display: inline-block; padding: 3px 10px; border-radius: 100px;
          font-size: 11px; font-weight: 600; flex-shrink: 0;
        }
        .ra-date-pill {
          font-size: 10px; font-weight: 700; padding: 3px 8px;
          border-radius: 100px; white-space: nowrap; flex-shrink: 0;
        }
        .ra-card-date { font-size: 12px; color: #ABABAB; }
        .ra-card-account { font-size: 14px; font-weight: 600; color: #1A1A1A; }
        .ra-card-outcome { font-size: 12px; font-weight: 500; color: #374151; }
        .ra-card-notes {
          font-size: 12px; color: #767676;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ra-empty { font-size: 14px; color: #ABABAB; padding: 8px 0 24px; }
      `}</style>

      <MobileHeader activePath="/activities" profile={profile} />
      <RepBottomNav activePath="/activities" />

      <PullToRefresh onRefresh={loadData}>
        <div className="ra-page">

          {/* View filter dropdown */}
          <select className="ra-filter-select" value={filterView} onChange={e => setFilterView(e.target.value)}>
            <option value="all">All Activity</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>

          {/* Section 1 — Upcoming Scheduled */}
          {showUpcoming && upcoming.length > 0 && (
            <>
              <p className="ra-section-label">Upcoming</p>
              <div className="ra-card-list">
                {upcoming.map(act => {
                  const tc = TYPE_COLORS[act.scheduled_next_type] || TYPE_COLORS.Call;
                  const today = isToday(act.scheduled_next_date);
                  return (
                    <div
                      key={act.id}
                      className="ra-card-upcoming"
                      onClick={() => navigate(`/accounts/${act.account_id}`)}
                    >
                      <div className="ra-card-top">
                        <span className="ra-badge" style={{ background: tc.bg, color: tc.color }}>
                          {act.scheduled_next_type || "Activity"}
                        </span>
                        <span className="ra-date-pill" style={{
                          background: today ? "#F0FDF4" : "#EFF6FF",
                          color: today ? "#16A34A" : "#2563EB",
                        }}>
                          {today ? "Today" : formatShortDate(act.scheduled_next_date)}
                        </span>
                      </div>
                      <p className="ra-card-account">{getAccountName(act.account_id)}</p>
                      {act.notes && <p className="ra-card-notes">{act.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Section 2 — Past Activity */}
          {showPast && (
            <>
              <p className="ra-section-label">Past Activity</p>
              {activities.length === 0 ? (
                <p className="ra-empty">No activity logged yet</p>
              ) : (
              <div className="ra-card-list-last">
              {activities.map(act => {
                const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                return (
                  <div key={act.id} className="ra-card" onClick={() => navigate(`/accounts/${act.account_id}`)}>
                    <div className="ra-card-top">
                      <span className="ra-badge" style={{ background: tc.bg, color: tc.color }}>
                        {act.activity_type}
                      </span>
                      <span className="ra-card-date">{formatDate(act.activity_date)}</span>
                    </div>
                    <p className="ra-card-account">{getAccountName(act.account_id)}</p>
                    {act.outcome && <p className="ra-card-outcome">{act.outcome}</p>}
                    {act.notes && <p className="ra-card-notes">{act.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}

        </div>
      </PullToRefresh>
    </>
  );
}

const styles = {
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
};
