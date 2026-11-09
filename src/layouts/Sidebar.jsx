import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faGaugeHigh,
    faUsers,
    faSitemap,
    faUserGraduate,
    faChalkboardTeacher,
    faUserPlus,
    faBookOpen,
    faMoneyBillWave,
    faUser,
    faSchool,
    faBook,
    faClipboardCheck,
    faChartLine,
    faFileInvoiceDollar,
    faClipboardList,
    faCalendar,
} from "@fortawesome/free-solid-svg-icons";

import { getRole } from "../utils/auth";


export function Sidebar({ mobileOpen = false, onNavigate }) {

    const role = getRole();

    const menuItems = {

        admin: [
            {
                name: "Overview",
                path: "/admin/dashboard/overview",
                icon: faGaugeHigh
            },
            {
                name: "User Management",
                path: "/admin/dashboard/users",
                icon: faUsers
            },
            {
                name: "Academic Structure",
                path: "/admin/dashboard/academic-structure",
                icon: faSitemap
            },
            {
                name: "Student Management",
                path: "/admin/dashboard/students",
                icon: faUserGraduate
            },
            {
                name: "Teacher Management",
                path: "/admin/dashboard/teachers",
                icon: faChalkboardTeacher
            },
            {
                name: "Academic Assignments",
                path: "/admin/dashboard/academic-assignments",
                icon: faClipboardList
            },
            {
                name: "Academic Sessions",
                path: "/admin/dashboard/academic-sessions",
                icon: faCalendar
            },
            {
                name: "Admissions",
                path: "/admin/dashboard/admissions",
                icon: faUserPlus
            },
            {
                name: "Academic Records",
                path: "/admin/dashboard/records",
                icon: faBookOpen
            },
            {
                name: "Fees & Finance",
                path: "/admin/dashboard/fees",
                icon: faMoneyBillWave
            }
        ],

        teacher: [
            {
                name: "Overview",
                path: "/teacher/dashboard/overview",
                icon: faGaugeHigh
            },
            {
                name: "Profile",
                path: "/teacher/dashboard/teacher-profile",
                icon: faUser
            },
            {
                name: "Classes",
                path: "/teacher/dashboard/teacher-classes",
                icon: faSchool
            },
            {
                name: "My Subjects",
                path: "/teacher/dashboard/teacher-subjects",
                icon: faBook
            },
            {
                name: "Students",
                path: "/teacher/dashboard/teacher-students",
                icon: faUserGraduate
            },
            {
                name: "Attendance",
                path: "/teacher/dashboard/teacher-attendance",
                icon: faClipboardCheck
            },
            {
                name: "Academic Records",
                path: "/teacher/dashboard/teacher-records",
                icon: faBookOpen
            },
            {
                name: "Results",
                path: "/teacher/dashboard/teacher-results",
                icon: faChartLine
            }
        ],

        student: [
            {
                name: "Overview",
                path: "/student/dashboard/overview",
                icon: faGaugeHigh
            },
            {
                name: "Profile",
                path: "/student/dashboard/student-profile",
                icon: faUser
            },
            {
                name: "Academic Records",
                path: "/student/dashboard/student-academic-records",
                icon: faBookOpen
            },
            {
                name: "Attendance",
                path: "/student/dashboard/student-attendance",
                icon: faClipboardCheck
            },
            {
                name: "Results",
                path: "/student/dashboard/student-results",
                icon: faChartLine
            },
            {
                name: "Fees & Finance",
                path: "/student/dashboard/student-fees",
                icon: faFileInvoiceDollar
            }
        ]
    };

    const currentMenu = menuItems[role] || [];


    return (
        <aside
            id="app-navigation"
            className={`app-sidebar${mobileOpen ? " app-sidebar--open" : ""}`}
            aria-label="Main navigation"
        >

            {/* Brand */}
            <div className="sidebar-brand">

                <div className="sidebar-brand-mark">
                    V
                </div>

                <div className="sidebar-brand-text">
                    <div className="sidebar-brand-name">
                        Visionaire
                    </div>

                    <div className="sidebar-brand-product">
                        EduCore
                    </div>
                </div>

            </div>


            {/* Navigation */}
            <nav className="sidebar-nav">

                <div className="sidebar-section-label">
                    Main Menu
                </div>

                <div className="sidebar-nav-list">

                    {currentMenu.map((item) => (

                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `sidebar-nav-item ${
                                    isActive ? "active" : ""
                                }`
                            }
                            onClick={onNavigate}
                        >

                            <FontAwesomeIcon
                                icon={item.icon}
                                className="sidebar-nav-icon"
                                aria-hidden="true"
                            />

                            <span className="sidebar-nav-label">
                                {item.name}
                            </span>

                        </NavLink>

                    ))}

                </div>

            </nav>


            {/* Sidebar Footer */}
            <div className="sidebar-footer">

                <div className="sidebar-role">

                    <span className="sidebar-role-label">
                        Signed in as
                    </span>

                    <span className="sidebar-role-value">
                        {role?.charAt(0).toUpperCase() + role?.slice(1)}
                    </span>

                </div>

            </div>

        </aside>
    );
}