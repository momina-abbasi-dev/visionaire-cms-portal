export function ClassSectionManagement() {
    const classes = [
        {
            className: "BSCS-1A",
            programName: "BS Computer Science",
            deptName: "Computer Science",
            advisor: "Dr Admed Hassan",
            subjects: 6,
            students: 42,
            room: 304,
            schedule: "(Mon - Fri): 9 AM - 1 PM",
            status: "Active"
        }
    ]
    return <>
        <div>
            <div>
                <div>
                    <h1>Class & Section Management</h1>
                    <p>Manage academic classes, sections, teachers, and enrollment.</p>
                </div>
                <div>
                    <button className="btn btn-primary">+ Add Class</button>
                </div>
            </div>
            <div>
                <div>
                    <input type="text" />
                    <button className="btn btn-primary">Search</button>
                </div>
                <div>
                    <select>
                        <option>All Programs</option>
                        <option>BSCS</option>
                        <option>BBA</option>
                        <option>BSSE</option>
                    </select>
                    <select>
                        <option>All Departments</option>
                        <option>Computer Science</option>
                        <option>Business</option>
                        <option>Engineering</option>
                    </select>
                    <select>
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Archieved</option>
                    </select>
                    <select>
                        <option>All Rooms</option>
                        <option>Labs</option>
                        <option>Lecture Rooms</option>
                        <option>Authorium</option>
                    </select>
                </div>
                <div className="table-container">
                    <table className="table">
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>Program Name</th>
                            <th>Department Name</th>
                            <th>Class Advisor</th>
                            <th>Subjects</th>
                            <th>Students</th>
                            <th>Room</th>
                            <th>Schedule</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        { classes.map((cls, index) => (
                            <tr key={index}>
                                <th>{cls.className}</th>
                                <th>{cls.programName}</th>
                                <th>{cls.deptName}</th>
                                <th>{cls.advisor}</th>
                                <th>{cls.subjects}</th>
                                <th>{cls.students}</th>
                                <th>{cls.room}</th>
                                <th>{cls.schedule}</th>
                                <th>{cls.status}</th>
                                <th>
                                    <button className="btn btn-ghost">View</button>
                                    <button className="btn btn-ghost">Edit</button>
                                    <button className="btn btn-danger">Delete</button>
                                </th>
                            </tr>
                        )) }
                    </tbody>
                    </table>
                </div>
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
                    <h1>cls Info</h1>
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
                        <li>Suspend cls</li>
                        <li>Force Logout</li>
                        <li>Delete cls</li>
                    </ul>
                </div>
                <div>
                    <button>Edit cls</button>
                    <button>Change Role</button>
                </div>
            </div>
        </div>
    </>
}