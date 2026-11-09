export function SystemActivity() {
    const activities = [
        { text: "New Student Ali Khan added", timestamp: "2 min ago" },
        { text: "John Doe enrolled in Computer Science", timestamp: "10 min ago" },
        { text: "Jane Smith's grade updated to A-", timestamp: "20 min ago" },
        { text: "Mark Johnson marked absent for Math class", timestamp: "30 min ago" },
        { text: "Emily Davis paid tuition fee", timestamp: "1 hour ago" },
    ];
    return <>
        <div className="flex flex-col card p-4" style={{
            backgroundColor: "#F5F7F6",
        }}>
            <div>
                <h2 className="text-h2 p-1 mb-4">System Activity Feed</h2>
            </div>
            <div>
                {activities.map((activity, index) => (
                    <div key={index} className="flex flex-row justify-between items-center gap-1 p-2 border-b last:border-b-0 border-gray-200">
                        <h4 className="text-h4">{activity.text}</h4>
                        <div className="flex flex-row gap-3 items-center justify-end">
                            <p className="text-small text-gray-500">{activity.timestamp}</p>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </>
}