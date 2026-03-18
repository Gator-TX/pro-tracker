import { useState } from "react";
import logo from "../assets/uatprologo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Fetch role from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role;

    if (role === "manager") {
      navigate("/dashboard");
    } else {
      navigate("/accounts");
    }

    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ffffff; }

        .login-input {
          width: 100%;
          padding: 11px 13px;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #E0E0DC;
          border-radius: 6px;
          background: #ffffff;
          color: #1A1A1A;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .login-input::placeholder { color: #ABABAB; }
        .login-input:focus {
          border-color: #367C2B;
          box-shadow: 0 0 0 3px rgba(54,124,43,0.10);
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: #367C2B;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
          letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) { background: #2d6b24; }
        .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
      `}</style>

      <div style={styles.page}>
        <div style={styles.card}>

          {/* Logo + yellow accent line */}
          <div style={styles.logoWrap}>
            <img
              src={logo}
              alt="United Ag & Turf"
              style={styles.logo}
            />
            <div style={styles.logoAccent} />
          </div>

          {/* Heading */}
          <div style={styles.headingWrap}>
            <h1 style={styles.heading}>Welcome back</h1>
            <p style={styles.subheading}>Sign in to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                className="login-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                className="login-input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={styles.errorBox}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
              style={{ marginTop: "4px" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p style={styles.note}>Role detected automatically on sign in</p>

        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
  logoWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  logo: {
    width: "200px",
    objectFit: "contain",
  },
  logoAccent: {
    width: "200px",
    height: "3px",
    backgroundColor: "#FFDE00",
    borderRadius: "2px",
  },
  headingWrap: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1A1A1A",
    letterSpacing: "-0.01em",
  },
  subheading: {
    fontSize: "14px",
    color: "#767676",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
  },
  errorBox: {
    fontSize: "13px",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: "6px",
    padding: "10px 12px",
  },
  note: {
    textAlign: "center",
    fontSize: "12px",
    color: "#ABABAB",
  },
};
