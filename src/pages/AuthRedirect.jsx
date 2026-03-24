import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function AuthRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const access_token = searchParams.get("access_token");
    const refresh_token = searchParams.get("refresh_token");

    const handleAuth = async () => {
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role === "manager") {
          navigate("/dashboard");
        } else {
          navigate("/home");
        }
      } else {
        navigate("/login");
      }
    };

    handleAuth();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
      <div style={{ fontSize: "14px", color: "#767676", fontFamily: "DM Sans, sans-serif" }}>Signing you in...</div>
    </div>
  );
}
