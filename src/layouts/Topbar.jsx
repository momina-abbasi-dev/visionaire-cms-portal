import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBell,
    faBars,
    faChevronDown,
    faRightFromBracket,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { getRole } from "../utils/auth";


export function Topbar({ mobileNavigationOpen = false, onToggleMobileNavigation }) {

    const navigate = useNavigate();
    const role = getRole();


    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");

        navigate("/login");
    };


    const formattedRole =
        role
            ? role.charAt(0).toUpperCase() + role.slice(1)
            : "User";


    return (

        <header className="app-topbar">

            {/* Left Side */}
            <div className="topbar-left">

                <button
                    type="button"
                    className="topbar-menu-button"
                    aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={mobileNavigationOpen}
                    aria-controls="app-navigation"
                    onClick={onToggleMobileNavigation}
                >
                    <FontAwesomeIcon
                        icon={mobileNavigationOpen ? faXmark : faBars}
                        aria-hidden="true"
                    />
                </button>

                <div className="topbar-context">

                    <span className="topbar-context-label">
                        Visionaire EduCore
                    </span>

                    <span className="topbar-context-divider">
                        /
                    </span>

                    <span className="topbar-context-page">
                        Dashboard
                    </span>

                </div>

            </div>


            {/* Right Side */}
            <div className="topbar-right">

                {/* Notifications */}
                <button
                    type="button"
                    className="topbar-icon-button"
                    aria-label="Notifications"
                >
                    <FontAwesomeIcon
                        icon={faBell}
                        aria-hidden="true"
                    />

                    <span className="notification-dot" />
                </button>


                {/* User Menu */}
                <div className="topbar-user">

                    <div className="topbar-avatar">
                        {formattedRole.charAt(0)}
                    </div>


                    <div className="topbar-user-info">

                        <span className="topbar-user-name">
                            {formattedRole}
                        </span>

                        <span className="topbar-user-role">
                            {formattedRole}
                        </span>

                    </div>


                    <button
                        type="button"
                        className="topbar-user-button"
                        aria-label="Open user menu"
                    >
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            aria-hidden="true"
                        />
                    </button>

                </div>


                {/* Logout */}
                <button
                    type="button"
                    className="topbar-logout"
                    onClick={handleLogout}
                >
                    <FontAwesomeIcon
                        icon={faRightFromBracket}
                        aria-hidden="true"
                    />

                    <span>
                        Logout
                    </span>
                </button>

            </div>

        </header>
    );
}