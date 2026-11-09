export function MarksTable() {

    const marks = [
        {
            subject: "Calculus",
            marks: 88,
            grade: "A"
        },

        {
            subject: "ICT",
            marks: 81,
            grade: "A-"
        },

        {
            subject: "Artificial Intelligence",
            marks: 75,
            grade: "B+"
        }
    ];

    return (

        <div
            className="card p-5 overflow-x-auto"
            style={{
                backgroundColor: "#F5F7F6"
            }}
        >

            <h2 className="text-h2 mb-5">
                Recent Marks
            </h2>

            <table className="w-full text-left">

                <thead>

                    <tr className="border-b border-gray-200">

                        <th className="py-3">
                            Subject
                        </th>

                        <th className="py-3">
                            Marks
                        </th>

                        <th className="py-3">
                            Grade
                        </th>

                    </tr>

                </thead>

                <tbody>

                    {marks.map((item, index) => (

                        <tr
                            key={index}
                            className="border-b border-gray-100"
                        >

                            <td className="py-4">
                                {item.subject}
                            </td>

                            <td className="py-4">
                                {item.marks}
                            </td>

                            <td className="py-4">
                                {item.grade}
                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>

    );
}