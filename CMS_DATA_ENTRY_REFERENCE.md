# Visionaire EduCore CMS — Data Entry Reference

**Purpose:** Code-grounded guide for preparing fictional university sample data and entering it through the implemented portal workflows.

**Scope and limits:** This is based on the saved React pages, service modules, Express routes/controllers, and Mongoose schemas. No database was queried, no API was called, and no records were created. Options called “dynamic” are populated from the application database/API at runtime; their current values cannot be known from source code alone.

## 1. Project and module overview

The application is a React/Vite frontend with an Express/Mongoose backend. The Admin dashboard is under `/admin/dashboard` and has routes for overview, users, academic structure, students, teachers, academic assignments, admissions, academic records, fees, and academic sessions. No Admin dashboard route exists for attendance or result entry.

The most important distinction for data preparation is that “session” is not represented uniformly:

- `AcademicSession` has a MongoDB `_id`, display `name`, UTC calendar `startDate` / `endDate`, and a status.
- `StudentEnrollment.academicSession` references the `AcademicSession` document by ObjectId.
- `AcademicAssignment.session`, `Attendance.session`, `AcademicRecord.session`, `Result.session`, and `FeeRecord.session` are strings. Assignment and attendance workflows look up a session by its exact `name` string. Keep these strings identical to the corresponding session name; creating a session does not create assignments.

## 2. Complete Admin module inventory

| Admin module | Page/component | Actual entry/edit surface |
|---|---|---|
| Overview | `src/pages/dashboard/admin/AdminOverview.jsx` | Read-only dashboard metrics, alerts, and recent activity; no create/edit form. |
| User Management | `src/pages/dashboard/admin/UserManagement.jsx` | Add-admin modal; account detail drawer with edit, role/permissions, security, and deletion controls. |
| Academic Structure | `src/pages/dashboard/admin/AcademicStructure.jsx` | Tabs for Department, Program, Class, and Subject; Add modal and Edit drawer; relationship tree is read-only. |
| Academic Sessions | `src/pages/dashboard/admin/AcademicSessionManagement.jsx` | Create/edit modal and status/search filters. |
| Teachers | `src/pages/dashboard/admin/TeacherManagement.jsx` | Add-teacher modal; detail drawer with profile edit, role/status controls, read-only subject/class assignment placeholders, document viewing, and delete. |
| Academic Assignments | `src/pages/dashboard/admin/AcademicAssignmentManagement.jsx` | Inline create/edit form; assignment deactivation action. |
| Students | `src/pages/dashboard/admin/StudentManagement.jsx` | Add-student modal; detail drawer with profile editing, status/fee-status controls, document verification, program transfer, and delete. |
| Student Enrollments | `src/pages/dashboard/admin/StudentManagement.jsx` (Enrollment tab) | Create enrollment, close, single promotion, bulk promotion, and paginated enrollment-history workflows. |
| Admissions | `src/pages/dashboard/admin/Admissions.jsx` | Admin can submit an application in a modal, inspect its details/documents in a drawer, and approve/reject pending applications. |
| Academic Records | `src/pages/dashboard/admin/AcademicRecords.jsx` | Review-only drawer: verify/request correction/reject and lock/unlock records. Record creation is not an Admin form. |
| Fees & Finance | `src/pages/dashboard/admin/FeesFinance.jsx` | Generate-challan modal, record-payment modal, finance drawer, cancellation, filters, and payment history. The page does not expose the backend fee-edit API. |
| Attendance | No Admin page or Admin route in `src/routes/AppRoutes.jsx` | Attendance is entered through Teacher Attendance, not the Admin UI. The older `/api/attendances` POST route also allows an authenticated Admin, but there is no corresponding Admin form. |
| Results | No Admin results page/route | No Admin result-entry form. The Admin Academic Records page reviews inputs; result data has a separate schema and non-Admin workflows. |

Other non-Admin/public routes, such as Login and Register, are outside this data-entry guide.

## 3. Academic foundation forms

### 3.1 Departments

**Page:** `AcademicStructure.jsx`, Departments tab. Add modal and edit drawer. The list is not limited to static options; Departments are database records.

| Field | Input | Required in Add UI? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text | Schema requires and trims it; unique index. |
| `code` | Text | Yes | Free text; example placeholder `CS` | Schema requires, trims, and uppercases; unique index. |
| `description` | Textarea | No | Empty | Optional; trims; schema default `""`. |
| `totalSeats` | Number | Yes | Integer `>= 0` | UI validates non-negative whole number; schema requires integer and minimum 0. |
| `availableSeats` | Number | Yes | Integer `>= 0` | Must not exceed `totalSeats`, checked in UI and schema. |

Edit exposes the same five fields. Backend Department create takes those fields; department update only applies the recognized fields and validates seat values. Department deletion is rejected while Programs, Subjects, or ClassSections reference it.

**API:** `/api/departments` — create/list/get/update/delete. **Model/controller:** `backend/models/Department.js`, `backend/controllers/departmentController.js`, `backend/routes/departmentRoutes.js`.

### 3.2 Programs (degree programs)

**Page:** `AcademicStructure.jsx`, Programs tab. Add modal and edit drawer. `name` is free text: examples such as BS Computer Science or BBA are not static enums.

| Field | Input | Required in Add UI? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text | Required and trimmed. Unique within a Department, not globally. |
| `duration` | Number | Yes | Positive whole number; UI labels as years | Minimum 1 and integer; no maximum/year unit is enforced by schema. |
| `totalSeats` | Number | Yes | Integer `>= 0` | Required; whole number. |
| `availableSeats` | Number | Yes | Integer `>= 0` | Required; cannot exceed `totalSeats`. |
| `department` | Select | Yes | Existing Department records | Database-backed; required reference. |

Edit exposes these fields. Server validates Department existence and duplicate Program name within that Department. Deletion is constrained by linked records (including Students, Classes, and Subjects); inspect the server response if blocked.

**API:** `/api/programs` — create/list/get/update/delete. **Model/controller:** `backend/models/Program.js`, `backend/controllers/programController.js`, `backend/routes/programRoutes.js`.

### 3.3 Subjects

**Page:** `AcademicStructure.jsx`, Subjects tab. Add modal and edit drawer. Department and Program are API-backed; the Program options are filtered by selected Department.

| Field | Input | Required in Add UI? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text | Required and trimmed by schema/controller. |
| `code` | Text | Yes | Free text; placeholder `CS101` | Required, trimmed, uppercased by controller; unique globally. |
| `creditHours` | Number | Yes | Whole/number value 1–6 | Schema minimum 1 and maximum 6; UI uses integer step 1. |
| `department` | Select | Yes | Existing Department records | Required reference. |
| `program` | Select | Yes | Programs in selected Department | Required reference; server requires the Program’s Department to match the selected Department. |

Edit exposes the same fields. The UI notes that changing relationships can be rejected when assignments already exist. There is no semester/curriculum mapping or per-semester subject list in this form.

**API:** `/api/subjects` — create/list/get/update/delete. **Model/controller:** `backend/models/Subject.js`, `backend/controllers/subjectController.js`, `backend/routes/subjectRoutes.js`.

### 3.4 Class Sections

**Page:** `AcademicStructure.jsx`, Classes tab. Add modal and edit drawer. Department and Program are dynamic records; Program choices are filtered by Department.

| Field | Input | Required in Add UI? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text | Required; example might be `Semester 1` or a cohort/class label. No fixed naming convention. |
| `section` | Text | Yes | Free text; example placeholder `A` | Required. |
| `semester` | Number | Yes | Positive whole number | Minimum 1; there is no schema maximum or automatic check against Program duration. |
| `department` | Select | Yes | Existing Department records | Required reference. |
| `program` | Select | Yes | Programs in selected Department | Required reference; server verifies the Program belongs to the Department. |

The schema’s unique compound index is `{ name, section, semester, program }`. Department is not part of that index. The UI’s relationship tree displays Departments → Programs → Classes; the tree is not a data-entry form.

**API:** `/api/classes` — create/list/get/update/delete. **Model/controller:** `backend/models/ClassSection.js`, `backend/controllers/classController.js`, `backend/routes/classRoutes.js`.

### 3.5 Academic Sessions

**Page:** `AcademicSessionManagement.jsx`; create/edit modal.

| Field | Input | Required? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text, e.g. `2026` or `2026-2027` | Trimmed. `nameKey` normalizes whitespace and case and is unique; `nameKey` is generated, not entered. Other modules may require exact `name` matching. |
| `startDate` | Date | Yes | `YYYY-MM-DD` | Strict calendar date, stored at UTC midnight. |
| `endDate` | Date | Yes | `YYYY-MM-DD` | Must be on or after `startDate`; UTC calendar date. |
| `status` | Select | Yes | Static: `planned`, `active`, `completed`; default `planned` | Only these values are accepted. |

The backend fills `createdBy` and `updatedBy` from the signed-in Admin and maintains timestamps. The list filter’s `All` option is a UI filter, not a stored status. Session creation does **not** create or update AcademicAssignments. Updating dates is rejected when it would place an existing enrollment start/end outside the revised boundaries. No cascade that renames dependent string `session` fields was found; do not casually rename a session used by assignments/attendance/records/fees.

**API:** `/api/academic-sessions` — create/list/get/patch. **Model/controller:** `backend/models/AcademicSession.js`, `backend/controllers/academicSessionController.js`, `backend/routes/academicSessionRoutes.js`.

## 4. Teacher management forms

**Page:** `TeacherManagement.jsx`. Add modal fields:

| Field | Input | Required in UI? | Values/default | Notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text | Teacher display name. |
| `registrationNo` | Text | Yes | Free text | Unique Teacher identifier. |
| `email` | Email | Yes | Email text | Unique in Teacher and User; User stores lowercase. |
| `cnic` | Text | Yes | Free text | Unique in Teacher and User; no CNIC-format rule confirmed in schema. |
| `contact` | Text | Yes | Free text | No format rule confirmed. |
| `city` | Text | Yes | Free text | — |
| `address` | Text | Yes | Free text | — |
| `education` | Text | Yes | Free text | — |
| `dob` | Date | Yes | Date input | Schema requires a Date; no age rule confirmed. |
| `password` | Password | Yes | User-supplied; UI min length 6 | Creates the linked login account; User hashes it with bcryptjs. |
| `role` | Select | Not marked required in JSX; default `junior` | Static: `junior`, `senior` | Teacher faculty rank/role; not the User authorization role. |
| `department` | Select | Yes | Existing Departments | Required reference. |

The create UI does not expose `image`, `educationDocuments`, or `status`. Schema defaults Teacher `status` to `active`; `image` is optional and `educationDocuments` is an array of `{ name, fileUrl }` items. The drawer can view existing education document links, but does not upload documents. Edit fields are `name`, `email`, `cnic`, `contact`, `city`, `address`, `education`, `dob`, `role`, and `department`; separate controls change status (`active`/`suspended`) and faculty role (`junior`/`senior`). Registration number is not editable in the drawer. Subject/Class checkbox tabs are explicitly placeholders and do not save assignments; use Academic Assignment Management instead.

Create also makes a linked `User` with role `teacher`, matching name/email/CNIC, Teacher reference, and status. Email/CNIC collisions with either Teacher or User records block creation. The Admin actor is stored as `createdBy`.

**API:** `/api/teachers`. **Model/controller:** `backend/models/Teacher.js`, `backend/controllers/teacherController.js`, `backend/routes/teacherRoutes.js`.

## 5. Academic assignment forms

**Page:** `AcademicAssignmentManagement.jsx`; inline form, edit, and deactivate action.

| Field | Input | Required? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `teacher` | Select | Yes | Active Teachers from `/api/teachers` | UI lists active teachers and filters classes by Teacher Department. |
| `session` | Text | Yes | Free text, placeholder `2025-2026` | Must match an existing `AcademicSession.name` exactly after trimming. It is not a session-ID dropdown. |
| `classSection` | Select | Yes | ClassSections from API, filtered to Teacher Department | Must exist and share the Teacher’s Department. |
| `subject` | Select | Yes | Subjects filtered to selected ClassSection’s Program and Teacher Department | Must belong to that same Program and Department. |
| `isActive` | Checkbox | Edit only | Default `true` for new assignment | Inactive records are preserved; deactivation is a separate action. |

Backend stores `teacher`, `subject`, `classSection`, `session` string, `isActive`, and timestamps. Only active Teachers can be assigned. A partial unique index prevents more than one active assignment for the same `{ subject, classSection, session }`, regardless of Teacher. Session must already exist by exact name. Assignment updates accept only the five fields above; deactivate instead of deleting history where appropriate.

**API:** `/api/academicAssignments`. **Model/controller:** `backend/models/AcademicAssignment.js`, `backend/controllers/academicAssignmentController.js`, `backend/routes/academicAssignmentRoutes.js`.

## 6. Student management forms

**Page:** `StudentManagement.jsx`. Add modal:

| Field | Input | Required in UI? | Values/default | Notes |
|---|---|---:|---|---|
| `name` | Text | Yes | Free text | — |
| `rollNo` | Text | Yes | Free text; placeholder `2026-CS-001` | Unique. No prescribed pattern is enforced. |
| `email` | Email | Yes | Email text | Unique in Student and linked User; User stores lowercase. |
| `cnic` | Text | Yes | Free text | Unique in Student and linked User. |
| `contact` | Text | Yes | Free text | — |
| `city` | Text | Yes | Free text | — |
| `address` | Text | Yes | Free text | — |
| `dob` | Date | Yes | Date input | No age rule confirmed. |
| `password` | Password | Yes | Free text | Creates linked User account; password is hashed in User save hook. |
| `program` | Select | Yes | Existing Programs | Must exist and have available seats. |

Create also writes the linked `User` profile (role `student`) and atomically decrements Program `availableSeats`. Student schema fields not exposed in Add include `image`, `dateOfAdmission` (default current time), `previousAcademicDocument` (array of `{ name, fileUrl }`), `documentsVerified` (default false), `status` (default `active`), and `feeStatus` (default `pending`). `createdBy` is set by the controller. No upload control is in the Add form.

Edit fields in the drawer are `name`, `email`, `cnic`, `contact`, `city`, `address`, `dob`, and `program`. It does not expose `rollNo` in the edit form. A Student with enrollment history cannot change Program through this edit path; transfer via the enrollment workflow. On edit, linked User name/email/CNIC are synchronized. Separate UI controls update Student `status` (`active`, `suspended`, `graduated`, `pending`) and `feeStatus` (`paid`, `partial`, `pending`); the latter is a compatibility field, while Finance records track actual balances. The Documents tab displays `previousAcademicDocument` and can mark `documentsVerified=true`; it does not upload documents.

**API:** `/api/students`. **Model/controller:** `backend/models/Student.js`, `backend/controllers/studentController.js`, `backend/routes/studentRoutes.js`.

## 7. Student enrollment forms

Enrollment workflows are part of the Student drawer’s Enrollment tab in `StudentManagement.jsx`. An enrollment links one Student, one ClassSection, and one AcademicSession.

### Create active enrollment

| Field | Input | Required? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `classSection` | Select | Yes | Existing ClassSections; UI labels Program | Class and its Department/Program references must exist and be consistent. |
| `academicSession` | Select | Yes | Existing sessions with `planned` or `active` status | Sends the session ObjectId, not its name string. |
| `student` | Select | Yes | Server-generated eligible Student list for chosen class/session | Student must be active, same Program as class, and not already actively enrolled in that session. |
| `startDate` | Date | Yes | `YYYY-MM-DD` | Strict valid calendar date within chosen AcademicSession boundaries. |

Create payload is exactly `{ student, classSection, academicSession, startDate }`. Backend generates `_id`, `status: "active"`, `createdBy`, timestamps, and null closure fields. An active enrollment is unique per `{ student, academicSession }`; an active enrollment in another class for the same session also prevents a second.

### Close, promote, and bulk promote

- **Close:** select an active enrollment, choose the action `completed` or `withdrawn`, then enter `endDate`. The UI sends `{ status, endDate }`. Backend generates `endedAt=now`, `endedBy=Admin`, and `endReason=status`. End date must not precede the enrollment start and must fall within the AcademicSession. `transferred` is not a close-form option; promotion handles that state.
- **Promote:** choose a different destination AcademicSession, a destination ClassSection in the Student’s current Program, and a `promotionDate` inside the destination session and not before the source enrollment start. The API creates a new active enrollment with `startDate=promotionDate` and `previousEnrollment` pointing to the source; source is closed as `transferred`, with `endDate=promotionDate`, `endedAt`, `endedBy`, and reason `promoted`.
- **Bulk promotion:** select up to 100 active enrollments, choose a destination session and date, and choose a compatible destination class per Student. Duplicate Student entries are rejected; one Student can occur only once in the batch. The operation is transactional/all-or-nothing. Payload is `{ promotions: [{ sourceEnrollment, destinationClassSection }], destinationAcademicSession, promotionDate }`.

`StudentEnrollment` also stores immutable references `student`, `classSection`, and `academicSession`; optional `reason`; `previousEnrollment`; closure metadata; and timestamps. Dates use strict `YYYY-MM-DD` for date-only values. `endedAt` is a timestamp and cannot precede `startDate`. Previous enrollment must exist, belong to the same Student, cannot directly self-reference, and cannot create a history cycle. Query-based update mutations are blocked by the model; the supported API workflows load, validate, and save documents.

**API:** `/api/student-enrollments`. **Model/controller:** `backend/models/StudentEnrollment.js`, `backend/controllers/studentEnrollmentController.js`, `backend/routes/studentEnrollmentRoutes.js`.

## 8. Attendance forms

**Admin form status:** No Admin attendance page or route is present. `src/routes/AppRoutes.jsx` has no Admin attendance page. Attendance is entered in `src/pages/dashboard/teacher/TeacherAttendance.jsx` by an authenticated Teacher. The legacy `/api/attendances` POST route permits Admin or Teacher, but there is no Admin UI form for it.

### Teacher Attendance entry fields (for required data dependencies)

| Field | Input | Required? | Values/default | Validation and notes |
|---|---|---:|---|---|
| Class | Select | Required to load | Teacher’s assigned classes | Assignment must be active. |
| Subject | Select | Required to load | Assigned subject for selected class | Assignment constrained to same Program/Department. |
| Date | Date | Required to load | Defaults from page state; cannot be later than today in UI | Backend requires a valid `YYYY-MM-DD` date within AcademicSession boundaries. |
| Session | Select | Required to load | Exact session strings from the Teacher’s active assignments | Backend resolves exact `AcademicSession.name` and active AcademicAssignment. |
| Per-student `status` | Toggle | Required per record | Static: `present`, `absent`, `late`; fresh roster defaults `present` | Backend enum; existing date can load saved values. |
| Per-student `remarks` | Text | No | Empty | Optional text; model trims, default `""`. |

The effective payload for the Teacher workflow is `{ classId, subjectId, date, session, records: [{ studentId, status, remarks }] }`. The roster depends on an active enrollment in the selected class/session covering the attendance date, an active Student, and matching Program. Existing attendance is unique for `{ student, subject, classSection, date }`; do not enter a second record for that combination. Senior Teacher authorization is required for update mode. The older Admin-capable attendance API is separate and does not provide an Admin entry form.

**Models/controller:** `backend/models/Attendance.js`, `backend/controllers/teacherAttendanceController.js`; route `/api/teacher-attendance` is Teacher-only via `backend/routes/teacherAttendanceRoutes.js`. Legacy route: `backend/routes/attendanceRoutes.js`.

## 9. Academic records and results forms

### Academic Records

**Admin UI:** `AcademicRecords.jsx` is review-only. It does not create AcademicRecords. The drawer displays record identity/marks and has:

- `reviewRemarks`: textarea, maximum 1,000 characters; required when Admin requests correction or rejects.
- Status actions: static `verified`, `needs_correction`, or `rejected` from the review controls. Model also permits `pending`, which is the creation default.
- Lock actions: `isLocked` is a button action, not an ordinary free-form field. Only verified records can be locked; locked records must be unlocked before review changes.
- `reviewedBy` and `reviewedAt` are set by the server when status is reviewed; not manually entered.

**Teacher submission (not an Admin form):** `TeacherAcademicRecords.jsx` / teacher service creates a record with `{ subject, student, classSection, marks, examType, session, remarks? }`. The `examType` choices are static: `quiz`, `assignment`, `practical`, `midterm`, `final`. Teacher, `createdBy`, initial `status: "pending"`, and `isLocked: false` are set by the server/schema. Marks must be a finite number `>=0`; no per-exam maximum is enforced in this schema/controller. Session is a required string and must match an active AcademicAssignment for that Teacher, Subject, ClassSection, and session. Student must be active and eligible for the class Program. Duplicate record for the same student/teacher/class/subject/examType/session is rejected.

`AcademicRecord` references `Student`, `Teacher`, `Subject`, and `ClassSection`; stores `marks`, `examType`, session string, optional teacher `remarks`, review status/remarks, reviewer and lock fields, `createdBy`, and timestamps.

**API:** Admin review `/api/records/:id/status`; Teacher create `/api/records/create`. **Model/controller:** `backend/models/AcademicRecord.js`, `backend/controllers/academicRecordController.js`, `backend/routes/academicRecordRoutes.js`.

### Results

No Admin result-entry form or Admin Results route exists. `Result` stores `student`, `subject`, `classSection`, `obtainedMarks`, `totalMarks`, `marksPercentage`, `attendancePercentage`, `grade`, session string, `status`, optional `remarks`, `generatedBy`, and timestamps. Grades are restricted to `A`, `B`, `C`, `D`, `F`; result status to `pass` or `fail`; obtained marks cannot exceed total marks. Unique index: `{ student, subject, classSection, session }`.

The legacy `/api/results/generateResult` route is Student-authorized and accepts `{ subject, classSection, session }`; the controller calculates scores and attendance percentages from records and attendance rather than accepting those values from an Admin form. Teacher Results routes expose result listing and senior-Teacher verification, not an Admin create form. Exact result workflow availability beyond those inspected routes is not confirmed.

**Model/controller/routes:** `backend/models/Result.js`, `backend/controllers/resultController.js`, `backend/routes/resultRoutes.js`, `backend/controllers/teacherResultsController.js`, `backend/routes/teacherResultsRoutes.js`.

## 10. Fee management forms

**Page:** `FeesFinance.jsx`.

### Generate challan

| Field | Input | Required in UI? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `student` | Select | Yes | Existing Students | Must be a valid Student ID. |
| `program` | Select | No | Existing Programs | Optional reference; backend validates ID format when supplied, but does not confirm it matches the Student. |
| `classSection` | Select | No | Existing ClassSections | Optional reference; backend validates ID format, not Student/class relationship. |
| `semester` | Text | Yes | Free text, e.g. `Semester 1` | Required non-empty trimmed string; not an enum/integer. |
| `session` | Text | Yes | Free text, placeholder `2026-2027` | Required non-empty trimmed string; not linked by schema to AcademicSession. |
| `totalFee` | Number | Yes | Positive amount; UI step `0.01` | Backend positive finite amount; schema min 0.01. |
| `discount` | Number | No | Default `0` | Nonnegative, cannot exceed `totalFee` through UI/API generation; schema permits no more than total fee plus late fee. |
| `dueDate` | Date | Yes | Date input | Valid date required. |
| `notes` | Text | No | Empty | Optional, trims; schema max 1,000 characters. |

The UI sends `lateFee: 0`. Server generates unique `challanId`, `generatedBy`, initial paid amount, status, and timestamps. Do not manually set generated `balance`, `status`, or payment history. Status is derived on save from net due, paid amount, and due date (except cancelled).

### Record payment

| Field | Input | Required? | Values/default | Validation and notes |
|---|---|---:|---|---|
| `amount` | Number | Yes | Positive amount up to remaining balance | Cannot exceed balance or pay cancelled/fully paid challan. |
| `reference` | Text | No | Empty | Optional bank/slip/reference value. |
| `method` | Select | Yes | Static: `cash`, `bank`, `online`; default `cash` | Model enum. |

The payment subdocument’s `paidAt` is set to now and `recordedBy` to current User. `paidAmount` is incremented and record status recalculated. Each payment has a generated subdocument `_id`; do not pre-enter it.

Finance drawer is for viewing fee details and payment history, and offers payment/cancel controls. Although the backend exposes `PUT /api/fees/:id` (editable before payments; fields include `semester`, `session`, `dueDate`, `notes`, and, only before payment, fee amounts), the Admin page does not import or call `updateFeeRecord` and has no edit form.

`FeeRecord` references `Student`; optional `Program`/`ClassSection`; stores `semester`, `session`, monetary fields (`totalFee`, `discount`, `lateFee`, `paidAmount`), `dueDate`, `paidAt`, status, nested payments, `generatedBy`, notes, and timestamps. The `balance` virtual is `max(0, totalFee + lateFee - discount - paidAmount)`. Student `feeStatus` is also maintained as a compatibility summary; Finance records are the detailed payment history.

**API:** `/api/fees`. **Model/controller:** `backend/models/FeesFinance.js` (model name `FeeRecord`), `backend/controllers/feesFinanceController.js`, `backend/routes/feesFinanceRoutes.js`.

## 11. Record dependencies and recommended creation order

1. **Departments** — first-level academic entities.
2. **Programs** — require Department; choose names freely (for example BS Computer Science).
3. **ClassSections and Subjects** — each requires a Program and Department, and the Program must belong to that Department. The class `semester` is an integer; there is no automatic program-term curriculum.
4. **AcademicSessions** — create names and boundaries before assignments, enrollment, and attendance. Status must be planned/active to enroll; sessions are date-only UTC calendar ranges.
5. **Teachers** — require Department. Teacher creation also creates linked Teacher User account. Use unique registration number, email, and CNIC.
6. **AcademicAssignments** — require an active Teacher, Subject, ClassSection, and existing session name. Align all Department/Program relationships; the session string must equal `AcademicSession.name`.
7. **Students** — require Program and available capacity; Admin form requires login password. Student creation creates linked User and decrements Program seats.
8. **StudentEnrollments** — require active Student, same-Program ClassSection, planned/active AcademicSession, and start date within session boundaries. One active enrollment per Student/session.
9. **Attendance** — depends on active assignment and valid active enrollment for Student/class/session/date; entered through Teacher attendance UI, not Admin.
10. **AcademicRecords** — depend on Student, Teacher, Subject, ClassSection, and a matching active assignment/session; Teacher submits and Admin reviews.
11. **Results** — dependent on academic records and attendance in the legacy generator; not an Admin form. Keep Student/Subject/ClassSection/session consistent.
12. **FeeRecords** — require Student; Program and ClassSection are optional in schema and UI. Session and semester are free-text labels, not foreign keys.
13. **Admissions (optional intake path)** — require existing Department and Program in that Department. Approval reserves Program seat and creates Student/User; do not also manually create the same student.

Avoid mixing the “create Student directly” and “approve Admission” paths for one applicant: both create Student and User records and enforce unique email/CNIC. Program seat counts change on Student creation, admission approval, and program transfer. Department seat counts are separately stored; no synchronization with Program/student capacity was confirmed.

## 12. Field validation and relationship constraints

### Frontend vs backend validation

- Native HTML `required`, `min`, `max`, `step`, and `maxLength` attributes are applied only on the listed UI fields; they are not a substitute for API checks.
- Controllers perform request-specific checks and Mongoose schemas enforce required fields, enums, numeric bounds, references as ObjectId types, and indexes. No general shared request-validation middleware was found for these Admin routes.
- Many dropdowns are database-backed, so seed the parent records before opening dependent forms. The API must still receive valid ObjectIds.
- The forms typically submit names matching schema fields, but the backend may add/derive fields or impose rules not shown in the form (linked User creation, seat updates, reviewer audit fields, and session matching).

### Uniqueness and relationship summary

- Department: unique `name`, unique `code`.
- Program: unique `{ name, department }`; seats whole numbers; available ≤ total.
- ClassSection: unique `{ name, section, semester, program }`; positive integer semester.
- Subject: globally unique `code`; credit hours 1–6; Program and Department must agree.
- AcademicSession: unique normalized `nameKey`; valid UTC date-only range; `endDate >= startDate`.
- AcademicAssignment: one active `{ subject, classSection, session }`; Teacher must be active; Teacher, Subject, ClassSection, Program and Department must agree; session must match existing AcademicSession name.
- Teacher: unique `registrationNo`, `email`, `cnic`; linked User also has unique email/CNIC.
- Student: unique `rollNo`, `email`, `cnic`; linked User email/CNIC must also be unique. Direct Program change is blocked after enrollment history except through supported transfer workflow.
- StudentEnrollment: Student/ClassSection/AcademicSession references are immutable; unique active `{ student, academicSession }`; immutable history chain stays with same Student and cannot cycle.
- Attendance: status enum `present|absent|late`; unique `{ student, subject, classSection, date }`. Its session is a string.
- AcademicRecord: marks finite and nonnegative; exam type and status enums; review remarks max 1,000 characters; no schema-level per-exam score ceiling.
- Result: obtained marks cannot exceed total marks; grade/status enums; unique `{ student, subject, classSection, session }`.
- FeeRecord: unique `challanId`; payment method enum; payment amount >0; discount cannot exceed total fee plus late fee; paid amount cannot exceed net due; fee status is recalculated by save logic.

### Generated or read-only values

- MongoDB `_id`, `createdAt`, and `updatedAt`: generated by Mongo/Mongoose.
- Department `code`: normalized uppercase by schema.
- AcademicSession `nameKey`: derived from session name. `createdBy`/`updatedBy` are authenticated User IDs.
- Teacher/Student: linked User account is generated by controller; password is hashed by `User` model.
- Admission `applicationId`: generated by server. `appliedAt`, `status`, review timestamps/user are server-managed. On approval, roll number is generated.
- Student: `dateOfAdmission`, `documentsVerified`, `status`, and `feeStatus` have defaults when omitted; direct Admin Add does not expose all of them.
- StudentEnrollment: status and created/closure audit values are generated by workflow; promotion sets `previousEnrollment`.
- AcademicRecord: Teacher and creator identity, pending status, review metadata, lock defaults are server/schema-managed.
- Attendance: teacher identity and record date/IDs are attached by workflow; new Teacher roster entries default to present.
- FeeRecord: `challanId`, payment subdocument IDs/audit user/time, balance virtual, and derived status should not be manually supplied.
- Result percentages, grade/status, and generator identity are produced by result generation workflow, not an Admin form.

## 13. Realistic university sample records

These are illustrative payload-shaped examples only. References in angle brackets are placeholders for ObjectIds obtained from actual prerequisite records. They have not been inserted.

### Admin User account

```json
{
  "name": "University Administrator",
  "email": "admin@example.edu",
  "cnic": "99999-9999999-9",
  "password": "<set a unique initial password>",
  "role": "admin"
}
```

The Admin User form accepts only `role: "admin"`; status defaults to active and the password is hashed. Do not separately create Teacher or Student Users here—their profile workflows create the linked accounts.

### Department and degree Program

```json
{
  "name": "Faculty of Computing",
  "code": "FC",
  "description": "Computing and information technology programs",
  "totalSeats": 240,
  "availableSeats": 240
}
```

```json
{
  "name": "BS Computer Science",
  "duration": 4,
  "totalSeats": 120,
  "availableSeats": 120,
  "department": "<Faculty of Computing _id>"
}
```

Program requires the Department first. Degree names are free text; BS Software Engineering, BS Information Technology, and BBA are also possible values, not built-in options.

### ClassSection and Subject

```json
{
  "name": "Semester 1",
  "section": "A",
  "semester": 1,
  "program": "<BS Computer Science _id>",
  "department": "<Faculty of Computing _id>"
}
```

```json
{
  "name": "Programming Fundamentals",
  "code": "CS101",
  "creditHours": 3,
  "program": "<BS Computer Science _id>",
  "department": "<Faculty of Computing _id>"
}
```

Class and Subject both depend on matching Program/Department records. Credit hours must be 1–6.

### Academic Session

```json
{
  "name": "2026-2027",
  "startDate": "2026-09-01",
  "endDate": "2027-06-30",
  "status": "active"
}
```

`nameKey`, audit user IDs, timestamps, and `_id` are generated. If the assignment UI is used, it must receive the exact name `2026-2027`.

### Teacher and linked User

```json
{
  "name": "Ayesha Khan",
  "registrationNo": "T-2026-014",
  "email": "ayesha.khan@example.edu",
  "cnic": "00000-0000000-0",
  "contact": "+92-300-0000000",
  "dob": "1988-04-12",
  "address": "12 University Road",
  "city": "Lahore",
  "education": "MS Computer Science",
  "role": "senior",
  "department": "<Faculty of Computing _id>",
  "password": "<set a unique initial password>"
}
```

Unique Teacher/User identity values and Department must be established. Password is input only to create the account; it is not returned as readable data.

### AcademicAssignment

```json
{
  "teacher": "<Ayesha Khan Teacher _id>",
  "subject": "<CS101 _id>",
  "classSection": "<Semester 1 Section A _id>",
  "session": "2026-2027"
}
```

Requires active Teacher, consistent department/program references, and a previously-created AcademicSession with exactly that name. `isActive` defaults true.

### Student

```json
{
  "name": "Sara Ahmed",
  "rollNo": "2026-CS-001",
  "email": "sara.ahmed@example.edu",
  "cnic": "11111-1111111-1",
  "dob": "2007-02-16",
  "contact": "+92-301-0000000",
  "address": "45 Model Town",
  "city": "Lahore",
  "program": "<BS Computer Science _id>",
  "password": "<set a unique initial password>"
}
```

Student and linked User email/CNIC and Student roll number must be unique. Program needs an available seat. The UI generates the User link and decrements the Program seat count.

### StudentEnrollment

```json
{
  "student": "<Sara Ahmed Student _id>",
  "classSection": "<Semester 1 Section A _id>",
  "academicSession": "<2026-2027 AcademicSession _id>",
  "startDate": "2026-09-01"
}
```

The active enrollment status and creator are generated. Student must be active and same Program as ClassSection; start date must be in session range.

### Attendance

```json
{
  "classId": "<Semester 1 Section A _id>",
  "subjectId": "<CS101 _id>",
  "date": "2026-09-03",
  "session": "2026-2027",
  "records": [
    {
      "studentId": "<Sara Ahmed Student _id>",
      "status": "present",
      "remarks": ""
    }
  ]
}
```

This is the Teacher Attendance service payload shape, not an Admin page form. The selected Teacher must have the active assignment and the Student must have a qualifying enrollment.

### AcademicRecord

```json
{
  "subject": "<CS101 _id>",
  "student": "<Sara Ahmed Student _id>",
  "classSection": "<Semester 1 Section A _id>",
  "marks": 8,
  "examType": "quiz",
  "session": "2026-2027",
  "remarks": "Good progress"
}
```

Submitted by assigned Teacher; starts pending review. `marks` is nonnegative, but no `quiz <= 10` limit is enforced in the inspected model/controller.

### Result

```json
{
  "student": "<Sara Ahmed Student _id>",
  "subject": "<CS101 _id>",
  "classSection": "<Semester 1 Section A _id>",
  "obtainedMarks": 42,
  "totalMarks": 50,
  "marksPercentage": 84,
  "attendancePercentage": 92,
  "grade": "B",
  "session": "2026-2027",
  "status": "pass",
  "generatedBy": "<User _id>"
}
```

Illustrative schema shape only; the inspected generator calculates these values and an Admin cannot enter this record through the Admin UI. Do not insert percentages/grades by hand unless using an explicitly supported workflow.

### FeeRecord / challan

```json
{
  "student": "<Sara Ahmed Student _id>",
  "program": "<BS Computer Science _id>",
  "classSection": "<Semester 1 Section A _id>",
  "semester": "Semester 1",
  "session": "2026-2027",
  "totalFee": 85000,
  "discount": 5000,
  "dueDate": "2026-09-15",
  "notes": "Fall semester tuition"
}
```

UI/API generates `challanId`, `status`, `paidAmount`, and audit fields. A sample nested payment (normally added using Record Payment, not during challan creation) is:

```json
{
  "amount": 40000,
  "method": "bank",
  "reference": "BANK-SLIP-2026-001"
}
```

Payment time and recorder are generated. This would leave an outstanding balance of PKR 40,000 after the PKR 5,000 discount.

### Admission

```json
{
  "name": "Sara Ahmed",
  "email": "sara.ahmed@example.edu",
  "cnic": "11111-1111111-1",
  "contact": "+92-301-0000000",
  "dob": "2007-02-16",
  "address": "45 Model Town",
  "city": "Lahore",
  "previousEducation": "Higher Secondary Certificate",
  "department": "<Faculty of Computing _id>",
  "program": "<BS Computer Science _id>",
  "documents": []
}
```

The Admin modal sends the listed applicant fields except `documents`, which is not an input in that form. Backend defaults it to an empty array. `applicationId`, pending status, and applied timestamp are generated. Approval creates Student/User and reserves a Program seat; it does not create an enrollment, assignment, attendance, result, or fee record.

## 14. Missing or unclear implementation details

- **No initial Admin bootstrap flow was confirmed.** The Admin pages require an authenticated Admin, User Management only creates Admin accounts, and public Register says registration is unavailable. How to create the first Admin account is not established by these forms.
- **Permissions shown in User Management are not persisted permissions.** The permission names are a static UI list, the selected checkbox state resets when the drawer opens, `User` has no permissions field, and the save handler submits only `role`. The only Admin-managed role option is `admin`.
- **Admission UI cannot upload documents.** The model and API support `documents: [{ name, fileUrl }]`, but the Admin submission modal has no file/document controls. The documents tab only views submitted links.
- **Teacher education documents have no upload control** in the inspected Teacher Management page. The schema accepts an array, but where file URLs originate is not confirmed.
- **Program and ClassSection do not define a course catalog by semester.** Subjects link to Program and Department only; ClassSection has an integer `semester`. No enforced semester-to-subject curriculum mapping was found.
- **Session values are inconsistent by design across models.** Enrollment uses an AcademicSession ObjectId; assignment/attendance/records/results/fees use strings. For assignment and attendance the session string must match a session name, but FeeRecord and AcademicRecord/Result schemas do not have a session reference.
- **FeeRecord UI exposes optional Program/ClassSection but backend checks only ID format** at creation; it does not confirm they correspond to the Student’s actual current Program/enrollment.
- **Fee edit is API-only from the Admin page’s perspective.** Backend update route/service exists, but `FeesFinance.jsx` does not use it.
- **Student fee summary and detailed finance records are distinct.** Student `feeStatus` is manually changeable in Student Management and maintained as compatibility; do not treat it as an installment ledger.
- **Attendance has no Admin form.** Admin role is allowed on the legacy endpoint, but the role-specific attendance UI and data dependencies are Teacher-facing.
- **No Admin Result form exists.** The result schema and generation/verification routes exist, but result entry is not performed from Admin dashboard. Teacher Results offers role-specific viewing/verification; any additional result-generation behavior beyond the inspected controllers is not confirmed.
- **Education/file storage and upload mechanism are not confirmed** by the forms and backend schema shown; schemas store file URLs rather than file binaries.
- **Currency:** Fees UI labels values PKR; currency conversion, tax, and fee schedules are not represented in the inspected FeeRecord schema.
- **Session status policy beyond workflows:** `planned`, `active`, `completed` are supported, but no rule enforces only one active session or automatic status changes based on dates.
- **Deleted-record behavior:** Controllers prevent some deletion when references exist, but not every possible historical reference/cascade rule was exhaustively verified. Preserve historical academic records and inspect response errors rather than assuming records will cascade.
- **Sample data IDs, uniqueness availability, actual dropdown contents, and current database contents are unknown.** Check actual runtime records before using any illustrative IDs or assuming a value is available.

## 15. Relevant source file paths

### Frontend routes and Admin pages

- `src/routes/AppRoutes.jsx`
- `src/pages/dashboard/admin/AdminOverview.jsx`
- `src/pages/dashboard/admin/UserManagement.jsx`
- `src/pages/dashboard/admin/AcademicStructure.jsx`
- `src/pages/dashboard/admin/AcademicSessionManagement.jsx`
- `src/pages/dashboard/admin/TeacherManagement.jsx`
- `src/pages/dashboard/admin/AcademicAssignmentManagement.jsx`
- `src/pages/dashboard/admin/StudentManagement.jsx`
- `src/pages/dashboard/admin/Admissions.jsx`
- `src/pages/dashboard/admin/AcademicRecords.jsx`
- `src/pages/dashboard/admin/FeesFinance.jsx`
- `src/pages/dashboard/teacher/TeacherAttendance.jsx` (attendance UI; not an Admin page)

### API services

- `src/services/users/userService.js`
- `src/services/departmentService.js`
- `src/services/programService.js`
- `src/services/classService.js`
- `src/services/subjectService.js`
- `src/services/academicStructureService.js`
- `src/services/academicSessionService.js`
- `src/services/teacherService.js`
- `src/services/studentService.js`
- `src/services/academicAssignmentService.js`
- `src/services/studentEnrollmentService.js`
- `src/services/admissionService.js`
- `src/services/academicRecordService.js`
- `src/services/feesFinanceService.js`
- `src/services/teacherAttendanceService.js`

### Backend schemas, controllers, routes, and mount point

- Models: `backend/models/User.js`, `Department.js`, `Program.js`, `ClassSection.js`, `Subject.js`, `AcademicSession.js`, `Teacher.js`, `Student.js`, `AcademicAssignment.js`, `StudentEnrollment.js`, `Admission.js`, `Attendance.js`, `AcademicRecord.js`, `Result.js`, `FeesFinance.js`.
- Controllers: `backend/controllers/userController.js`, `departmentController.js`, `programController.js`, `classController.js`, `subjectController.js`, `academicStructureController.js`, `academicSessionController.js`, `teacherController.js`, `studentController.js`, `academicAssignmentController.js`, `studentEnrollmentController.js`, `admissionController.js`, `attendanceController.js`, `teacherAttendanceController.js`, `academicRecordController.js`, `resultController.js`, `teacherResultsController.js`, `feesFinanceController.js`.
- Routes: `backend/routes/userRoutes.js`, `departmentRoutes.js`, `programRoutes.js`, `classRoutes.js`, `subjectRoutes.js`, `academicStructureRoutes.js`, `academicSessionRoutes.js`, `teacherRoutes.js`, `studentRoutes.js`, `academicAssignmentRoutes.js`, `studentEnrollmentRoutes.js`, `admissionRoutes.js`, `attendanceRoutes.js`, `teacherAttendanceRoutes.js`, `academicRecordRoutes.js`, `resultRoutes.js`, `teacherResultsRoutes.js`, `feesFinanceRoutes.js`.
- API mount point: `backend/server.js`. Route authorization is implemented in `backend/middlewares/authMiddleware.js` and `backend/middlewares/roleMiddleware.js`.

### Inspection summary

Successfully inspected all ten routed Admin page components and the related model/controller/route families for academic structure, sessions, users, teachers, students/enrollments, admissions, assignments, records, and fees. Also inspected the Teacher Attendance UI and its model/controller/routes to document the actual attendance data-entry path. Admin Overview was confirmed to be read-only. Admin attendance entry, Admin result entry, initial Admin bootstrap, document upload behavior, actual dropdown contents, and live database values could not be verified because they are absent from the inspected Admin forms or require runtime/database evidence.
