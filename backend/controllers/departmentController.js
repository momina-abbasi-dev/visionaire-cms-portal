import Department from "../models/Department.js";
import Program from "../models/Program.js";
import Subject from "../models/Subject.js";
import ClassSection from "../models/ClassSection.js";

const createDepartment = async (req, res) => {
    const { name, code } = req.body;

    try {
        const existingDepartment = await Department.findOne({
            $or: [{ name }, { code }],
        });

        if (existingDepartment) {
            return res.status(409).json({
                message: "A department with this name or code already exists.",
            });
        }

        const newDepartment = new Department(req.body);
        await newDepartment.save();

        return res.status(201).json({
            message: "Department created successfully.",
            department: newDepartment,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "A department with this name or code already exists.",
            });
        }

        console.error("Create department error:", error);

        return res.status(500).json({
            message: "Failed to create department.",
        });
    }
};

const getDepartments = async (req, res) => {
    try {
        const departments = await Department.find().sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Departments retrieved successfully.",
            count: departments.length,
            departments,
        });
    } catch (error) {
        console.error("Get departments error:", error);

        return res.status(500).json({
            message: "Failed to retrieve departments.",
        });
    }
};

const getDepartmentById = async (req, res) => {
    const { id } = req.params;

    try {
        const department = await Department.findById(id);

        if (!department) {
            return res.status(404).json({
                message: "Department not found.",
            });
        }

        return res.status(200).json({
            message: "Department retrieved successfully.",
            department,
        });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid department ID.",
            });
        }

        console.error("Get department by ID error:", error);

        return res.status(500).json({
            message: "Failed to retrieve department.",
        });
    }
};


const updateDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        message: "This department does not exist",
      });
    }

    const totalSeats =
      req.body.totalSeats !== undefined
        ? Number(req.body.totalSeats)
        : department.totalSeats;

    const availableSeats =
      req.body.availableSeats !== undefined
        ? Number(req.body.availableSeats)
        : department.availableSeats;

    if (
      !Number.isInteger(totalSeats) ||
      !Number.isInteger(availableSeats) ||
      totalSeats < 0 ||
      availableSeats < 0
    ) {
      return res.status(400).json({
        message: "Seat values must be non-negative whole numbers.",
      });
    }

    if (availableSeats > totalSeats) {
      return res.status(400).json({
        message: "Available seats cannot exceed total seats.",
      });
    }

    // Update only the fields supplied by the client.
    const allowedFields = [
      "name",
      "code",
      "description",
      "totalSeats",
      "availableSeats",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        department[field] = req.body[field];
      }
    }

    department.totalSeats = totalSeats;
    department.availableSeats = availableSeats;

    await department.save();

    return res.status(200).json({
      message: `${department.name} Department updated successfully`,
      department,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.code === 11000) {
      return res.status(400).json({
        message:
          error.code === 11000
            ? "A department with this name or code already exists."
            : error.message,
      });
    }

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

const deleteDepartment = async (req, res) => {
    const { id } = req.params;

    try {
        const department = await Department.findById(id);

        if (!department) {
            return res.status(404).json({
                message: "Department not found.",
            });
        }

        const [programCount, subjectCount, classCount] =
            await Promise.all([
                Program.countDocuments({ department: id }),
                Subject.countDocuments({ department: id }),
                ClassSection.countDocuments({ department: id }),
            ]);

        if (programCount || subjectCount || classCount) {
            return res.status(409).json({
                message:
                    "This department cannot be deleted because academic records are linked to it.",
                linkedRecords: {
                    programs: programCount,
                    subjects: subjectCount,
                    classes: classCount,
                },
            });
        }

        await department.deleteOne();

        return res.status(200).json({
            message: "Department deleted successfully.",
            department,
        });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid department ID.",
            });
        }

        console.error("Delete department error:", error);

        return res.status(500).json({
            message: "Failed to delete department.",
        });
    }
};

export {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment,
};