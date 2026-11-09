export function StudentList() {

    const students = [
        {
            name: "Ali Khan",
            roll: "2026-CS-01"
        },
        {
            name: "Sara Ahmed",
            roll: "2026-CS-02"
        },
        {
            name: "Usman Tariq",
            roll: "2026-CS-03"
        }
    ];

    return (
        <div
            className="card p-5"
            style={{
                backgroundColor: "#F5F7F6"
            }}
        >

            <h2 className="text-h2 mb-4">
                Student List
            </h2>

            <table className="w-full">

                <thead>
                    <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-h4">
                            Student
                        </th>

                        <th className="text-left py-3 text-h4">
                            Roll No
                        </th>
                    </tr>
                </thead>

                <tbody>

                    {students.map((student, index) => (
                        <tr
                            key={index}
                            className="border-b border-gray-100"
                        >
                            <td className="py-3 text-body">
                                {student.name}
                            </td>

                            <td className="py-3 text-body">
                                {student.roll}
                            </td>
                        </tr>
                    ))}

                </tbody>

            </table>

        </div>
    );
}