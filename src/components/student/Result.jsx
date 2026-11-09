export function Result() {

    return (

        <div
            className="card p-5 flex flex-col gap-4 mt-4"
            style={{
                backgroundColor: "#F5F7F6"
            }}
        >

            <h2 className="text-h2">
                Result Summary
            </h2>

            <div className="flex justify-between">

                <span className="text-body">
                    Total Marks
                </span>

                <span className="text-h4">
                    540
                </span>

            </div>

            <div className="flex justify-between">

                <span className="text-body">
                    Obtained Marks
                </span>

                <span className="text-h4">
                    472
                </span>

            </div>

            <div className="flex justify-between">

                <span className="text-body">
                    Percentage
                </span>

                <span className="text-h4">
                    87%
                </span>

            </div>

            <div className="flex justify-between">

                <span className="text-body">
                    Grade
                </span>

                <span
                    className="px-3 py-1 rounded-full text-small"
                    style={{
                        backgroundColor: "#EAF5E4",
                        color: "#6FAE5E"
                    }}
                >
                    A
                </span>

            </div>

        </div>

    );
}