import { DetailTable } from "../../ui/DetailTable.jsx"

export function ProgramManagement() {
    const programs = [
        {
            programName: "BS Computer Science",
            deptName: "Computer Science",
            duration: 4,
            classes: 12,
            subjects: 48,
            students: 320,
            seatCapacity: 320/400,
            programCoordinator: "Dr Sarah Khan",
            status: "Active"
        },
        {
            programName: "BS Computer Science",
            deptName: "Computer Science",
            duration: 4,
            classes: 12,
            subjects: 48,
            students: 320,
            seatCapacity: 320/400,
            programCoordinator: "Dr Sarah Khan",
            status: "Inactive"
        }
    ]
    return <>
        <div>
            <div>
                <div>
                    <h1>Program Management</h1>
                    <p>Manage institutional degree programs and their structure.</p>
                </div>
                <div>
                    <button className="btn btn-primary">+ Add Program</button>
                </div>
            </div>
            <div>
                <div>
                    <input type="text" />
                    <button className="btn btn-primary">Search</button>
                </div>
                <div>
                    <select>
                        <option>All Departments</option>
                        <option>Computer Science</option>
                        <option>Business</option>
                        <option>Engineering</option>
                    </select>
                    <select>
                        <option>All Degree Level</option>
                        <option>Undergraduate</option>
                        <option>Graduate</option>
                        <option>Masters</option>
                        <option>PhD</option>
                    </select>
                    <select>
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Archieved</option>
                    </select>
                </div>

                <DetailTable
                    columns={[
                        {key: "programName", label: "Program Name"},
                        {key: "deptName", label: "Department Name"},
                        {key: "duration", label: "Duration"},
                        {key: "classes", label: "Classes"},
                        {key: "subjects", label: "Subjects"},
                        {key: "students", label: "Students"},
                        {key: "seatCapacity", label: "Seat Capacity"},
                        {key: "programCoordinator", label: "Program Coordinator"},
                        {key: "status", label: "Status"},
                        {
                            key: "status",
                            label: "Status",
                            render: (value) => (
                                <span
                                className={
                                    value === "Active"
                                    ? "status-active"
                                    : "status-inactive"
                                }
                                >
                                {value}
                                </span>
                            ),
                        },
                    ]}
                    data={programs}
                    actions={(row) => (<div>
                        <button>Edit</button>
                        <button>Delete</button>
                    </div>)}
                />
            </div>
            <div>
                <div>
                    <h1>Name</h1>
                    <h2>Email</h2>
                    <div>
                        <p>Role badge</p>
                        <p>Status badge</p>
                    </div>
                </div>
                <div>
                    <h1>program Info</h1>
                    <ul>
                        <li>Full Name</li>
                        <li>Email</li>
                        <li>CNIC</li>
                        <li>DOB</li>
                        <li>Phone</li>
                        <li>Address</li>
                    </ul>
                </div>
                <div>
                    <h1>Academic Info</h1>
                    <ul>
                        <li>Department</li>
                        <li>Program</li>
                        <li>Section</li>
                    </ul>
                </div>
                <div>
                    <h1>System Info</h1>
                    <ul>
                        <li>Created at</li>
                        <li>Last login</li>
                        <li>Login activity</li>
                        <li>Account status</li>
                    </ul>
                </div>
                <div>
                    <h1>Security Controls</h1>
                    <ul>
                        <li>Reset Password</li>
                        <li>Suspend program</li>
                        <li>Force Logout</li>
                        <li>Delete program</li>
                    </ul>
                </div>
                <div>
                    <button>Edit program</button>
                    <button>Change Role</button>
                </div>
            </div>
        </div>
    </>
}