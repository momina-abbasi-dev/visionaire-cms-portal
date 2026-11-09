export function StatusPanel() {
    const systems = [
        { name: "System Status", status: "Active", type: "Health" },
        { name: "Database Status", status: "Healthy", type: "Health" },
        { name: "Server Status", status: "Online", type: "Health" },
        { name: "Pending Admissions", status: "12", type: "Warning" },
        { name: "Unpaid Fees", status: "8", type: "Warning" },
        { name: "Attendance Pending", status: "3", type: "Warning" },
        { name: "Admin Users", status: "1", type: "Role Summary" },
        { name: "Teachers", status: "25", type: "Role Summary" },
        { name: "Students", status: "240", type: "Role Summary" },
    ];
    return <>
        <div className="flex flex-col card p-4" style={{
            backgroundColor: "#F5F7F6",
        }}>
            <div>
                <h2 className="text-h2 p-1 mb-4">System Panel</h2>
            </div>
            <div>
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="text-h3 py-2 px-4 text-gray-500">Type</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Name</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                {systems.map((system, index) => (
                    system.type == "Health" ?
                        <tr key={index} className="border-b border-gray-200">
                            <td className="text-body py-2 px-4 font-medium">{system.type}</td>
                            <td className="text-body py-2 px-4">{system.name}</td>
                            <td className="text-body py-2 px-4">{system.status}</td>
                        </tr>
                    : system.type == "Warning" ?
                        <tr key={index} className="border-b border-gray-200">
                            <td className="text-body py-2 px-4 font-medium">{system.type}</td>
                            <td className="text-body py-2 px-4">{system.name}</td>
                            <td className="text-body py-2 px-4">{system.status}</td>
                        </tr>
                    :
                        <tr key={index} className="border-b border-gray-200">
                            <td className="text-body py-2 px-4 font-medium">{system.type}</td>
                            <td className="text-body py-2 px-4">{system.name}</td>
                            <td className="text-body py-2 px-4">{system.status}</td>
                        </tr>
                ))}
                    </tbody>
                </table>
            </div>
        </div>
    </>
}