import { data } from "autoprefixer";

export function RecentTeachers({data = []}) {
    // const teachers = [
    //     {
    //         id: "cs-123",
    //         name: "Ali Khan",
    //         program: "BSCS",
    //         status: "Active"
    //     },
    //     {
    //         id: "ba-123",
    //         name: "Sara Ahmed",
    //         program: "BBA",
    //         status: "Pending"
    //     },
    //     {
    //         id: "se-123",
    //         name: "Usman Tariq",
    //         program: "BSSE",
    //         status: "Active"
    //     },
    //     {
    //         id: "cs-321",
    //         name: "Sidra Khan",
    //         program: "BSCS",
    //         status: "Active"
    //     }
    // ];
    return <>
        <div className="flex flex-col card p-4" style={{
            backgroundColor: "#F5F7F6",
        }}>
            <div>
                <h2 className="text-h2 p-1 mb-4">Recent Teachers</h2>
            </div>
            <div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-h3 py-2 px-4 text-gray-500">Name</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Department</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Subject</th>
                            <th className="text-h3 py-2 px-4 text-gray-500">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                    {data.map((teacher, index) => (
                        <tr key={index} className="border-b border-gray-200">
                            <td className="text-body py-2 px-4 font-medium">{teacher.name}</td>
                            <td className="text-body py-2 px-4">{teacher.department.name}</td>
                            {/* <td className="text-body py-2 px-4">{teacher.subjects.name}</td> */}
                            {/* <td className="text-body py-2 px-4">{teacher.status}</td> */}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    </>
}