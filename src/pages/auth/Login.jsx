import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { loginUser } from "../../services/auth/authService";
import { setAuth } from "../../utils/auth";
import "../public-pages.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setMessage("Email and Password are required");
    } else {
      setLoading(true);
      try {
        const res = await loginUser({
          email,
          password,
        });
        const role = res.data.user.role;
        setAuth(res.data.token, role);
        if (role === "admin") {
          navigate("/admin/dashboard");
        } else if (role === "teacher") {
          navigate("/teacher/dashboard");
        } else {
          navigate("/student/dashboard");
        }
      } catch (error) {
        setMessage("Invalid email or password");
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="public-page public-login-page">
      <main className="public-login-shell">
        <section className="public-login-intro">
          <div className="public-brand" aria-label="Visionaire EduCore">
            <span className="public-brand-name">Visionaire</span>
            <span className="public-brand-product">EduCore</span>
          </div>

          <div className="public-login-intro-copy">
            <p className="public-eyebrow">Education management portal</p>
            <h1>Empowering Education. Shaping Futures.</h1>
            <p className="public-login-intro-description">
              Visionaire EduCore is your all-in-one platform for smarter
              learning and better management.
            </p>
          </div>

          <ul className="public-login-benefits">
            <li>
              <strong>Smart Learning</strong>
              <span>Access resources, courses &amp; more.</span>
            </li>
            <li>
              <strong>Easy Management</strong>
              <span>Manage students, staff and activities efficiently.</span>
            </li>
            <li>
              <strong>Real-Time Insights</strong>
              <span>Track performance and make data-driven decisions.</span>
            </li>
          </ul>
        </section>

        <section className="public-login-form-panel">
          <div className="public-login-heading">
            <p className="public-eyebrow">Welcome back</p>
            <h2>Sign in to your account</h2>
            <p>Continue to your Visionaire EduCore workspace.</p>
          </div>

          {message && (
            <div
              className={`public-form-message ${
                message === "Login successful!"
                  ? "public-form-message-success"
                  : "public-form-message-error"
              }`}
              role="alert"
            >
              {message}
            </div>
          )}

          <form className="form-stack public-login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                className="form-input"
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                className="form-input"
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="public-login-options">
              <div className="public-remember-option">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Remember Me</label>
              </div>
              <a href="#" className="public-text-link">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg public-login-submit"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="public-login-help">
            Need an account? Contact your administrator.
          </p>
        </section>
      </main>

      <footer className="public-footer">
        <p>&copy; 2026 Visionaire EduCore. All rights reserved.</p>
      </footer>
    </div>
  );
}