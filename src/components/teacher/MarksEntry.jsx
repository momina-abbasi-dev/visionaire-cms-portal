export function MarksEntry() {

    return (
        <div
            className="card p-5"
            style={{
                backgroundColor: "#F5F7F6"
            }}
        >

            <h2 className="text-h2 mb-4">
                Enter Marks
            </h2>

            <div className="flex flex-col gap-4">

                <input
                    type="text"
                    placeholder="Student Roll No"
                    className="input w-full"
                />

                <input
                    type="number"
                    placeholder="Marks"
                    className="input w-full"
                />

                <button className="btn-primary py-2">
                    Submit Marks
                </button>

            </div>

        </div>
    );
}