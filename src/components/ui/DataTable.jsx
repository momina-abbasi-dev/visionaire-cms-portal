export function DataTable({
    columns = [],
    data = [],
    actions,
    emptyMessage = "No data found",
    className = "",
}) {
    const tableClasses = [
        "data-table",
        className,
    ].filter(Boolean).join(" ");

    const getRowKey = (row, index) =>
        row._id ?? row.id ?? index;

    const getColumnKey = (column, index) =>
        column.id ?? column.key ?? index;

    return (
        <div className="table-container">
            <table className={tableClasses}>
                <thead>
                    <tr>
                        {columns.map((column, index) => (
                            <th
                                key={getColumnKey(column, index)}
                                className={column.headerClassName || ""}
                            >
                                {column.label}
                            </th>
                        ))}

                        {actions && <th>Actions</th>}
                    </tr>
                </thead>

                <tbody>
                    {data.length > 0 ? (
                        data.map((row, rowIndex) => (
                            <tr key={getRowKey(row, rowIndex)}>
                                {columns.map((column, columnIndex) => {
                                    const value = row[column.key];

                                    return (
                                        <td
                                            key={getColumnKey(
                                                column,
                                                columnIndex
                                            )}
                                            className={column.className || ""}
                                        >
                                            {column.render
                                                ? column.render(value, row)
                                                : value ?? "—"}
                                        </td>
                                    );
                                })}

                                {actions && (
                                    <td>
                                        <div className="table-actions">
                                            {actions(row)}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td
                                colSpan={
                                    columns.length + (actions ? 1 : 0)
                                }
                                className="table-empty"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}