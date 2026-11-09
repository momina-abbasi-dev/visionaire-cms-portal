import { useEffect, useState } from "react";
import { getAcademicRecordStats } from "../../services/academicRecordService.js";

export function useAcademicRecordStats() {

    const [stats, setStats] = useState({
        totalRecords: 0,
        submittedByTeachers: 0,
        pendingReview: 0,
        verifiedRecords: 0,
        needsCorrection: 0,
        activeClasses: 0
    });

    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await getAcademicRecordStats();
            console.log(res.data)
            setStats(res.data);
        } catch (error) {
            console.error(error);
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