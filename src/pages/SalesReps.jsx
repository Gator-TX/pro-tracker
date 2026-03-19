import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import MobileManagerHeader from "../components/MobileManagerHeader";

export default function SalesReps() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDirection, setSortDirection] = useState("asc");

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
        .from("accounts").select("id, status, end_date").eq("rep_id", rep.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id)
        .gte("activity_date", weekAgo.toISOString().split("T")[0]);

      const { data: allActs } = await supabase
        .from("activities").select("id").eq("rep_id", rep.id);

      const now = new Date();
      const endDates = (accounts || [])
        .filter(a => a.end_date)
        .map(a => Math.max(0, Math.ceil((new Date(a.end_date) - now) / (1000 * 60 * 60 * 24))));
      const daysLeft = endDates.length > 0 ? Math.min(...endDates) : null;

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

  const sorted = [...reps].sort((a, b) => sortDirection === "asc"
    ? a.full_name.localeCompare(b.full_name)
    : b.full_name.localeCompare(a.full_name)
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F5F3; font-family: 'DM Sans', sans-serif; }

        .rep-row {
          display: grid;
          grid-template-columns: 1.8fr 80px 110px 90px 60px 80px 100px;
          gap: 12px; align-items: center;
          padding: 13px 20px;
          border-bottom: 1px solid #F0F0ED;
          cursor: pointer; transition: background 0.15s;
        }
        .rep-row:hover { background: #F9F9F8; }
        .rep-row:last-child { border-bottom: none; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-top: 70px !important; overflow-x: hidden; }
          .rep-table-header { display: none !important; }
          .rep-row {
            display: flex !important;
            align-items: center !important;
            padding: 14px 16px !important;
            gap: 0 !important;
          }
          .rep-row-left { flex: 1; }
          .rep-row-right { flex-shrink: 0; }
          .rep-desktop-stats { display: none !important; }
          .rep-mobile-stats { display: block !important; }
        }
        .rep-mobile-stats { display: none; }
      `}</style>

      <div style={styles.layout}>
        <MobileManagerHeader activePath="/dashboard/reps" profile={profile} />
        <Sidebar role="manager" profile={profile} onSignOut={handleSignOut} activePath="/dashboard/reps" />

        <div className="main-content" style={styles.main}>
          <TopBar title="Sales Reps" profile={profile} onSignOut={handleSignOut} />
          <p style={styles.subTitle}>{reps.length} rep{reps.length !== 1 ? "s" : ""}</p>

          <div style={styles.tableCard}>
            {/* Desktop header */}
            <div className="rep-row rep-table-header" style={styles.tableHeader}>
              <span style={{ cursor: "pointer" }} onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
                Rep {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <span>Accounts</span>
              <span>Logs This Week</span>
              <span>Total Logs</span>
              <span>Won</span>
              <span>Days Left</span>
              <span>Status</span>
            </div>

            {sorted.length === 0 ? (
              <p style={styles.emptyText}>No reps found</p>
            ) : (
              sorted.map(rep => {
                const badgeStyle = {
                  ...styles.statusBadge,
                  background: rep.atRisk ? "#FEF2F2" : "#F0FDF4",
                  color: rep.atRisk ? "#DC2626" : "#16A34A",
                  border: `1px solid ${rep.atRisk ? "#FECACA" : "#BBF7D0"}`,
                };
                return (
                  <div key={rep.id} className="rep-row"
                    onClick={() => navigate(`/dashboard/reps/${rep.id}`)}>

                    {/* Desktop: all columns inline */}
                    <div className="rep-row-left">
                      <p style={styles.repName}>{rep.full_name}</p>
                      <p style={styles.repEmail}>{rep.email || "—"}</p>
                    </div>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.accountCount}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.logsThisWeek}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.totalLogs}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.wonCount}</span>
                    <span className="rep-desktop-stats" style={styles.statVal}>{rep.daysLeft !== null ? `${rep.daysLeft}d` : "—"}</span>
                    <span className="rep-desktop-stats" style={badgeStyle}>{rep.atRisk ? "At Risk" : "On Track"}</span>

                    {/* Mobile: stats below name + badge on right */}
                    <div className="rep-mobile-stats" style={{ marginTop: "3px" }}>
                      <p style={styles.mobileStats}>
                        {rep.accountCount} accounts · {rep.logsThisWeek} logs this week · {rep.totalLogs} total · {rep.wonCount} won{rep.daysLeft !== null ? ` · ${rep.daysLeft}d left` : ""}
                      </p>
                    </div>
                    <div className="rep-row-right rep-mobile-stats">
                      <span style={badgeStyle}>{rep.atRisk ? "At Risk" : "On Track"}</span>
                    </div>

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
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F5F5F3" },
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" },
  spinner: { width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #E0E0DC", borderTopColor: "#367C2B", animation: "spin 0.8s linear infinite" },
  main: { marginLeft: "220px", flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px", minHeight: "100vh" },
  subTitle: { fontSize: "13px", color: "#767676" },
  tableCard: { backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px", overflow: "hidden" },
  tableHeader: { fontSize: "11px", fontWeight: 600, color: "#ABABAB", textTransform: "uppercase", letterSpacing: "0.06em" },
  repName: { fontSize: "14px", fontWeight: 600, color: "#1A1A1A" },
  repEmail: { fontSize: "12px", color: "#767676", marginTop: "2px" },
  statVal: { fontSize: "14px", color: "#374151" },
  statusBadge: { fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap", textAlign: "center", display: "inline-block" },
  mobileStats: { fontSize: "12px", color: "#767676", marginTop: "3px" },
  emptyText: { fontSize: "14px", color: "#ABABAB", padding: "24px 20px" },
};
