import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import AcademicAssignment from "../../models/AcademicAssignment.js";
import AcademicRecord from "../../models/AcademicRecord.js";
import AcademicSession from "../../models/AcademicSession.js";
import Attendance from "../../models/Attendance.js";
import ClassSection from "../../models/ClassSection.js";
import Department from "../../models/Department.js";
import FeeRecord from "../../models/FeesFinance.js";
import Program from "../../models/Program.js";
import Result from "../../models/Result.js";
import Student from "../../models/Student.js";
import StudentEnrollment from "../../models/StudentEnrollment.js";
import Subject from "../../models/Subject.js";
import Teacher from "../../models/Teacher.js";
import User from "../../models/User.js";

export const TEST_JWT_SECRET =
    "visionaire-educore-integration-tests-only-secret";

export const configureTestAuthentication = () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
};

const uniqueSuffix = () => randomUUID().replaceAll("-", "");

export const createAuthenticatedUser = async (
    role = "admin",
    overrides = {}
) => {
    configureTestAuthentication();
    const suffix = uniqueSuffix();
    const user = await User.create({
        name: `Test ${role} ${suffix}`,
        cnic: `TEST-${suffix}`,
        email: `${role}-${suffix}@example.test`,
        password: "test-password",
        role,
        status: "active",
        ...overrides,
    });

    return {
        user,
        token: jwt.sign(
            { id: user._id, role: user.role },
            TEST_JWT_SECRET,
            { expiresIn: "5m" }
        ),
    };
};

export const createAdminUser = (overrides = {}) =>
    createAuthenticatedUser("admin", overrides);

export const createDepartment = (overrides = {}) => {
    const suffix = uniqueSuffix();
    return Department.create({
        name: `Test Department ${suffix}`,
        code: `TD${suffix.slice(0, 8)}`,
        totalSeats: 100,
        availableSeats: 100,
        ...overrides,
    });
};

export const createProgram = async (overrides = {}) => {
    const department = overrides.department || await createDepartment();
    const suffix = uniqueSuffix();
    return Program.create({
        name: `Test Program ${suffix}`,
        duration: 4,
        totalSeats: 20,
        availableSeats: 20,
        department: department._id,
        ...overrides,
    });
};

export const createStudent = async (overrides = {}) => {
    const program = overrides.program || await createProgram();
    const suffix = uniqueSuffix();
    return Student.create({
        name: `Test Student ${suffix}`,
        rollNo: `TR-${suffix}`,
        email: `student-${suffix}@example.test`,
        cnic: `ST-${suffix}`,
        dob: new Date("2005-01-01T00:00:00.000Z"),
        contact: "0000000000",
        address: "Test address",
        city: "Test city",
        program: program._id,
        status: "active",
        ...overrides,
    });
};

export const createAcademicSession = async (createdBy, overrides = {}) => {
    const actor = createdBy || (await createAdminUser()).user;
    const suffix = uniqueSuffix();
    return AcademicSession.create({
        name: `Test Session ${suffix}`,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        status: "planned",
        createdBy: actor._id,
        updatedBy: actor._id,
        ...overrides,
    });
};

export const createClassSection = async (program, overrides = {}) => {
    const selectedProgram = program || await createProgram();
    const suffix = uniqueSuffix();
    return ClassSection.create({
        name: `Test Class ${suffix}`,
        section: "A",
        semester: 1,
        program: selectedProgram._id,
        department: selectedProgram.department,
        ...overrides,
    });
};

export const createTeacher = async (department, createdBy, overrides = {}) => {
    const selectedDepartment = department || await createDepartment();
    const actor = createdBy || (await createAdminUser()).user;
    const suffix = uniqueSuffix();
    return Teacher.create({
        name: `Test Teacher ${suffix}`,
        registrationNo: `TRG-${suffix}`,
        email: `teacher-${suffix}@example.test`,
        cnic: `TC-${suffix}`,
        contact: "0000000000",
        dob: new Date("1980-01-01T00:00:00.000Z"),
        address: "Test address",
        city: "Test city",
        education: "Test qualification",
        department: selectedDepartment._id,
        role: "junior",
        createdBy: actor._id,
        ...overrides,
    });
};

export const createSubject = async (program, overrides = {}) => {
    const selectedProgram = program || await createProgram();
    const suffix = uniqueSuffix();
    return Subject.create({
        name: `Test Subject ${suffix}`,
        code: `TS${suffix.slice(0, 8)}`,
        creditHours: 3,
        program: selectedProgram._id,
        department: selectedProgram.department,
        ...overrides,
    });
};

export const createAcademicAssignment = async (
    { teacher, subject, classSection, session } = {},
    overrides = {}
) => {
    const selectedClass = classSection || await createClassSection();
    const selectedProgram = await Program.findById(selectedClass.program);
    const selectedTeacher =
        teacher ||
        await createTeacher(
            await Department.findById(selectedProgram.department)
        );
    const selectedSubject = subject || await createSubject(selectedProgram);
    return AcademicAssignment.create({
        teacher: selectedTeacher._id,
        subject: selectedSubject._id,
        classSection: selectedClass._id,
        session: session || "2026",
        isActive: true,
        ...overrides,
    });
};

export const createStudentEnrollment = async (
    { student, classSection, academicSession, createdBy, ...overrides } = {}
) => {
    const selectedStudent = student || await createStudent();
    const selectedClass =
        classSection || await createClassSection(
            await Program.findById(selectedStudent.program)
        );
    const actor = createdBy || (await createAdminUser()).user;
    const selectedSession =
        academicSession ||
        await createAcademicSession(actor, { status: "active" });

    return StudentEnrollment.create({
        student: selectedStudent._id,
        classSection: selectedClass._id,
        academicSession: selectedSession._id,
        status: "active",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        createdBy: actor._id,
        ...overrides,
    });
};

const createHistoryContext = async ({
    student,
    classSection,
    teacher,
    subject,
    createdBy,
} = {}) => {
    const selectedStudent = student || await createStudent();
    const selectedClass =
        classSection || await createClassSection(
            await Program.findById(selectedStudent.program)
        );
    const program = await Program.findById(selectedClass.program);
    const department = await Department.findById(program.department);
    const actor = createdBy || (await createAdminUser()).user;
    const selectedTeacher =
        teacher || await createTeacher(department, actor);
    const selectedSubject = subject || await createSubject(program);

    return {
        student: selectedStudent,
        classSection: selectedClass,
        teacher: selectedTeacher,
        subject: selectedSubject,
        actor,
    };
};

export const createAcademicRecord = async (context = {}, overrides = {}) => {
    const record = await createHistoryContext(context);
    return AcademicRecord.create({
        student: record.student._id,
        teacher: record.teacher._id,
        subject: record.subject._id,
        classSection: record.classSection._id,
        marks: 80,
        examType: "quiz",
        session: "2026",
        createdBy: record.actor._id,
        ...overrides,
    });
};

export const createAttendance = async (context = {}, overrides = {}) => {
    const record = await createHistoryContext(context);
    return Attendance.create({
        student: record.student._id,
        teacher: record.teacher._id,
        subject: record.subject._id,
        classSection: record.classSection._id,
        session: "2026",
        date: new Date("2026-06-01T00:00:00.000Z"),
        status: "present",
        ...overrides,
    });
};

export const createResult = async (context = {}, overrides = {}) => {
    const record = await createHistoryContext(context);
    return Result.create({
        student: record.student._id,
        subject: record.subject._id,
        classSection: record.classSection._id,
        obtainedMarks: 80,
        totalMarks: 100,
        marksPercentage: 80,
        attendancePercentage: 90,
        grade: "B",
        session: "2026",
        status: "pass",
        generatedBy: record.actor._id,
        ...overrides,
    });
};

export const createFeeRecord = async (student, overrides = {}) => {
    const selectedStudent = student || await createStudent();
    const program = await Program.findById(selectedStudent.program);
    const actor = (await createAdminUser()).user;
    const suffix = uniqueSuffix();
    return FeeRecord.create({
        challanId: `TEST-${suffix}`,
        student: selectedStudent._id,
        program: program._id,
        semester: "1",
        session: "2026",
        totalFee: 1000,
        dueDate: new Date("2099-12-31T00:00:00.000Z"),
        generatedBy: actor._id,
        ...overrides,
    });
};
