import { useEffect, useState } from "react";
import { getAdmissionStats } from "../../services/admissionService.js";

export function useAdmissionStats() {
    const [stats, setStats] = useState({
        totalApplications: 0,
        pendingReview: 0,
        approved: 0,
        rejected: 0,
        missingDocuments: 0,
        admissionsThisSemester: 0
    });

    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await getAdmissionStats();

            setStats(res.data);
        } catch (error) {
            console.error("Failed to fetch admission stats", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return {
        stats,
        loading,
        refreshStats: fetchStats
    };
}