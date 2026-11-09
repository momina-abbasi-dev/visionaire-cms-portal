import Button from "./Button";

export function SearchFilters({
    searchValue = "",
    onSearchChange,
    onSearch,
    showSearch = true,
    searchPlaceholder = "Search...",
    filters = [],
    onReset,
    className = "",
}) {
    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch?.();
    };

    return (
        <form
            className={`search-filters ${className}`.trim()}
            onSubmit={handleSubmit}
        >
            {/* SEARCH */}
            {showSearch && (
                <div className="search-filters-main">
                    <input
                        className="form-input search-input"
                        type="search"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        aria-label="Search"
                    />

                    <Button type="submit">
                        Search
                    </Button>
                </div>
            )}

            {/* FILTERS */}
            {filters.length > 0 && (
                <div className="search-filters-controls">
                    {filters.map((filter, index) => {
                        const filterId = filter.id ?? index;

                        return (
                            <div
                                key={filterId}
                                className="filter-group"
                            >
                                <label
                                    className="filter-label"
                                    htmlFor={`filter-${filterId}`}
                                >
                                    {filter.label}
                                </label>

                                <select
                                    id={`filter-${filterId}`}
                                    className="form-select"
                                    value={filter.value ?? ""}
                                    onChange={(e) =>
                                        filter.onChange?.(e.target.value)
                                    }
                                >
                                    {filter.options.map((option, optionIndex) => {
                                        const isObject =
                                            typeof option === "object" &&
                                            option !== null;

                                        const value = isObject
                                            ? option.value
                                            : option;

                                        const label = isObject
                                            ? option.label
                                            : option;

                                        return (
                                            <option
                                                key={optionIndex}
                                                value={value}
                                                disabled={
                                                    isObject
                                                        ? option.disabled
                                                        : false
                                                }
                                            >
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* RESET */}
            {onReset && (
                <div className="search-filters-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onReset}
                    >
                        Reset
                    </Button>
                </div>
            )}
        </form>
    );
}