import { useEffect, useState } from "react"
import { getDepartments } from "../../../services/departmentService";
import { DetailTable } from "../../ui/DetailTable";

export function DepartmentManagement() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await getDepartments();
                setDepartments(res.data);
            } catch (error) {
                console.log(error)
            } finally {
                setLoading(false);
            }
        }
        fetchDepartments();
    }, [])
    // const departments = [
    //     {
    //         name: "Computer Science",
    //         code: "CS",
    //         programs: 3,
    //         classes: 8,
    //         teachers: 13,
    //         students: 209,
    //         seatCapacity: 209/450,
    //         status: "Active"
    //     }
    // ]

    if (loading) {
        return <div>Loading Section....</div>
    }

    return <>
        <div>
            <div className="flex flex-row justify-between items-center">
                <div>
                    <h1>Department Management</h1>
                    <p>Manage academic departments and their hierarchy.</p>
                </div>
                <div>
                    <button className="btn btn-primary">+ Add Department</button>
                </div>
            </div>
            <div className="flex flex-row justify-between">
                <div className="flex flex-row">
                    <input className="input" type="text" />
                    <button className="btn btn-primary">Search</button>
                </div>
                <div>
                    <select>
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Archieved</option>
                    </select>
                    <select>
                        <option>Full Capacity</option>
                        <option>High Enrollment</option>
                        <option>Low Enrollment</option>
                    </select>
                </div>
            </div>
            {/* <DetailTable/> */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Department Name</th>
                            <th>Department Code</th>
                            <th>Total Programs</th>
                            <th>Total Classes</th>
                            <th>Teachers</th>
                            <th>Students</th>
                            <th>Seat Capacity</th>
                            <th>Status Badge</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        { departments.map((dept, index) => (
                            <tr key={index}>
                                <th>{dept.name}</th>
                                <th>{dept.code}</th>
                                <th>{dept.programs}</th>
                                <th>{dept.classes}</th>
                                <th>{dept.teachers}</th>
                                <th>{dept.students}</th>
                                <th>{dept.seatCapacity}</th>
                                <th>{dept.status}</th>
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
                    <h1>dept Info</h1>
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
                        <li>Suspend dept</li>
                        <li>Force Logout</li>
                        <li>Delete dept</li>
                    </ul>
                </div>
                <div>
                    <button>Edit dept</button>
                    <button>Change Role</button>
                </div>
            </div>
        </div>
    </>
}