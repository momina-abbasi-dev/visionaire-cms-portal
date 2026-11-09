import { Link } from "react-router-dom";
import "../public-pages.css";

export default function Register() {
  return (
    <main className="public-page public-message-page">
      <section className="public-message-card">
        <div className="public-brand" aria-label="Visionaire EduCore">
          <span className="public-brand-name">Visionaire</span>
          <span className="public-brand-product">EduCore</span>
        </div>
        <p className="public-eyebrow">Account access</p>
        <h1>Registration unavailable</h1>
        <p>
          Public registration is disabled. Contact an administrator to create
          an account.
        </p>
        <Link className="btn btn-primary public-message-action" to="/login">
          Return to login
        </Link>
      </section>
    </main>
  );
}
