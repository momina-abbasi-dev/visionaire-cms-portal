import { useId } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

export function Drawer({
    isOpen,
    title,
    description,
    children,
    onClose,
    size = "md",
    position = "right",
    footer,
    className = "",
}) {
    const drawerId = useId();

    if (!isOpen) return null;

    const titleId = `drawer-title-${drawerId}`;
    const descriptionId = `drawer-description-${drawerId}`;

    const drawerClasses = [
        "drawer",
        `drawer-${size}`,
        position !== "right" ? `drawer-${position}` : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className="drawer-overlay"
            onClick={onClose}
        >
            <aside
                className={drawerClasses}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={
                    description ? descriptionId : undefined
                }
            >
                {/* HEADER */}
                <div className="drawer-header">
                    <div className="drawer-header-content">
                        {title && (
                            <h2
                                id={titleId}
                                className="drawer-title"
                            >
                                {title}
                            </h2>
                        )}

                        {description && (
                            <p
                                id={descriptionId}
                                className="drawer-description"
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        className="drawer-close"
                        onClick={onClose}
                        aria-label="Close drawer"
                    >
                        <FontAwesomeIcon
                            icon={faXmark}
                            aria-hidden="true"
                        />
                    </button>
                </div>

                {/* BODY */}
                <div className="drawer-body">
                    {children}
                </div>

                {/* FOOTER */}
                {footer && (
                    <div className="drawer-footer">
                        {footer}
                    </div>
                )}
            </aside>
        </div>
    );
}