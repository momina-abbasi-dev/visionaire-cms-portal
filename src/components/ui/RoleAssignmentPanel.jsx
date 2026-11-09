export function RoleAssignmentPanel({roles = [], selectedRole, onRoleChange, permissions = [], selectedPermissions = [], onPermissionChange}) {
    const handlePermissionToggle = (permission) => {
        const exists = selectedPermissions.includes(permission);
        if (exists) {
            onPermissionChange(selectedPermissions.filter(p => p !== permission))
        } else {
            onPermissionChange([...selectedPermissions, permission])
        }
    }
    return <>
        <div>
            <div>
                <label>Role: </label>
                <select value={selectedRole} onChange={(e) => onRoleChange(e.target.value)}>
                    <option value="">Select Role</option>
                    { roles.map((role) => (
                        <option key={role.value} value={role.value}>
                            {role.label}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <h4>Permissions</h4>
            </div>
            <div>
                { permissions.map((permission) => (
                    <label key={permission}>
                        <input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => handlePermissionToggle(permission)} />
                        <span>{permission}</span>
                    </label>
                ))}
            </div>
        </div>
    </>
}