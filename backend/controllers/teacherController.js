import Teacher from "../models/Teacher.js";
import Department from "../models/Department.js";
import User from "../models/User.js";

const createTeacher = async (req, res) => {
  try {
    const {
      name,
      registrationNo,
      email,
      cnic,
      contact,
      dob,
      address,
      city,
      image,
      education,
      educationDocuments,
      department,
      status,
      role,
      password,
    } = req.body;

    if (
      !name ||
      !registrationNo ||
      !email ||
      !cnic ||
      !contact ||
      !dob ||
      !address ||
      !city ||
      !education ||
      !department ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Name, registration number, email, CNIC, contact, date of birth, address, city, education, department and password are required.",
      });
    }

    const existingTeacher = await Teacher.findOne({
      $or: [{ registrationNo }, { email }, { cnic }],
    });

    if (existingTeacher) {
      if (existingTeacher.registrationNo === registrationNo) {
        return res.status(400).json({
          message: "A teacher with this registration number already exists.",
        });
      }

      if (existingTeacher.email === email) {
        return res.status(400).json({
          message: "A teacher with this email already exists.",
        });
      }

      if (existingTeacher.cnic === cnic) {
        return res.status(400).json({
          message: "A teacher with this CNIC already exists.",
        });
      }
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { cnic }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          message: "A user account with this email already exists.",
        });
      }

      if (existingUser.cnic === cnic) {
        return res.status(400).json({
          message: "A user account with this CNIC already exists.",
        });
      }
    }

    const dept = await Department.findById(department);

    if (!dept) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    const teacher = new Teacher({
      name,
      registrationNo,
      email,
      cnic,
      contact,
      dob,
      address,
      city,
      image,
      education,
      educationDocuments,
      department,
      status,
      role,
      createdBy: req.user.id,
    });

    await teacher.save();

    try {
      const user = new User({
        name: teacher.name,
        email: teacher.email,
        cnic: teacher.cnic,
        password,
        role: "teacher",
        teacherId: teacher._id,
        status: teacher.status,
      });

      await user.save();
    } catch (userError) {
      await Teacher.findByIdAndDelete(teacher._id);

      throw userError;
    }

    const createdTeacher = await Teacher.findById(teacher._id).populate(
      "department",
      "name code",
    );

    res.status(201).json({
      message: "Teacher and user account created successfully.",
      teacher: createdTeacher,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getTeachers = async (req, res) => {
  try {
    const {
      search,
      department,
      role,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          registrationNo: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          cnic: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (role && role !== "All") {
      query.role = role;
    }

    if (status && status !== "All") {
      query.status = status;
    }

    if (department && department !== "All") {
      query.department = department;
    }

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.max(Number(limit) || 10, 1);
    const skip = (numericPage - 1) * numericLimit;

    const [teachers, total] = await Promise.all([
      Teacher.find(query)
        .populate("department", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit),

      Teacher.countDocuments(query),
    ]);

    res.status(200).json({
      message: "Teachers fetched successfully",
      teachers,
      pagination: {
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate(
      "department",
      "name code",
    );

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found.",
      });
    }

    res.status(200).json({
      message: "Teacher fetched successfully",
      teacher,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found.",
      });
    }

    const {
      name,
      email,
      cnic,
      contact,
      dob,
      address,
      city,
      image,
      education,
      educationDocuments,
      department,
      status,
      role,
    } = req.body;

    if (email !== undefined) {
      const existingTeacher = await Teacher.findOne({
        email,
        _id: { $ne: teacher._id },
      });

      if (existingTeacher) {
        return res.status(400).json({
          message: "A teacher with this email already exists.",
        });
      }

      const existingUser = await User.findOne({
        email,
        _id: { $ne: teacher._id },
      });

      if (existingUser) {
        return res.status(400).json({
          message: "A user account with this email already exists.",
        });
      }

      teacher.email = email;
    }

    if (cnic !== undefined) {
      const existingTeacher = await Teacher.findOne({
        cnic,
        _id: { $ne: teacher._id },
      });

      if (existingTeacher) {
        return res.status(400).json({
          message: "A teacher with this CNIC already exists.",
        });
      }

      const existingUser = await User.findOne({
        cnic,
        _id: { $ne: teacher._id },
      });

      if (existingUser) {
        return res.status(400).json({
          message: "A user account with this CNIC already exists.",
        });
      }

      teacher.cnic = cnic;
    }

    if (department !== undefined) {
      const dept = await Department.findById(department);

      if (!dept) {
        return res.status(404).json({
          message: "Department not found.",
        });
      }

      teacher.department = department;
    }

    if (name !== undefined) {
      teacher.name = name;
    }

    if (contact !== undefined) {
      teacher.contact = contact;
    }

    if (dob !== undefined) {
      teacher.dob = dob;
    }

    if (address !== undefined) {
      teacher.address = address;
    }

    if (city !== undefined) {
      teacher.city = city;
    }

    if (image !== undefined) {
      teacher.image = image;
    }

    if (education !== undefined) {
      teacher.education = education;
    }

    if (educationDocuments !== undefined) {
      teacher.educationDocuments = educationDocuments;
    }

    if (status !== undefined) {
      teacher.status = status;
    }

    if (role !== undefined) {
      teacher.role = role;
    }

    await teacher.save();

    /*
     * Keep the linked User account synchronized.
     */
    const user = await User.findOne({
      teacherId: teacher._id,
    });

    if (user) {
      user.name = teacher.name;
      user.email = teacher.email;
      user.cnic = teacher.cnic;
      user.status = teacher.status;

      await user.save();
    }

    const updatedTeacher = await Teacher.findById(teacher._id).populate(
      "department",
      "name code",
    );

    res.status(200).json({
      message: "Teacher updated successfully",
      teacher: updatedTeacher,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found.",
      });
    }

    /*
     * Delete linked login account first.
     */
    await User.deleteOne({
      teacherId: teacher._id,
    });

    await Teacher.findByIdAndDelete(teacher._id);

    res.status(200).json({
      message: "Teacher and linked user account deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getTeacherStats = async (req, res) => {
  try {
    const [total, active, suspended, senior, junior] = await Promise.all([
      Teacher.countDocuments(),
      Teacher.countDocuments({ status: "active" }),
      Teacher.countDocuments({ status: "suspended" }),
      Teacher.countDocuments({ role: "senior" }),
      Teacher.countDocuments({ role: "junior" }),
    ]);

    res.status(200).json({
      total,
      active,
      suspended,
      senior,
      junior,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getTeacherStats,
};
