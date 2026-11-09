export function AttendancePanel() {

    return (
        <div
            className="card p-5"
            style={{
                backgroundColor: "#F5F7F6"
            }}
        >

            <h2 className="text-h2 mb-4">
                Mark Attendance
            </h2>

            <div className="flex flex-col gap-4">

                <select className="input w-full">
                    <option>Select Class</option>
                    <option>BSCS-1A</option>
                </select>

                <input
                    type="date"
                    className="input w-full"
                />

                <button className="btn-primary py-2">
                    Mark Attendance
                </button>

            </div>

        </div>
    );
}