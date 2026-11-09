export function Tabs({
    tabs = [],
    activeTab,
    onChange,
    variant = "default",
    size = "md",
    fullWidth = false,
    className = "",
}) {
    const tabsClasses = [
        "tabs",
        variant !== "default" ? `tabs-${variant}` : "",
        size !== "md" ? `tabs-${size}` : "",
        fullWidth ? "tabs-full" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={tabsClasses}>
            <div className="tabs-list" role="tablist">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={tab.panelId || undefined}
                            className={`tab ${isActive ? "is-active" : ""}`}
                            onClick={() => onChange?.(tab.id)}
                            disabled={tab.disabled}
                        >
                            {tab.icon && (
                                <span className="tab-icon" aria-hidden="true">
                                    {tab.icon}
                                </span>
                            )}

                            <span className="tab-label">
                                {tab.label}
                            </span>

                            {tab.badge !== undefined && tab.badge !== null && (
                                <span className="badge">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}