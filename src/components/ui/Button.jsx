import { forwardRef } from "react";


const Button = forwardRef(function Button(
    {
        children,
        variant = "primary",
        size = "md",
        type = "button",
        icon,
        iconPosition = "left",
        fullWidth = false,
        className = "",
        disabled = false,
        ...props
    },
    ref
) {

    const classes = [
        "btn",
        `btn-${variant}`,
        `btn-${size}`,
        fullWidth ? "btn-full" : "",
        className
    ]
        .filter(Boolean)
        .join(" ");


    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            disabled={disabled}
            {...props}
        >

            {icon && iconPosition === "left" && (
                <span className="btn-icon-wrapper" aria-hidden="true">
                    {icon}
                </span>
            )}

            {children && (
                <span className="btn-label">
                    {children}
                </span>
            )}

            {icon && iconPosition === "right" && (
                <span className="btn-icon-wrapper" aria-hidden="true">
                    {icon}
                </span>
            )}

        </button>
    );
});


export default Button;