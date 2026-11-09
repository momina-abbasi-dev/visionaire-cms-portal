export function Stats() {

    const stats = [
        {
            title: "Assigned Classes",
            value: 5
        },
        {
            title: "Total Students",
            value: 184
        },
        {
            title: "Attendance Rate",
            value: "91%"
        },
        {
            title: "Pending Marks",
            value: 12
        }
    ];

    return (
        <div className="flex gap-6">

            {stats.map((stat, index) => (
                <div
                    key={index}
                    className="card flex-1 p-5"
                    style={{
                        backgroundColor: "#F5F7F6"
                    }}
                >
                    <h4 className="text-h4 mb-2">
                        {stat.title}
                    </h4>

                    <h2 className="text-h2">
                        {stat.value}
                    </h2>
                </div>
            ))}

        </div>
    );
}