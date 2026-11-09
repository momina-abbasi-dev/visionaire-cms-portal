export function DetailGrid({ items = [], columns = 1 }) {
  return (
    <div
      className={`detail-grid detail-grid-${columns}`}
    >
      {items.map((item) => (
        <div
          key={item.id || item.label}
          className="detail-row"
        >
          <span className="detail-label">
            {item.label}
          </span>

          <span
            className={`detail-value ${
              item.valueClass || ""
            }`}
          >
            {item.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}