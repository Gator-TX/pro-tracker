import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";

export default function SalesReps() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);

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

    const repsWithStats = await Promise.all((repsData || []).map(async (rep) => {
      const { data: accounts } = await supabase
        .from("accounts").select("id, status").eq("rep_id", rep.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id)
        .gte("activity_date", weekAgo.toISOString().split("T")[0]);

      const { data: allActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id);

      const today = new Date().toISOString().split("T")[0];
      const { data: sprint } = await supabase
        .from("sprints").select("*").eq("rep_id", rep.id)
        .lte("start_date", today).gte("end_date", today).single();

      const daysLeft = sprint
        ? Math.max(0, Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
        : null;

      const wonCount = (accounts || []).filter(a => a.status === "Won").length;
      const weeklyCount = weekActs?.length || 0;
      const atRisk = weeklyCount === 0 && (accounts || []).length > 0;

      return {
        ...rep,
        accountCount: (accounts || []).length,
        logsThisWeek: weeklyCount,
        totalLogs: allActs?.length || 0,
        wonCount,
        daysLeft,
        atRisk,
      };
    }));

    setReps(repsWithStats);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
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

        .rep-card {
          background: #ffffff; border: 1px solid #E8E8E6;
          border-radius: 8px; padding: 20px 24px;
          cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
          display: grid;
          grid-template-columns: 1.5fr repeat(5, 1fr) 100px;
          gap: 16px; align-items: center;
        }
        .rep-card:hover {
          border-color: #367C2B;
          box-shadow: 0 2px 8px rgba(54,124,43,0.08);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; }
        }
      `}</style>

      <div style={styles.layout}>
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/reps" />

        {/* MAIN */}
        <div className="main-content" style={styles.main}>
          <h1 style={styles.pageTitle}>Sales Reps</h1>

          {/* Column headers */}
          <div style={styles.repHeader}>
            <span>Rep</span>
            <span>Accounts</span>
            <span>Logs This Week</span>
            <span>Total Logs</span>
            <span>Won</span>
            <span>Days Left</span>
            <span>Status</span>
          </div>

          {/* Rep cards */}
          <div style={styles.repList}>
            {reps.length === 0 ? (
              <p style={styles.emptyText}>No reps found</p>
            ) : (
              reps.map(rep => (
                <div key={rep.id} className="rep-card"
                  onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>
                  <div>
                    <p style={styles.repName}>{rep.full_name}</p>
                    <p style={styles.repEmail}>{rep.email || "—"}</p>
                  </div>
                  <span style={styles.statVal}>{rep.accountCount}</span>
                  <span style={styles.statVal}>{rep.logsThisWeek}</span>
                  <span style={styles.statVal}>{rep.totalLogs}</span>
                  <span style={styles.statVal}>{rep.wonCount}</span>
                  <span style={styles.statVal}>{rep.daysLeft !== null ? `${rep.daysLeft}d` : "—"}</span>
                  <span style={{
                    ...styles.statusBadge,
                    background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                    color: rep.atRisk ? "#DC2626" : "#16A34A",
                    border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                  }}>
                    {rep.atRisk ? "At Risk" : "On Track"}
                  </span>
                </div>
              ))
            )}
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
  repHeader: { display: "grid", gridTemplateColumns: "1.5fr repeat(5, 1fr) 100px", gap: "16px", padding: "0 24px", fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  repList: { display: "flex", flexDirection: "column", gap: "10px" },
  repName: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  repEmail: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  statVal: { fontSize: "14px", color: "#374151" },
  statusBadge: { fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center", display: "inline-block" },
  emptyText: { fontSize: "14px", color: "#ABABAB" },
};
