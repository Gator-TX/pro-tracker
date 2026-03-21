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
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(profileData);
    if (profileData?.role === "manager") { navigate("/dashboard"); return; }

    const { data: accountsData } = await supabase
      .from("accounts").select("id, name, company").eq("rep_id", user.id);
    setAccounts(accountsData || []);

    const { data: actsData } = await supabase
      .from("activities").select("*")
      .eq("rep_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(200);
    setActivities(actsData || []);

    setLoading(false);
  };

  const getAccountName = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc?.name || acc?.company || "—";
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const TYPE_COLORS = {
    Call:    { bg: "#EFF6FF", color: "#2563EB" },
    Meeting: { bg: "#F0FDF4", color: "#16A34A" },
    Email:   { bg: "#FAF5FF", color: "#7C3AED" },
  };

  const filtered = activities.filter(a =>
    filterType === "all" || a.activity_type === filterType
  );

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
        .ra-title { font-size: 20px; font-weight: 700; color: #1A1A1A; }
        .ra-count { font-size: 12px; color: #767676; margin-top: 2px; }

        .ra-filter-bar { display: flex; gap: 8px; }
        .ra-filter-select {
          flex: 1; padding: 8px 12px; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC; border-radius: 6px;
          background: #fff; color: #1A1A1A; outline: none; cursor: pointer;
        }
        .ra-filter-select:focus { border-color: #367C2B; }

        .ra-card-list {
          display: flex; flex-direction: column; gap: 8px; margin-bottom: 80px;
        }
        .ra-card {
          width: 100%; box-sizing: border-box;
          background: #ffffff; border: 1px solid #E8E8E6;
          border-left: 3px solid #367C2B;
          border-radius: 8px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .ra-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ra-badge {
          display: inline-block; padding: 3px 10px; border-radius: 100px;
          font-size: 11px; font-weight: 600; flex-shrink: 0;
        }
        .ra-card-date { font-size: 12px; color: #ABABAB; }
        .ra-card-account { font-size: 14px; font-weight: 600; color: #1A1A1A; }
        .ra-card-outcome { font-size: 12px; font-weight: 500; color: #374151; }
        .ra-card-notes {
          font-size: 12px; color: #767676;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ra-empty { font-size: 14px; color: #ABABAB; padding: 24px 0; }
      `}</style>

      <MobileHeader activePath="/activities" profile={profile} />
      <RepBottomNav activePath="/activities" />

      <PullToRefresh onRefresh={loadData}>
        <div className="ra-page">

          <div>
            <p className="ra-title">Activity Log</p>
            <p className="ra-count">{filtered.length} log{filtered.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="ra-filter-bar">
            <select className="ra-filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              {["Call", "Meeting", "Email"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="ra-empty">No activities found</p>
          ) : (
            <div className="ra-card-list">
              {filtered.map(act => {
                const tc = TYPE_COLORS[act.activity_type] || TYPE_COLORS.Call;
                return (
                  <div key={act.id} className="ra-card">
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

        </div>
      </PullToRefresh>
    </>
  );
}

const styles = {
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
};
