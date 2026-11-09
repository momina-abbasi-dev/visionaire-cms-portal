export function SecurityControls({
  status,
  onSuspend,
  onActivate,
  onResetPassword,
  onDelete,
}) {
  const isActive = status === "active";

  return (
    <div className="security-controls">

      {/* Account Status */}
      <div className="security-section">
        <div className="security-section-header">
          <div>
            <h3 className="security-section-title">Account Status</h3>
            <p className="security-section-description">
              Current status of this user account.
            </p>
          </div>
        </div>

        <div className="security-status">
          <span
            className={
              isActive
                ? "status status-active"
                : "status status-suspended"
            }
          >
            {status || "unknown"}
          </span>
        </div>
      </div>

      {/* Status Actions */}
      <div className="security-section">
        <div className="security-section-header">
          <div>
            <h3 className="security-section-title">Status Actions</h3>
            <p className="security-section-description">
              Manage the user's account availability.
            </p>
          </div>
        </div>

        <div className="security-actions">
          {isActive ? (
            <button
              type="button"
              className="btn btn-warning"
              onClick={onSuspend}
            >
              Suspend User
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-success"
              onClick={onActivate}
            >
              Activate User
            </button>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="security-section">
        <div className="security-section-header">
          <div>
            <h3 className="security-section-title">Password</h3>
            <p className="security-section-description">
              Reset the user's account password.
            </p>
          </div>
        </div>

        <div className="security-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResetPassword}
          >
            Reset Password
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="security-danger-zone">
        <div className="security-section-header">
          <div>
            <h3 className="security-danger-title">Danger Zone</h3>
            <p className="security-danger-description">
              Irreversible and destructive account actions.
            </p>
          </div>
        </div>

        <div className="security-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={onDelete}
          >
            Delete User
          </button>
        </div>

        <p className="security-danger-note">
          Deleting a user is permanent and cannot be undone.
        </p>
      </div>

    </div>
  );
}