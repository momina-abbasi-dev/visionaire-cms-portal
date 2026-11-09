
import Department from "../models/Department.js";
import Program from "../models/Program.js";
import ClassSection from "../models/ClassSection.js";
import Subject from "../models/Subject.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";

const getAcademicStructureStats = async (req, res) => {
    try {
        const [
            departments,
            programs,
            classes,
            subjects,
            teachers,
            students,
        ] = await Promise.all([
            Department.countDocuments(),
            Program.countDocuments(),
            ClassSection.countDocuments(),
            Subject.countDocuments(),
            Teacher.countDocuments(),
            Student.countDocuments(),
        ]);

        return res.status(200).json({
            departments,
            programs,
            classes,
            subjects,
            teachers,
            students,
        });
    } catch (error) {
        console.error("Academic structure stats error:", error);

        return res.status(500).json({
            message: "Failed to retrieve academic structure statistics.",
        });
    }
};

const getRelationshipTree = async (req, res) => {
    try {
        const [departments, programs, classes] = await Promise.all([
            Department.find().sort({ name: 1 }).lean(),
            Program.find().sort({ name: 1 }).lean(),
            ClassSection.find()
                .sort({ semester: 1, name: 1, section: 1 })
                .lean(),
        ]);

        const classesByProgram = new Map();

        for (const classSection of classes) {
            const programId = String(classSection.program);

            if (!classesByProgram.has(programId)) {
                classesByProgram.set(programId, []);
            }

            classesByProgram.get(programId).push(classSection);
        }

        const programsByDepartment = new Map();

        for (const program of programs) {
            const departmentId = String(program.department);

            if (!programsByDepartment.has(departmentId)) {
                programsByDepartment.set(departmentId, []);
            }

            programsByDepartment.get(departmentId).push({
                ...program,
                classes: classesByProgram.get(String(program._id)) || [],
            });
        }

        const tree = departments.map((department) => ({
            ...department,
            programs:
                programsByDepartment.get(String(department._id)) || [],
        }));

        return res.status(200).json(tree);
    } catch (error) {
        console.error("Academic relationship tree error:", error);

        return res.status(500).json({
            message: "Failed to retrieve the academic relationship tree.",
        });
    }
};

export {
    getAcademicStructureStats,
    getRelationshipTree,
};
