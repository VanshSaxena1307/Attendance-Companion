import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import {
  getStudentSchedule,
  getMentorSchedule,
  getLectureState,
  getDayOfWeekFromDate,
  getLocalDateString,
} from "../../artifacts/api-server/src/lib/postgres-timetable-repository";
import {
  sessionForUser,
  type CurrentUser,
} from "../../artifacts/api-server/src/lib/attendance-domain";
import { db, studentsTable, usersTable, sectionsTable, teachersTable, eq } from "../../lib/db/src/index";

async function runTests() {
  console.log("==================================================");
  console.log("PHASE 2 — TIMETABLE QUERY & SCHEDULE SERVICE TESTS");
  console.log("==================================================");

  // ── 1. Unit Tests for Date and Time Helpers ──
  console.log("\n[TEST 1] Date & Time Helper Functions");
  assert.strictEqual(getDayOfWeekFromDate("2026-08-31"), "MONDAY");
  assert.strictEqual(getDayOfWeekFromDate("2026-09-01"), "TUESDAY");
  assert.strictEqual(getDayOfWeekFromDate("2026-09-02"), "WEDNESDAY");
  assert.strictEqual(getDayOfWeekFromDate("2026-09-03"), "THURSDAY");
  assert.strictEqual(getDayOfWeekFromDate("2026-09-04"), "FRIDAY");

  // State evaluation on simulated time
  const simNow1 = new Date("2026-08-31T08:00:00"); // Before 08:50
  assert.strictEqual(getLectureState("08:50", "09:40", "2026-08-31", simNow1), "UPCOMING");

  const simNow2 = new Date("2026-08-31T09:15:00"); // During 08:50 - 09:40
  assert.strictEqual(getLectureState("08:50", "09:40", "2026-08-31", simNow2), "IN_PROGRESS");

  const simNow3 = new Date("2026-08-31T10:00:00"); // After 09:40
  assert.strictEqual(getLectureState("08:50", "09:40", "2026-08-31", simNow3), "COMPLETED");

  // Past and future dates
  assert.strictEqual(getLectureState("08:50", "09:40", "2026-08-20", new Date("2026-08-31")), "COMPLETED");
  assert.strictEqual(getLectureState("08:50", "09:40", "2026-09-15", new Date("2026-08-31")), "UPCOMING");
  console.log("✓ Date and ClassState helpers passed");

  // ── 2. Student Query & Filtering Tests ──
  console.log("\n[TEST 2] Student Schedule Service — Section & Batch Filtering");

  // Fetch sample students:
  // Student A: CSE-34, Lab B1, Cloud B2 (Vansh Aggarwal, roll 2503201001283)
  const [studentCse34] = await db
    .select({
      id: studentsTable.id,
      name: usersTable.name,
      rollNo: studentsTable.rollNo,
      admissionNo: studentsTable.admissionNo,
      sectionCode: sectionsTable.code,
      labBatch: studentsTable.labBatch,
      pythonBatch: studentsTable.pythonBatch,
      cloudBatch: studentsTable.cloudBatch,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
    .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
    .where(eq(studentsTable.rollNo, "2503201001283"));

  assert(studentCse34, "Sample CSE-34 student not found");
  console.log(`Testing with CSE-34 student: ${studentCse34.name} (Sec: ${studentCse34.sectionCode}, Lab: ${studentCse34.labBatch}, Cloud: ${studentCse34.cloudBatch})`);

  // Student B: CSE-35, Lab B2, Python B3 (Vansh Saxena, roll 2503201001289)
  const [studentCse35] = await db
    .select({
      id: studentsTable.id,
      name: usersTable.name,
      rollNo: studentsTable.rollNo,
      admissionNo: studentsTable.admissionNo,
      sectionCode: sectionsTable.code,
      labBatch: studentsTable.labBatch,
      pythonBatch: studentsTable.pythonBatch,
      cloudBatch: studentsTable.cloudBatch,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
    .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
    .where(eq(studentsTable.rollNo, "2503201001289"));

  assert(studentCse35, "Sample CSE-35 student not found");
  console.log(`Testing with CSE-35 student: ${studentCse35.name} (Sec: ${studentCse35.sectionCode}, Lab: ${studentCse35.labBatch}, Python: ${studentCse35.pythonBatch})`);

  // Test CSE-34 schedule on Monday (2026-08-31)
  const res34Monday = await getStudentSchedule(studentCse34.id, "2026-08-31");
  assert(res34Monday, "Schedule query returned undefined");
  // Verify student metadata
  assert.strictEqual((res34Monday as any).section, undefined); // metadata inside student
  assert.strictEqual(res34Monday.student.sectionCode, "CSE34");
  assert.strictEqual(res34Monday.day, "MONDAY");

  // Verify chronological ordering
  for (let i = 1; i < res34Monday.lectures.length; i++) {
    const prev = res34Monday.lectures[i - 1].startTime;
    const curr = res34Monday.lectures[i].startTime;
    assert(prev <= curr, `Lectures out of chronological order: ${prev} > ${curr}`);
  }

  // Verify CSE-34 lab batch filtering:
  // On Monday 08:50, CSE-34 has Lab B1 (25VA351 AK) and Lab B2 (25CS351 NY).
  // Student A has Lab B1, so should see 25VA351 and NEVER 25CS351!
  const mondayLab = res34Monday.lectures.find((l) => l.startTime === "08:50");
  assert(mondayLab, "Missing Monday 08:50 lab slot");
  assert.strictEqual(mondayLab.subjectCode, "25VA351");
  assert.strictEqual(mondayLab.batch, "B1");
  assert.strictEqual(mondayLab.batchType, "LAB");
  assert(!res34Monday.lectures.some((l) => l.subjectCode === "25CS351"), "Leak: Student B1 saw Lab B2!");
  console.log("✓ Lab batch B1 correctly matched and B2 isolated for CSE-34 student");

  // Test CSE-34 schedule on Tuesday (2026-09-01) for Cloud vs Python:
  // At 14:00, Parallel Python (B1, B2, B3) & Cloud (B1, B2, B3).
  // Student A has Cloud B2, so should see Cloud B2 (25VA302 RR) and NO Python or other Cloud batch!
  const res34Tuesday = await getStudentSchedule(studentCse34.id, "2026-09-01");
  assert(res34Tuesday, "Tuesday schedule missing");
  const tuesSpecial = res34Tuesday.lectures.find((l) => l.startTime === "14:00");
  assert(tuesSpecial, "Missing Tuesday 14:00 slot");
  assert.strictEqual(tuesSpecial.subjectCode, "25VA302");
  assert.strictEqual(tuesSpecial.batchType, "CLOUD");
  assert.strictEqual(tuesSpecial.batch, "B2");
  assert.strictEqual(tuesSpecial.teacherInitials, "RR");
  assert(!res34Tuesday.lectures.some((l) => l.subjectCode === "25VA301"), "Leak: Cloud student saw Python!");
  assert(!res34Tuesday.lectures.some((l) => l.batchType === "CLOUD" && l.batch !== "B2"), "Leak: Saw other Cloud batch!");
  console.log("✓ Cloud batch B2 correctly matched; Python and other Cloud batches isolated");

  // Test CSE-35 schedule on Tuesday (2026-09-01):
  // Student B has Python B3 and Lab B2.
  const res35Tuesday = await getStudentSchedule(studentCse35.id, "2026-09-01");
  assert(res35Tuesday, "CSE-35 Tuesday schedule missing");
  assert.strictEqual(res35Tuesday.student.sectionCode, "CSE35");

  // Verify section isolation: All lectures must belong to CSE-35
  for (const lec of res35Tuesday.lectures) {
    assert.strictEqual(lec.section, "CSE35", `Leak: Non-CSE35 lecture returned: ${lec.section}`);
  }

  // At 14:00, Student B should see Python B3 (25VA301 PKS, AB-107) and NO Cloud
  const tues35Py = res35Tuesday.lectures.find((l) => l.startTime === "14:00");
  assert(tues35Py, "Missing CSE-35 Tuesday 14:00 slot");
  assert.strictEqual(tues35Py.subjectCode, "25VA301");
  assert.strictEqual(tues35Py.batchType, "PYTHON");
  assert.strictEqual(tues35Py.batch, "B3");
  assert.strictEqual(tues35Py.teacherInitials, "PKS");
  assert(!res35Tuesday.lectures.some((l) => l.subjectCode === "25VA302"), "Leak: Python student saw Cloud!");

  // At 15:40, CSE-35 Tuesday has Lab B2 (25CS351 NY) and Lab B1 (25VA351 VM).
  // Student B has Lab B2, so should see 25CS351 NY and NOT 25VA351 VM.
  const tues35Lab = res35Tuesday.lectures.find((l) => l.startTime === "15:40");
  assert(tues35Lab, "Missing CSE-35 Tuesday 15:40 slot");
  assert.strictEqual(tues35Lab.subjectCode, "25CS351");
  assert.strictEqual(tues35Lab.batch, "B2");
  assert(!res35Tuesday.lectures.some((l) => l.subjectCode === "25VA351"), "Leak: Lab B2 student saw Lab B1!");
  console.log("✓ Python batch B3 and Lab B2 correctly matched and isolated for CSE-35 student");

  // ── 3. Mentor Schedule Service Tests ──
  console.log("\n[TEST 3] Mentor Schedule Service");

  // Test Mentor 1: Ms. Malvika Gupta (MTR_ADS_01)
  const [mentorMG] = await db
    .select({
      id: teachersTable.id,
      teacherCode: teachersTable.teacherCode,
      name: usersTable.name,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .where(eq(teachersTable.teacherCode, "MTR_ADS_01"));

  assert(mentorMG, "Mentor MG not found");
  const mgMonday = await getMentorSchedule(mentorMG.id, "2026-08-31");
  assert(mgMonday, "Mentor schedule returned undefined");
  assert.strictEqual(mgMonday.mentor.teacherCode, "MTR_ADS_01");

  // Ms. Malvika Gupta teaches CSE-34 ADS at 10:40 and 14:00 on Monday
  console.log(`Mentor MG Monday lectures: ${mgMonday.lectures.length}`);
  assert(mgMonday.lectures.length >= 2, "Mentor MG should have at least 2 lectures on Monday");
  for (const lec of mgMonday.lectures) {
    assert.strictEqual(lec.teacherId, mentorMG.id, "Leak: Returned lecture for another teacher");
    assert.strictEqual(lec.section, "CSE34", "Mentor MG only teaches CSE-34");
  }

  // Test Mentor 2: Ms. Nidhi Yadav (MTR_OOP_01) — Multi-section mentor (teaches both CSE34 and CSE35)
  const [mentorNY] = await db
    .select({
      id: teachersTable.id,
      teacherCode: teachersTable.teacherCode,
      name: usersTable.name,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .where(eq(teachersTable.teacherCode, "MTR_OOP_01"));

  assert(mentorNY, "Mentor NY not found");
  const nyMonday = await getMentorSchedule(mentorNY.id, "2026-08-31");
  assert(nyMonday, "Mentor NY schedule missing");
  console.log(`Multi-section Mentor NY Monday lectures: ${nyMonday.lectures.length}`);
  const sectionsTaught = new Set(nyMonday.lectures.map((l) => l.section));
  assert(sectionsTaught.has("CSE34"), "NY should teach CSE-34");
  assert(sectionsTaught.has("CSE35"), "NY should teach CSE-35");
  console.log("✓ Multi-section mentor correctly aggregates lectures across CSE-34 and CSE-35");

  // ── 4. Attendance Status Determination Tests ──
  console.log("\n[TEST 4] Attendance Status Determination");
  // Check attendance on a date with actual recorded attendance in Attendance_Demo.xlsx (e.g. 2026-08-24)
  const resAttTest = await getStudentSchedule(studentCse35.id, "2026-08-24");
  assert(resAttTest, "Attendance test schedule missing");
  const uploadedLecs = resAttTest.lectures.filter((l) =>
    l.attendanceStatus === "ATTENDANCE_UPLOADED_PRESENT" || l.attendanceStatus === "ATTENDANCE_UPLOADED_ABSENT"
  );
  console.log(`Lectures with confirmed uploaded attendance on 2026-08-24: ${uploadedLecs.length}`);
  assert(uploadedLecs.length > 0, "Expected attendance records for student on demo attendance date");

  // Check a future/unrecorded date (e.g. 2026-10-05)
  const resFuture = await getStudentSchedule(studentCse35.id, "2026-10-05");
  assert(resFuture, "Future schedule missing");
  for (const lec of resFuture.lectures) {
    if (lec.subjectId) {
      assert.strictEqual(lec.attendanceStatus, "ATTENDANCE_NOT_UPLOADED", "Future class should have ATTENDANCE_NOT_UPLOADED");
    } else {
      assert.strictEqual(lec.attendanceStatus, "ATTENDANCE_NOT_APPLICABLE", "No-subject class should have ATTENDANCE_NOT_APPLICABLE");
    }
  }
  console.log("✓ Attendance status correctly distinguishes uploaded vs unuploaded vs not applicable");

  // ── 5. HTTP Endpoints & Role Authorization Tests ──
  console.log("\n[TEST 5] HTTP REST API Endpoints & Role Authorization");
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 5.1 Unauthenticated request should be rejected with 401
    const resNoAuth = await fetch(`${baseUrl}/api/student/schedule/today`);
    assert.strictEqual(resNoAuth.status, 401, "Expected 401 for unauthenticated request");
    console.log("✓ Unauthenticated request rejected with HTTP 401");

    // 5.2 Create student session and test /api/student/schedule/today
    const studentUser: CurrentUser = {
      id: studentCse35.id,
      name: studentCse35.name,
      email: "vansh@test.local",
      role: "STUDENT",
      initials: "VS",
      department: "CSE",
    };
    const studentSessionToken = sessionForUser(studentUser);

    const resStudent = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${studentSessionToken}` },
    });
    assert.strictEqual(resStudent.status, 200, `Student schedule failed with ${resStudent.status}`);
    const studentData = (await resStudent.json()) as any;
    assert.strictEqual(studentData.day, "MONDAY");
    assert.strictEqual(studentData.student.rollNo, "2503201001289");
    assert(Array.isArray(studentData.lectures), "lectures should be an array");
    console.log(`✓ Authenticated student received HTTP 200 with ${studentData.lectures.length} lectures`);

    // 5.3 Student trying to access mentor endpoint should be rejected with 403
    const resStudentOnMentor = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${studentSessionToken}` },
    });
    assert.strictEqual(resStudentOnMentor.status, 403, "Student should be forbidden from mentor endpoint");
    console.log("✓ Student role rejected from mentor endpoint with HTTP 403");

    // 5.4 Create mentor session and test /api/mentor/schedule/today
    const mentorUser: CurrentUser = {
      id: mentorMG.id,
      name: mentorMG.name,
      email: "malvika@test.local",
      role: "MENTOR",
      initials: "MG",
      department: "CSE",
    };
    const mentorSessionToken = sessionForUser(mentorUser);

    const resMentor = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${mentorSessionToken}` },
    });
    assert.strictEqual(resMentor.status, 200, `Mentor schedule failed with ${resMentor.status}`);
    const mentorData = (await resMentor.json()) as any;
    assert.strictEqual(mentorData.mentor.teacherCode, "MTR_ADS_01");
    assert(Array.isArray(mentorData.lectures), "lectures should be an array");
    console.log(`✓ Authenticated mentor received HTTP 200 with ${mentorData.lectures.length} lectures`);

    // 5.5 Mentor trying to access student endpoint should be rejected with 403
    const resMentorOnStudent = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${mentorSessionToken}` },
    });
    assert.strictEqual(resMentorOnStudent.status, 403, "Mentor should be forbidden from student endpoint");
    console.log("✓ Mentor role rejected from student endpoint with HTTP 403");

    // 5.6 Invalid query format validation
    const resInvalidQuery = await fetch(`${baseUrl}/api/student/schedule/today?date=not-a-date`, {
      headers: { Cookie: `ac_session=${studentSessionToken}` },
    });
    assert.strictEqual(resInvalidQuery.status, 400, "Invalid date format should return 400");
    console.log("✓ Invalid date format rejected with HTTP 400");

  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log("ALL PHASE 2 TESTS PASSED SUCCESSFULLY! (100% OK)");
  console.log("==================================================");
}

runTests()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    // End pool if needed
    process.exit(process.exitCode || 0);
  });
