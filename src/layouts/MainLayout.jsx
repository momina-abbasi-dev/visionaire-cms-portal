import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Outlet } from "react-router-dom";


export default function MainLayout() {
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

    useEffect(() => {
        if (!mobileNavigationOpen) {
            return undefined;
        }

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setMobileNavigationOpen(false);
            }
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [mobileNavigationOpen]);

    return (

        <div className="app-shell">

            {mobileNavigationOpen && (
                <button
                    type="button"
                    className="app-sidebar-backdrop"
                    aria-label="Close navigation"
                    onClick={() => setMobileNavigationOpen(false)}
                />
            )}

            <Sidebar
                mobileOpen={mobileNavigationOpen}
                onNavigate={() => setMobileNavigationOpen(false)}
            />

            <div className="app-main">

                <Topbar
                    mobileNavigationOpen={mobileNavigationOpen}
                    onToggleMobileNavigation={() => setMobileNavigationOpen((open) => !open)}
                />

                <main className="app-content">

                    <Outlet />

                </main>

            </div>

        </div>
    );
}