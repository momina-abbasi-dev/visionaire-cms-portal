export function Profile() {
    return (
        <div className="card flex flex-col md:flex-row items-center justify-between p-6"
            style={{
                backgroundColor: "#F5F7F6"
        }}>
            <div className="flex items-center gap-5">
                {/* <img
                    src="https://via.placeholder.com/80"
                    alt="Student"
                    className="rounded-full w-20 h-20"
                /> */}
                <div>
                    <h1 className="text-h1">
                        Salman Ahmed
                    </h1>
                    <p className="text-body text-gray-500">
                        BS Computer Science
                    </p>
                    <p className="text-small text-gray-500">
                        Roll No: EDU-2026-102
                    </p>
                </div>
            </div>

            <div className="mt-4 md:mt-0">
                <button className="btn-primary px-4 py-2">
                    View Profile
                </button>
            </div>
        </div>
    );
}