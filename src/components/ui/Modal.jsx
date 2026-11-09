import { useId } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

export function Modal({
    isOpen,
    title,
    description,
    onClose,
    children,
    actions,
    size = "md",
    variant,
    scroll = false,
    className = "",
}) {
    const modalId = useId();

    if (!isOpen) return null;

    const titleId = `modal-title-${modalId}`;
    const descriptionId = `modal-description-${modalId}`;

    const dialogClasses = [
        "modal-dialog",
        `modal-${size}`,
        variant ? `modal-${variant}` : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
        >
            <div
                className={dialogClasses}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
            >
                {/* HEADER */}
                <div className="modal-header">
                    <div className="modal-header-content">
                        {title && (
                            <h2
                                id={titleId}
                                className="modal-title"
                            >
                                {title}
                            </h2>
                        )}

                        {description && (
                            <p
                                id={descriptionId}
                                className="modal-description"
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <FontAwesomeIcon
                            icon={faXmark}
                            aria-hidden="true"
                        />
                    </button>
                </div>

                {/* BODY */}
                <div
                    className={`modal-body ${
                        scroll ? "modal-scroll" : ""
                    }`}
                >
                    {children}
                </div>

                {/* FOOTER */}
                {actions && (
                    <div className="modal-footer">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}