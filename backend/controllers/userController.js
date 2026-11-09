import User from "../models/User.js";

const createUser = async (req, res) => {
  try {
    const { name, email, cnic, password, role } = req.body;

    if (role !== "admin") {
      return res.status(400).json({
        message:
          "Only Admin accounts can be created through User Management. Student and Teacher accounts must be created through their respective management modules.",
      });
    }

    if (!name || !email || !cnic || !password) {
      return res.status(400).json({
        message: "Name, email, CNIC and password are required.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { cnic }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          message: "A user with this email already exists.",
        });
      }

      if (existingUser.cnic === cnic) {
        return res.status(400).json({
          message: "A user with this CNIC already exists.",
        });
      }
    }

    const user = new User({
      name,
      email,
      cnic,
      password,
      role,
    });

    await user.save();

    const createdUser = await User.findById(user._id)
      .select("-password")
      .populate("studentId", "name rollNo")
      .populate("teacherId", "name registrationNo");

    res.status(201).json({
      message: "User created successfully",
      user: createdUser,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  const { search, role, status } = req.query;

  const query = {};

  try {
    if (search) {
      query.$or = [
        {
          name: {
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
      query.role = role.toLowerCase();
    }

    if (status && status !== "All") {
      query.status = status.toLowerCase();
    }

    const users = await User.find(query)
      .select("-password")
      .populate("studentId", "name rollNo")
      .populate("teacherId", "name registrationNo")
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("studentId", "name rollNo email cnic")
      .populate("teacherId", "name registrationNo email cnic");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const { name, email, cnic, password, role, status, studentId, teacherId } =
      req.body;

    /*
     * ---------------------------------------------------------
     * LINKED PROFILE PROTECTION
     * ---------------------------------------------------------
     *
     * Student/Teacher identity belongs to the corresponding
     * profile module, not generic User Management.
     *
     * User Management may still manage:
     * - account status
     * - password
     *
     * But it must not change:
     * - name
     * - email
     * - CNIC
     * - role
     * - studentId
     * - teacherId
     *
     * for linked Student/Teacher accounts.
     */

    const isStudentLinked = Boolean(user.studentId);
    const isTeacherLinked = Boolean(user.teacherId);
    const isProfileLinked = isStudentLinked || isTeacherLinked;

    if (isProfileLinked) {
      const identityFieldsChanged =
        name !== undefined ||
        email !== undefined ||
        cnic !== undefined ||
        role !== undefined ||
        studentId !== undefined ||
        teacherId !== undefined;

      if (identityFieldsChanged) {
        return res.status(400).json({
          message:
            "This account is linked to a Student or Teacher profile. Identity and role changes must be made through the corresponding management module.",
        });
      }

      if (status !== undefined) {
        user.status = status;
      }

      if (password !== undefined && password !== "") {
        user.password = password;
      }

      await user.save();

      const updatedUser = await User.findById(user._id)
        .select("-password")
        .populate("studentId", "name rollNo")
        .populate("teacherId", "name registrationNo");

      return res.status(200).json({
        message: "User updated successfully",
        user: updatedUser,
      });
    }

    if (role !== undefined) {
      if (role !== "admin") {
        return res.status(400).json({
          message:
            "Only the Admin role can be managed through User Management. Student and Teacher roles are managed through their respective modules.",
        });
      }

      user.role = role;
    }

    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: user._id },
      });

      if (existingEmail) {
        return res.status(400).json({
          message: "A user with this email already exists.",
        });
      }

      user.email = email;
    }

    if (cnic !== undefined) {
      const existingCnic = await User.findOne({
        cnic,
        _id: { $ne: user._id },
      });

      if (existingCnic) {
        return res.status(400).json({
          message: "A user with this CNIC already exists.",
        });
      }

      user.cnic = cnic;
    }

    if (status !== undefined) {
      user.status = status;
    }

    if (password !== undefined && password !== "") {
      user.password = password;
    }

    /*
     * Do not allow generic User Management to manually attach
     * student/teacher profile references.
     */
    if (studentId !== undefined || teacherId !== undefined) {
      return res.status(400).json({
        message:
          "Student and Teacher profile links are managed by their respective modules.",
      });
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("studentId", "name rollNo")
      .populate("teacherId", "name registrationNo");

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
     * Student and Teacher accounts are owned by their
     * respective profile modules.
     *
     * Deleting them here would leave the profile without
     * an account and break the relationship.
     */
    if (user.studentId || user.teacherId) {
      return res.status(400).json({
        message:
          "This account is linked to a Student or Teacher profile and cannot be deleted from User Management. Suspend the account instead.",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "User deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getUserStats = async (req, res) => {
  try {
    const [admins, teachers, students, active, suspended] =
      await Promise.all([
        User.countDocuments({
          role: "admin",
        }),

        User.countDocuments({
          role: "teacher",
        }),

        User.countDocuments({
          role: "student",
        }),

        User.countDocuments({
          status: "active",
        }),

        User.countDocuments({
          status: "suspended",
        }),
      ]);

    res.status(200).json({
      admins,
      teachers,
      students,
      active,
      suspended,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
};
