export function PerformanceCard() {

    const stats = [
        {
            title: "Attendance",
            value: "92%"
        },

        {
            title: "CGPA",
            value: "3.72"
        },

        {
            title: "Assignments",
            value: "18"
        },

        {
            title: "Subjects",
            value: "6"
        }
    ];

    return (

        <div className="flex flex-row gap-6 mt-4">
            {stats.map((stat, index) => (
                <div
                    key={index} className="card w-1/4 h-24 flex flex-col items-center justify-center gap-1" style={{
                        backgroundColor: "#F5F7F6",
                    }}
                >
                    <h3 className="text-h4 text-gray-500">
                        {stat.title}
                    </h3>
                    <h1 className="text-h1">
                        {stat.value}
                    </h1>
                </div>
            ))}
        </div>
    );
}