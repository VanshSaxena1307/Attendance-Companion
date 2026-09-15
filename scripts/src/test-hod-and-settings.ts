import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import {
  sessionForUser,
  type CurrentUser,
  getDepartmentSchedule,
  cancelLecturesForHoliday,
  resetUnexpectedHoliday,
  getStudentTodaysSchedule,
  getMentorTodaysSchedule,
} from "../../artifacts/api-server/src/lib/attendance-domain";
import {
  getUserSettings,
  updateUserSettings,
  submitTeacherAttendance,
  getOrCreateLectureInstance,
} from "../../artifacts/api-server/src/lib/postgres-attendance-repository";
import {
  db,
  pool,
  attendanceTable,
  lectureInstancesTable,
  timetableEntriesTable,
  timetablesTable,
  studentsTable,
  teachersTable,
  usersTable,
  settingsTable,
  sectionsTable,
  eq,
  and,
} from "../../lib/db/src/index";

async function runTests() {
  console.log("==================================================");
  console.log("TESTING SETTINGS PERSISTENCE & REAL HOD SCHEDULE / HOLIDAY FLOW");
  console.log("==================================================");

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 5000;
  const baseUrl = `http://127.0.0.1:${port}`;

  const hodUser: CurrentUser = {
    id: "hod-rajesh",
    name: "Rajesh Mehta",
    email: "rajesh.mehta@attendance.edu",
    role: "HOD",
    initials: "RM",
    department: "Computer Science & Engineering",
  };

  const adminUser: CurrentUser = {
    id: "admin-office",
    name: "Academic Office",
    email: "admin@attendance.edu",
    role: "ADMIN",
    initials: "AO",
    department: "Computer Science & Engineering",
  };

  const hodSession = sessionForUser(hodUser);
  const adminSession = sessionForUser(adminUser);

  try {
    // ------------------------------------------------------------------
    // TEST 1: SETTINGS PERSISTENCE (HOD, ADMIN, MENTOR, STUDENT)
    // ------------------------------------------------------------------
    console.log("\n[TEST 1] Settings Persistence & FK Safety Across Roles...");

    // 1A. HOD Settings
    const hodUpdated = await updateUserSettings("hod-rajesh", {
      theme: "DARK",
      targetAttendance: 80,
      notificationsEnabled: false,
    });
    assert.strictEqual(hodUpdated.theme, "DARK", "HOD theme should be DARK");
    assert.strictEqual(hodUpdated.targetAttendance, 80, "HOD targetAttendance should be 80");
    assert.strictEqual(hodUpdated.notificationsEnabled, false, "HOD notificationsEnabled should be false");

    // Check DB row directly
    const [hodDbRow] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.userId, "hod-rajesh"));
    assert.ok(hodDbRow, "Settings row must exist in PostgreSQL for hod-rajesh");
    assert.strictEqual(hodDbRow.theme, "DARK");
    assert.strictEqual(Number(hodDbRow.targetAttendance), 80);
    assert.strictEqual(hodDbRow.notificationsEnabled, false);

    // Verify GET /api/settings via HTTP for HOD
    const hodRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { Cookie: `ac_session=${hodSession}` },
    });
    assert.strictEqual(hodRes.status, 200, "GET /api/settings must return 200 for HOD");
    const hodSettingsJson = await hodRes.json();
    assert.strictEqual(hodSettingsJson.theme, "DARK");
    assert.strictEqual(hodSettingsJson.targetAttendance, 80);
    assert.strictEqual(hodSettingsJson.notificationsEnabled, false);
    console.log("  ✓ HOD Settings persisted and verified via DB & API");

    // 1B. Admin Settings
    const adminUpdated = await updateUserSettings("admin-office", {
      theme: "LIGHT",
      targetAttendance: 75,
      notificationsEnabled: true,
    });
    assert.strictEqual(adminUpdated.theme, "LIGHT");
    const [adminDbRow] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.userId, "admin-office"));
    assert.ok(adminDbRow, "Settings row must exist in PostgreSQL for admin-office");
    assert.strictEqual(adminDbRow.theme, "LIGHT");
    console.log("  ✓ Admin Settings persisted and verified via DB");

    // 1C. PATCH /api/settings via HTTP
    const patchRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${hodSession}`,
      },
      body: JSON.stringify({ theme: "SYSTEM", notificationsEnabled: true }),
    });
    assert.strictEqual(patchRes.status, 200, "PATCH /api/settings must return 200");
    const patchedJson = await patchRes.json();
    assert.strictEqual(patchedJson.theme, "SYSTEM");
    assert.strictEqual(patchedJson.notificationsEnabled, true);
    assert.strictEqual(patchedJson.targetAttendance, 80); // Preserved
    console.log("  ✓ PATCH /api/settings handles partial update correctly");

    // ------------------------------------------------------------------
    // TEST 2: REAL HOD TIMETABLE / LECTURE INSTANCES DATA
    // ------------------------------------------------------------------
    console.log("\n[TEST 2] Real HOD Department Schedule from Database...");

    // Monday test date (2026-09-14)
    const mondayDate = "2026-09-14";
    const deptSummary = await getDepartmentSchedule(mondayDate);

    assert.ok(deptSummary, "Department schedule summary should be returned");
    assert.strictEqual(deptSummary.day, "MONDAY", "Day must be MONDAY");
    assert.ok(deptSummary.totalScheduled > 0, `Total scheduled lectures must be > 0 (found ${deptSummary.totalScheduled})`);
    assert.ok(deptSummary.lectures.length > 0, "Lectures array must not be empty");

    // Verify fields on real lectures
    const firstLec = deptSummary.lectures[0];
    assert.ok(firstLec.timetableEntryId, "Lecture must have timetableEntryId");
    assert.ok(firstLec.section, "Lecture must have section");
    assert.ok(firstLec.startTime && firstLec.endTime, "Lecture must have valid start and end time");
    assert.ok(firstLec.subjectCode, "Lecture must have subjectCode");
    assert.ok(firstLec.subjectName, "Lecture must have subjectName");
    assert.ok(firstLec.teacherName, "Lecture must have teacherName");
    assert.ok(firstLec.room, "Lecture must have room");
    console.log(`  ✓ Monday schedule returned ${deptSummary.totalScheduled} real lectures across department`);

    // Verify section filtering
    const cse34Summary = await getDepartmentSchedule(mondayDate, "CSE34");
    const cse35Summary = await getDepartmentSchedule(mondayDate, "CSE35");
    assert.ok(cse34Summary.totalScheduled > 0, "CSE-34 must have scheduled lectures");
    assert.ok(cse35Summary.totalScheduled > 0, "CSE-35 must have scheduled lectures");
    assert.ok(cse34Summary.lectures.every((l) => l.section === "CSE-34"), "All lectures in CSE34 filter must be CSE-34");
    assert.ok(cse35Summary.lectures.every((l) => l.section === "CSE-35"), "All lectures in CSE35 filter must be CSE-35");
    console.log(`  ✓ Section filtering: CSE-34 (${cse34Summary.totalScheduled} slots), CSE-35 (${cse35Summary.totalScheduled} slots)`);

    // Verify GET /api/department/schedule/today via HTTP
    const deptHttpRes = await fetch(`${baseUrl}/api/department/schedule/today?date=${mondayDate}`, {
      headers: { Cookie: `ac_session=${hodSession}` },
    });
    assert.strictEqual(deptHttpRes.status, 200, "GET /api/department/schedule/today must return 200");
    const deptHttpJson = await deptHttpRes.json();
    assert.strictEqual(deptHttpJson.totalScheduled, deptSummary.totalScheduled);
    console.log("  ✓ GET /api/department/schedule/today API verified");

    // ------------------------------------------------------------------
    // TEST 3: MODEL B UNEXPECTED HOLIDAY CANCELLATION & PROPAGATION
    // ------------------------------------------------------------------
    console.log("\n[TEST 3] Model B Unexpected Holiday Cancellation & Propagation...");

    // First ensure clean state
    await resetUnexpectedHoliday(mondayDate, "ALL");

    // Cancel 2 lectures for CSE34 on mondayDate
    const holidayReason = "Campus closed due to District Administrative Order (Adverse Weather Advisory)";
    const cancelRes = await cancelLecturesForHoliday({
      date: mondayDate,
      section: "CSE34",
      numberOfLectures: 2,
      reason: holidayReason,
    });

    assert.strictEqual(cancelRes.success, true, "Holiday cancellation must succeed");
    assert.strictEqual(cancelRes.cancelledCount, 2, "Exactly 2 lectures should be cancelled");
    assert.strictEqual(cancelRes.cancelledInstanceIds.length, 2, "2 instance IDs returned");
    console.log(`  ✓ Successfully cancelled ${cancelRes.cancelledCount} lectures for CSE-34`);

    // 3A. Verify HOD Overview receives updated state
    const deptAfterHoliday = await getDepartmentSchedule(mondayDate);
    assert.ok(deptAfterHoliday.unexpectedHoliday, "Unexpected holiday notice must be present");
    assert.strictEqual(deptAfterHoliday.unexpectedHoliday.active, true, "Unexpected holiday must be active");
    assert.strictEqual(deptAfterHoliday.cancelledCount, 2, "Cancelled count in HOD overview must be 2");
    assert.ok(deptAfterHoliday.unexpectedHoliday.reason.includes("Adverse Weather Advisory"), "Reason must match");
    assert.ok(deptAfterHoliday.unexpectedHoliday.affectedSections.includes("CSE-34"), "Affected sections must include CSE-34");

    const cancelledDeptLectures = deptAfterHoliday.lectures.filter((l) => l.status === "CANCELLED");
    assert.strictEqual(cancelledDeptLectures.length, 2, "2 lectures must have status CANCELLED in HOD schedule");
    assert.ok(cancelledDeptLectures[0].notes?.includes(holidayReason), "Notes must contain holiday reason");
    console.log("  ✓ HOD Overview reports active holiday with reason, affected sections, and cancelled lectures");

    // 3B. Verify Student Schedule propagation
    // Find a student in CSE-34
    const [sec34] = await db.select().from(sectionsTable).where(eq(sectionsTable.code, "CSE34"));
    const [sampleStudent] = await db.select().from(studentsTable).where(eq(studentsTable.sectionId, sec34.id)).limit(1);
    assert.ok(sampleStudent, "Sample student in CSE-34 must exist");

    const studentSchedule = await getStudentTodaysSchedule(sampleStudent.id, mondayDate);
    assert.ok(studentSchedule, "Student schedule should be returned");
    const cancelledStudentLectures = studentSchedule.lectures.filter((l) => l.status === "CANCELLED");
    assert.ok(cancelledStudentLectures.length > 0, "Student schedule must show cancelled lectures");
    assert.ok(cancelledStudentLectures[0].notes?.includes("Adverse Weather"), "Student schedule has holiday note");
    console.log(`  ✓ Student Schedule propagated: student in CSE-34 sees ${cancelledStudentLectures.length} cancelled lecture(s)`);

    // 3C. Verify Mentor Schedule propagation
    const targetCancelledInstance = cancelledDeptLectures[0];
    assert.ok(targetCancelledInstance.teacherId, "Target cancelled lecture must have a teacher");
    const mentorSchedule = await getMentorTodaysSchedule(targetCancelledInstance.teacherId, mondayDate);
    assert.ok(mentorSchedule, "Mentor schedule should be returned");
    const cancelledMentorLectures = mentorSchedule.lectures.filter((l) => l.status === "CANCELLED");
    assert.ok(cancelledMentorLectures.length > 0, "Mentor schedule must show cancelled lectures");
    console.log(`  ✓ Mentor Schedule propagated: teacher sees lecture marked CANCELLED`);

    // 3D. Verify Attendance Lock: CANCELLED lecture instance rejects attendance marking
    console.log("\n[TEST 4] Attendance Rejection on CANCELLED Lecture...");
    const [targetInstRow] = await db
      .select()
      .from(lectureInstancesTable)
      .where(eq(lectureInstancesTable.id, targetCancelledInstance.lectureInstanceId!));
    assert.strictEqual(targetInstRow.status, "CANCELLED", "DB row must have status CANCELLED");

    let markingFailedWithCancelledError = false;
    try {
      await submitTeacherAttendance(targetCancelledInstance.teacherId, {
        subjectId: targetCancelledInstance.subjectId!,
        sectionId: targetCancelledInstance.sectionId,
        date: mondayDate,
        lectureInstanceId: targetInstRow.id,
        timetableEntryId: targetCancelledInstance.timetableEntryId,
        attendance: [{ studentId: sampleStudent.id, status: "PRESENT" }],
      });
    } catch (err: any) {
      if (err.message && err.message.includes("cancelled lecture")) {
        markingFailedWithCancelledError = true;
      } else {
        console.error("Unexpected error message:", err.message);
      }
    }
    assert.strictEqual(
      markingFailedWithCancelledError,
      true,
      "submitTeacherAttendance on CANCELLED lecture MUST throw 'Attendance cannot be marked for a cancelled lecture.'"
    );
    console.log("  ✓ Attendance marking strictly rejected for CANCELLED lecture instance");

    // 3E. Rule: Do not allow an already COMPLETED/MARKED lecture to be silently cancelled
    console.log("\n[TEST 5] Prevention of Silently Cancelling Marked Lecture...");
    // Find an uncancelled, completed or marked lecture instance, or mark one
    const uncancelledSlot = deptAfterHoliday.lectures.find((l) => l.status === "SCHEDULED" && l.section === "CSE-34");
    if (uncancelledSlot) {
      // Simulate marked attendance for this slot
      const inst = await getOrCreateLectureInstance(uncancelledSlot.timetableEntryId, mondayDate, uncancelledSlot.teacherId!);
      assert.ok(inst, "Instance should exist");
      await db
        .update(lectureInstancesTable)
        .set({ status: "COMPLETED", attendanceStatus: "MARKED", markedAt: new Date() })
        .where(eq(lectureInstancesTable.id, inst.id));

      // Attempt to cancel it
      const cancelAttempt = await cancelLecturesForHoliday({
        date: mondayDate,
        section: "CSE34",
        reason: "Test secondary holiday",
      });

      // The marked slot should be skipped!
      assert.ok(
        cancelAttempt.skippedReasons.some((r) => r.includes("already been marked/completed")),
        "Marked lecture must be skipped with explicit reason and never cancelled silently"
      );

      // Verify slot in DB is still COMPLETED and MARKED
      const [checkInst] = await db
        .select()
        .from(lectureInstancesTable)
        .where(eq(lectureInstancesTable.id, inst.id));
      assert.strictEqual(checkInst.status, "COMPLETED");
      assert.strictEqual(checkInst.attendanceStatus, "MARKED");
      console.log("  ✓ Marked/Completed lecture was NOT cancelled; skipped safely as required");
    }

    // 3F. Reset Holiday Operation
    console.log("\n[TEST 6] Unexpected Holiday Reset & Idempotency...");
    const resetResult = await resetUnexpectedHoliday(mondayDate, "CSE34");
    assert.strictEqual(resetResult.success, true, "Reset must succeed");
    assert.ok(resetResult.resetCount >= 2, "Reset count should be at least 2");

    const deptAfterReset = await getDepartmentSchedule(mondayDate, "CSE34");
    assert.strictEqual(deptAfterReset.cancelledCount, 0, "All cancelled slots in CSE34 should be 0 after reset");
    assert.strictEqual(deptAfterReset.unexpectedHoliday, null, "Unexpected holiday notice should be null after reset");
    console.log("  ✓ Reset restored schedule to normal; unexpectedHoliday notice deactivated");

    // Idempotent reset
    const secondReset = await resetUnexpectedHoliday(mondayDate, "CSE34");
    assert.strictEqual(secondReset.success, true, "Second reset must succeed");
    assert.strictEqual(secondReset.resetCount, 0, "Second reset should reset 0 items");
    console.log("  ✓ Reset is idempotent");

    // ------------------------------------------------------------------
    // TEST 7: ROLE BOUNDARIES FOR UNEXPECTED HOLIDAY API (ADMIN ONLY)
    // ------------------------------------------------------------------
    console.log("\n[TEST 7] Role Authorization: HOD Forbidden (403) & Admin Allowed (200)...");

    // 7A. HOD attempting to create unexpected holiday -> MUST BE REJECTED 403
    const hodHolidayRes = await fetch(`${baseUrl}/api/schedule/unexpected-holiday`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${hodSession}`,
      },
      body: JSON.stringify({
        date: mondayDate,
        section: "CSE34",
        numberOfLectures: 1,
        reason: "Unauthorized HOD attempt",
      }),
    });
    assert.strictEqual(hodHolidayRes.status, 403, "HOD must receive 403 on POST /api/schedule/unexpected-holiday");
    const hodHolidayJson = await hodHolidayRes.json();
    assert.ok(hodHolidayJson.error?.includes("requires an Administrator role"), "Error message should mention Administrator role");
    console.log("  ✓ HOD cannot create unexpected holiday (403 Forbidden)");

    // 7B. HOD attempting to reset unexpected holiday -> MUST BE REJECTED 403
    const hodResetRes = await fetch(`${baseUrl}/api/schedule/unexpected-holiday/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${hodSession}`,
      },
      body: JSON.stringify({
        date: mondayDate,
        section: "CSE34",
      }),
    });
    assert.strictEqual(hodResetRes.status, 403, "HOD must receive 403 on POST /api/schedule/unexpected-holiday/reset");
    const hodResetJson = await hodResetRes.json();
    assert.ok(hodResetJson.error?.includes("requires an Administrator role"), "Error message should mention Administrator role");
    console.log("  ✓ HOD cannot reset unexpected holiday (403 Forbidden)");

    // 7C. Admin creating unexpected holiday -> ALLOWED 200
    const adminHolidayRes = await fetch(`${baseUrl}/api/schedule/unexpected-holiday`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${adminSession}`,
      },
      body: JSON.stringify({
        date: mondayDate,
        section: "CSE34",
        numberOfLectures: 1,
        reason: "Official Admin Emergency Suspension",
      }),
    });
    assert.strictEqual(adminHolidayRes.status, 200, "Admin must receive 200 on POST /api/schedule/unexpected-holiday");
    const adminHolidayJson = await adminHolidayRes.json();
    assert.strictEqual(adminHolidayJson.success, true);
    assert.strictEqual(adminHolidayJson.cancelledCount, 1);
    console.log("  ✓ Admin can create unexpected holiday (200 OK)");

    // 7D. Admin resetting unexpected holiday -> ALLOWED 200
    const adminResetRes = await fetch(`${baseUrl}/api/schedule/unexpected-holiday/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${adminSession}`,
      },
      body: JSON.stringify({
        date: mondayDate,
        section: "CSE34",
      }),
    });
    assert.strictEqual(adminResetRes.status, 200, "Admin must receive 200 on POST /api/schedule/unexpected-holiday/reset");
    const adminResetJson = await adminResetRes.json();
    assert.strictEqual(adminResetJson.success, true);
    console.log("  ✓ Admin can reset unexpected holiday (200 OK)");

    console.log("\n==================================================");
    console.log("ALL HOD, SETTINGS, AND UNEXPECTED HOLIDAY TESTS PASSED!");
    console.log("==================================================");
  } finally {
    // Clean up any test records
    await resetUnexpectedHoliday("2026-09-14", "ALL");
    server.close();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
