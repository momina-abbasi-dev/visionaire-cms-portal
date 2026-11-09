export function Panel({
    title,
    description,
    children,
    actions,
    footer,
    variant = "default",
    className = "",
}) {
    const panelClasses = [
        "panel",
        variant !== "default" ? `panel-${variant}` : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <section className={panelClasses}>
            {(title || description || actions) && (
                <header className="panel-header">
                    <div className="panel-header-content">
                        {title && (
                            <h2 className="panel-title">
                                {title}
                            </h2>
                        )}

                        {description && (
                            <p className="panel-description">
                                {description}
                            </p>
                        )}
                    </div>

                    {actions && (
                        <div className="panel-actions">
                            {actions}
                        </div>
                    )}
                </header>
            )}

            <div className="panel-body">
                {children}
            </div>

            {footer && (
                <footer className="panel-footer">
                    {footer}
                </footer>
            )}
        </section>
    );
}