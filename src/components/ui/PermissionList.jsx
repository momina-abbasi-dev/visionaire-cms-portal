export function PermissionList({
  permissions = [],
  selectedPermissions = [],
  onChange,
}) {
  return (
    <div className="permission-list">
      {permissions.map((permission) => (
        <label
          key={permission}
          className="permission-item"
        >
          <input
            type="checkbox"
            checked={selectedPermissions.includes(permission)}
            onChange={() => onChange(permission)}
          />

          <span className="permission-label">
            {permission}
          </span>
        </label>
      ))}
    </div>
  );
}