export function QuickActions() {
    const buttons = [
        {
            title: "Add Student"
        },
        {
            title: "Add Teacher"
        },
        {
            title: "Create Class"
        },
        {
            title: "Add Subject"
        },
        {
            title: "Create Admission"
        },
        {
            title: "Generate Fee Challan"
        },
        {
            title: "Send Notification"
        },
    ]
    return <>
        <div className="flex flex-col card p-4" style={{
            backgroundColor: "#F5F7F6",
        }}>
            <div>
                <h2 className="text-h2 p-1 mb-4">Quick Actions</h2>
            </div>
            <div className="flex flex-col gap-3">
            {
                buttons.map((button, index) => (
                    <div key={index}>
                        <button className="w-full py-1 px-4 card">{button.title}</button>
                    </div>
                ))
            }
            </div>
        </div>
    </>
}