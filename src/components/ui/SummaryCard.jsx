import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartSimple } from "@fortawesome/free-solid-svg-icons";

export function SummaryCard({
    title,
    value,
    icon = faChartSimple,

    supporting,
    trend,
    trendType = "neutral",

    variant = "default",
    interactive = false,
    loading = false,

    className = "",
    onClick,
}) {
    const cardClasses = [
        "summary-card",

        variant !== "default"
            ? `summary-card-${variant}`
            : "",

        interactive
            ? "summary-card-interactive"
            : "",

        loading
            ? "summary-card-loading"
            : "",

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
            {loading ? (
                <>
                    <div className="summary-card-header">
                        <span className="summary-card-skeleton summary-card-skeleton-label" />
                        <span className="summary-card-icon" />
                    </div>

                    <div className="summary-card-skeleton summary-card-skeleton-value" />

                    {supporting && (
                        <div className="summary-card-skeleton" />
                    )}
                </>
            ) : (
                <>
                    <div className="summary-card-header">
                        <span className="summary-card-label">
                            {title}
                        </span>

                        <span className="summary-card-icon">
                            <FontAwesomeIcon
                                icon={icon}
                                aria-hidden="true"
                            />
                        </span>
                    </div>

                    <div className="summary-card-value">
                        {value}
                    </div>

                    {(supporting || trend) && (
                        <div className="summary-card-supporting">
                            {trend && (
                                <span
                                    className={`summary-card-trend summary-card-trend-${trendType}`}
                                >
                                    {trend}
                                </span>
                            )}

                            {supporting && (
                                <span>
                                    {supporting}
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
        </article>
    );
}