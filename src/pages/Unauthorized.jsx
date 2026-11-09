import "./public-pages.css";

export default function Unauthorized () {
    return (
        <main className="public-page public-message-page">
            <section className="public-message-card">
                <div className="public-brand" aria-label="Visionaire EduCore">
                    <span className="public-brand-name">Visionaire</span>
                    <span className="public-brand-product">EduCore</span>
                </div>
                <p className="public-eyebrow">Access restricted</p>
                <h1>Access Denied</h1>
                <p>You do not have permission to view this page.</p>
            </section>
        </main>
    );
}