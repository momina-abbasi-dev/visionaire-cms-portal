import { useState, useEffect } from "react";
import { getAcademicStructureStats } from "../../services/academicStructureService.js"

export function useAcademicStructureStats() {
    const [stats, setStats] = useState({
        departments: 0,
        programs: 0,
        classes: 0,
        subjects: 0,
        teachers: 0,
        students: 0
    })
    const [loading, setLoading] = useState(true)
    const fetchStats = async() => {
        try {
            const res = await getAcademicStructureStats();
            setStats(res.data);
        } catch(error) {
            console.log(error, "Failed to fetch Stats")
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        fetchStats();
    }, []);
    return {
        stats,
        loading,
        refreshStats: fetchStats
    }
}