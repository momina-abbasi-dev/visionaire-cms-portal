
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

export function AcademicTree({
    tree = [],
    expandedDepts = {},
    expandedPrograms = {},
    expandedClasses = {},
    onToggleDept,
    onToggleProgram,
    onToggleClass,
}) {
    if (!tree.length) {
        return (
            <div className="empty-state">
                <p className="empty-state-description">
                    No academic relationships found.
                </p>
            </div>
        );
    }

    const ToggleIcon = ({ expanded }) => (
        <FontAwesomeIcon
            icon={expanded ? faChevronDown : faChevronRight}
            className="academic-tree-toggle-icon"
        />
    );

    const TreeBadge = ({ children }) => (
        <span className="academic-tree-badge">{children}</span>
    );

    return (
        <div className="academic-tree" role="tree">
            {tree.map((department) => {
                const departmentExpanded =
                    Boolean(expandedDepts[department._id]);
                const programs = department.programs || [];

                return (
                    <div
                        key={department._id}
                        className="academic-tree-node academic-tree-node-department"
                        role="treeitem"
                        aria-expanded={departmentExpanded}
                    >
                        <button
                            type="button"
                            className="academic-tree-item academic-tree-department"
                            onClick={() => onToggleDept(department._id)}
                            aria-expanded={departmentExpanded}
                        >
                            <span className="academic-tree-toggle">
                                <ToggleIcon expanded={departmentExpanded} />
                            </span>

                            <span className="academic-tree-content">
                                <span className="academic-tree-label">
                                    {department.name}
                                </span>

                                <span className="academic-tree-meta">
                                    Department
                                </span>
                            </span>

                            <TreeBadge>
                                {programs.length}{" "}
                                {programs.length === 1
                                    ? "program"
                                    : "programs"}
                            </TreeBadge>
                        </button>

                        {departmentExpanded && (
                            <div className="academic-tree-children">
                                {!programs.length && (
                                    <div className="academic-tree-empty">
                                        No programs in this department.
                                    </div>
                                )}

                                {programs.map((program) => {
                                    const programExpanded =
                                        Boolean(
                                            expandedPrograms[program._id]
                                        );
                                    const classes = program.classes || [];

                                    return (
                                        <div
                                            key={program._id}
                                            className="academic-tree-node academic-tree-node-program"
                                            role="treeitem"
                                            aria-expanded={programExpanded}
                                        >
                                            <button
                                                type="button"
                                                className="academic-tree-item academic-tree-program"
                                                onClick={() =>
                                                    onToggleProgram(program._id)
                                                }
                                                aria-expanded={programExpanded}
                                            >
                                                <span className="academic-tree-toggle">
                                                    <ToggleIcon
                                                        expanded={programExpanded}
                                                    />
                                                </span>

                                                <span className="academic-tree-content">
                                                    <span className="academic-tree-label">
                                                        {program.name}
                                                    </span>

                                                    <span className="academic-tree-meta">
                                                        Program
                                                    </span>
                                                </span>

                                                <TreeBadge>
                                                    {classes.length}{" "}
                                                    {classes.length === 1
                                                        ? "class"
                                                        : "classes"}
                                                </TreeBadge>
                                            </button>

                                            {programExpanded && (
                                                <div className="academic-tree-children">
                                                    {!classes.length && (
                                                        <div className="academic-tree-empty">
                                                            No classes in this program.
                                                        </div>
                                                    )}

                                                    {classes.map(
                                                        (academicClass) => {
                                                            const classExpanded =
                                                                Boolean(
                                                                    expandedClasses[
                                                                        academicClass._id
                                                                    ]
                                                                );

                                                            return (
                                                                <div
                                                                    key={academicClass._id}
                                                                    className="academic-tree-node academic-tree-node-class"
                                                                    role="treeitem"
                                                                    aria-expanded={classExpanded}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="academic-tree-item academic-tree-class"
                                                                        onClick={() =>
                                                                            onToggleClass(
                                                                                academicClass._id
                                                                            )
                                                                        }
                                                                        aria-expanded={classExpanded}
                                                                    >
                                                                        <span className="academic-tree-toggle">
                                                                            <ToggleIcon
                                                                                expanded={classExpanded}
                                                                            />
                                                                        </span>

                                                                        <span className="academic-tree-content">
                                                                            <span className="academic-tree-label">
                                                                                {academicClass.name}
                                                                                {academicClass.section
                                                                                    ? ` — ${academicClass.section}`
                                                                                    : ""}
                                                                            </span>

                                                                            <span className="academic-tree-meta">
                                                                                Class / Section
                                                                            </span>
                                                                        </span>

                                                                        <TreeBadge>
                                                                            Semester{" "}
                                                                            {academicClass.semester ??
                                                                                "—"}
                                                                        </TreeBadge>
                                                                    </button>

                                                                    {classExpanded && (
                                                                        <div className="academic-tree-children">
                                                                            <div className="academic-tree-item academic-tree-detail">
                                                                                <span className="academic-tree-toggle academic-tree-toggle-placeholder" />

                                                                                <span className="academic-tree-content">
                                                                                    <span className="academic-tree-label">
                                                                                        Semester
                                                                                    </span>

                                                                                    <span className="academic-tree-meta">
                                                                                        {academicClass.semester != null
                                                                                            ? `Semester ${academicClass.semester}`
                                                                                            : "Not specified"}
                                                                                    </span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}