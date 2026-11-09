export function AssignedClasses() {

    const classes = [
        {
            name: "BSCS-1A",
            subject: "Programming Fundamentals"
        },
        {
            name: "BSSE-2B",
            subject: "Database Systems"
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
                Assigned Classes
            </h2>

            <div className="flex flex-col gap-4">

                {classes.map((item, index) => (
                    <div
                        key={index}
                        className="flex justify-between items-center border-b border-gray-200 pb-3"
                    >
                        <div>
                            <h4 className="text-h4">
                                {item.name}
                            </h4>

                            <p className="text-small text-gray-500">
                                {item.subject}
                            </p>
                        </div>

                        <button className="btn-primary px-4 py-2">
                            View
                        </button>
                    </div>
                ))}

            </div>

        </div>
    );
}