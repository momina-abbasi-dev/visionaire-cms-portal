export function RecentAdmissions() {
    const admissions = [
        {
            id: "cs-123",
            name: "Ali Khan",
            program: "BSCS",
            status: "Active"
        },
        {
            id: "ba-123",
            name: "Sara Ahmed",
            program: "BBA",
            status: "Pending"
        },
        {
            id: "se-123",
            name: "Usman Tariq",
            program: "BSSE",
            status: "Active"
        },
        {
            id: "cs-321",
            name: "Sidra Khan",
            program: "BSCS",
            status: "Active"
        }
    ];
    return <>
        <div className="flex flex-col card p-4 h-full" style={{
            backgroundColor: "#F5F7F6",
        }}>
            <div>
                <h2 className="text-h2 p-1 mb-4">Recent Admissions</h2>
            </div>
            <div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-h3 py-2 px-4 text-gray-500">Name</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Program</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                    {admissions.map((admission) => (
                        <tr key={admission.id} className="border-b border-gray-200">
                            <td className="text-body py-2 px-4 font-medium">{admission.name}</td>
                            <td className="text-body py-2 px-4">{admission.program}</td>
                            <td className="text-body py-2 px-4">{admission.status}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    </>
}