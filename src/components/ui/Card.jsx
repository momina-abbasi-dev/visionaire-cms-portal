export function Card({
    title,
    description,
    children,
    actions,
    footer,
    interactive = false,
    className = "",
    onClick,
}) {
    const cardClasses = [
        "card",
        interactive ? "card-interactive" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <article
            className={cardClasses}
            onClick={interactive ? onClick : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
        >
            {(title || description || actions) && (
                <header className="card-header">
                    <div className="card-header-content">
                        {title && (
                            <h3 className="card-title">
                                {title}
                            </h3>
                        )}

                        {description && (
                            <p className="card-description">
                                {description}
                            </p>
                        )}
                    </div>

                    {actions && (
                        <div className="card-actions">
                            {actions}
                        </div>
                    )}
                </header>
            )}

            <div className="card-body">
                {children}
            </div>

            {footer && (
                <footer className="card-footer">
                    {footer}
                </footer>
            )}
        </article>
    );
}