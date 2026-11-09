import { useState } from "react";
import Button from "./Button";

export function Form({
    fields = [],
    initialValues = {},
    onSubmit,
    submitLabel = "Submit",
    submitVariant = "primary",
    submitSize = "md",
    loading = false,
    className = "",
}) {
    const [formData, setFormData] = useState(initialValues);

    const handleChange = (name, value) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (onSubmit) {
            onSubmit(formData);
        }
    };

    return (
        <form
            className={`form ${className}`.trim()}
            onSubmit={handleSubmit}
        >
            {fields.map((field) => {
                const {
                    name,
                    label,
                    type = "text",
                    placeholder,
                    options = [],
                    required = false,
                    disabled = false,
                    help,
                    error,
                    rows = 4,
                    ...inputProps
                } = field;

                const fieldId = `form-${name}`;
                const hasError = Boolean(error);

                return (
                    <div className="form-group" key={name}>
                        {label && (
                            <label
                                className="form-label"
                                htmlFor={fieldId}
                            >
                                {label}

                                {required && (
                                    <span
                                        className="form-label-required"
                                        aria-hidden="true"
                                    >
                                        *
                                    </span>
                                )}
                            </label>
                        )}

                        {type === "textarea" ? (
                            <textarea
                                id={fieldId}
                                name={name}
                                className={`form-textarea ${
                                    hasError
                                        ? "form-textarea-error"
                                        : ""
                                }`}
                                placeholder={placeholder}
                                value={formData[name] ?? ""}
                                onChange={(e) =>
                                    handleChange(
                                        name,
                                        e.target.value
                                    )
                                }
                                required={required}
                                disabled={disabled}
                                rows={rows}
                                aria-invalid={hasError}
                                aria-describedby={
                                    help || error
                                        ? `${fieldId}-message`
                                        : undefined
                                }
                                {...inputProps}
                            />
                        ) : type === "select" ? (
                            <select
                                id={fieldId}
                                name={name}
                                className={`form-select ${
                                    hasError
                                        ? "form-select-error"
                                        : ""
                                }`}
                                value={formData[name] ?? ""}
                                onChange={(e) =>
                                    handleChange(
                                        name,
                                        e.target.value
                                    )
                                }
                                required={required}
                                disabled={disabled}
                                aria-invalid={hasError}
                                aria-describedby={
                                    help || error
                                        ? `${fieldId}-message`
                                        : undefined
                                }
                                {...inputProps}
                            >
                                <option value="">
                                    {placeholder || `Select ${label}`}
                                </option>

                                {options.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                        disabled={option.disabled}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                id={fieldId}
                                name={name}
                                className={`form-input ${
                                    hasError
                                        ? "form-input-error"
                                        : ""
                                }`}
                                type={type}
                                placeholder={placeholder}
                                value={formData[name] ?? ""}
                                onChange={(e) =>
                                    handleChange(
                                        name,
                                        e.target.value
                                    )
                                }
                                required={required}
                                disabled={disabled}
                                aria-invalid={hasError}
                                aria-describedby={
                                    help || error
                                        ? `${fieldId}-message`
                                        : undefined
                                }
                                {...inputProps}
                            />
                        )}

                        {(help || error) && (
                            <div
                                id={`${fieldId}-message`}
                                className={
                                    error
                                        ? "form-error"
                                        : "form-help"
                                }
                            >
                                {error || help}
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="form-actions">
                <Button
                    type="submit"
                    variant={submitVariant}
                    size={submitSize}
                    disabled={loading}
                >
                    {loading ? "Submitting..." : submitLabel}
                </Button>
            </div>
        </form>
    );
}