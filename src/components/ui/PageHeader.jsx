export function PageHeader({
    title,
    description,
    action,
    className = "",
}) {
    return (
        <header
            className={`page-header ${className}`.trim()}
        >
            <div className="page-header-content">
                <h1 className="page-title">
                    {title}
                </h1>

                {description && (
                    <p className="page-description">
                        {description}
                    </p>
                )}
            </div>

            {action && (
                <div className="page-header-actions">
                    {action}
                </div>
            )}
        </header>
    );
}