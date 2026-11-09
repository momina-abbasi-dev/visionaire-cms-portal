export function Attendance() {

    const attendance = [
        {
            subject: "Calculus",
            percentage: "95%"
        },

        {
            subject: "ICT",
            percentage: "88%"
        },

        {
            subject: "Artificial Intelligence",
            percentage: "91%"
        }
    ];

    return (

        <div
            className="card p-5 mt-4"
            style={{
                backgroundColor: "#F5F7F6"
            }}
        >

            <h2 className="text-h2 mb-5">
                Attendance Overview
            </h2>

            <div className="flex flex-col gap-4">

                {attendance.map((item, index) => (

                    <div
                        key={index}
                        className="flex justify-between items-center"
                    >

                        <div>

                            <h4 className="text-h4">
                                {item.subject}
                            </h4>

                        </div>

                        <div>

                            <span
                                className="px-3 py-1 rounded-full text-small"
                                style={{
                                    backgroundColor: "#EAF5E4",
                                    color: "#6FAE5E"
                                }}
                            >
                                {item.percentage}
                            </span>

                        </div>

                    </div>

                ))}

            </div>

        </div>

    );
}