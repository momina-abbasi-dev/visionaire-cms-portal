import { Modal } from "./Modal.jsx";
import { Form } from "./Form.jsx";

export function QuickCreateModal({
    isOpen,
    onClose,
    type,
    onSubmit,
    departments = [],
    programs = [],
    // teachers = [],
    // subjects = []
}) {

    const getFields = () => {

        switch(type) {

            case "department":
                return [
                    {
                        name: "name",
                        label: "Department Name"
                    },
                    {
                        name: "code",
                        label: "Department Code"
                    },
                    {
                        name: "description",
                        label: "Description",
                        type: "textarea"
                    },
                    {
                        name: "totalSeats",
                        label: "Total Seats",
                        type: "number"
                    },
                    {
                        name: "availableSeats",
                        label: "Available Seats",
                        type: "number"
                    }
                ];

            case "program":
                return [
                    {
                        name: "name",
                        label: "Program Name"
                    },
                    {
                        name: "duration",
                        label: "Duration",
                        type: "number"
                    },
                    {
                        name: "totalSeats",
                        label: "Total Seats",
                        type: "number"
                    },
                    {
                        name: "availableSeats",
                        label: "Available Seats",
                        type: "number"
                    },
                    {
                        name: "department",
                        label: "Department",
                        type: "select",
                        options: departments.map(dep => ({
                            label: dep.name,
                            value: dep._id
                        }))
                    }
                ];

            // case "class":
            // return [
            //     {
            //         name: "name",
            //         label: "Class Name"
            //     },
            //     {
            //         name: "section",
            //         label: "Section"
            //     },
            //     {
            //         name: "semester",
            //         label: "Semester",
            //         type: "number"
            //     },
            //     {
            //         name: "department",
            //         label: "Department",
            //         type: "select",
            //         options: departments.map(dep => ({
            //             label: dep.name,
            //             value: dep._id
            //         }))
            //     },
            //     {
            //         name: "program",
            //         label: "Program",
            //         type: "select",
            //         options: programs.map(program => ({
            //             label: program.name,
            //             value: program._id
            //         }))
            //     },
            //     {
            //         name: "classTeacher",
            //         label: "Class Teacher",
            //         type: "select",
            //         options: teachers.map(teacher => ({
            //             label: teacher.name,
            //             value: teacher._id
            //         }))
            //     }
            // ];

            case "subject":
                return [
                    {
                        name: "name",
                        label: "Subject Name"
                    },
                    {
                        name: "code",
                        label: "Code"
                    },
                    {
                        name: "creditHours",
                        label: "Credit Hours",
                        type: "number"
                    },
                    {
                        name: "department",
                        label: "Department",
                        type: "select",
                        options: departments.map(dep => ({
                            label: dep.name,
                            value: dep._id
                        }))
                    },
                    {
                        name: "program",
                        label: "Program",
                        type: "select",
                        options: programs.map(program => ({
                            label: program.name,
                            value: program._id
                        }))
                    }
                ];

            default:
                return [];
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            title={`Create ${type}`}
            onClose={onClose}
        >
            <Form
                fields={getFields()}
                onSubmit={onSubmit}
                submitLabel="Create"
            />
        </Modal>
    );
}