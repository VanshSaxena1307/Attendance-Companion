import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import {
  sessionForUser,
  type CurrentUser,
} from "../../artifacts/api-server/src/lib/attendance-domain";
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
  teacherSubjectSectionsTable,
  eq,
  and,
  sql,
} from "../../lib/db/src/index";
import { getOrCreateLectureInstance } from "../../artifacts/api-server/src/lib/postgres-attendance-repository";

async function runLockAndNotificationTests() {
  console.log("==================================================");
  console.log("TESTING NOTIFICATIONS TOGGLE & TEACHER ATTENDANCE LOCK");
  console.log("==================================================");

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── PART A: NOTIFICATIONS TOGGLE TESTS ──
    console.log("\n── PART A: NOTIFICATIONS TOGGLE ──");

    // 1. Resolve student user
    const [student] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, "student-vansh"));
    assert(student, "User student-vansh must exist");

    const studentUser: CurrentUser = {
      id: student.id,
      name: student.name,
      email: student.email ?? "student@test.local",
      role: "STUDENT",
      initials: "VS",
      department: "CSE",
    };
    const studentToken = sessionForUser(studentUser);

    console.log("[TEST A1] Initial GET /api/settings");
    const initialGetRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { Cookie: `ac_session=${studentToken}` },
    });
    assert.strictEqual(initialGetRes.status, 200);
    const initialSettings = await initialGetRes.json();
    console.log("✓ Initial settings returned:", initialSettings);

    console.log("[TEST A2] Toggle OFF: PATCH /api/settings { notificationsEnabled: false }");
    const patchOffRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${studentToken}`,
      },
      body: JSON.stringify({ notificationsEnabled: false }),
    });
    assert.strictEqual(patchOffRes.status, 200);
    const patchOffData = await patchOffRes.json();
    assert.strictEqual(patchOffData.notificationsEnabled, false, "Response notificationsEnabled must be false");
    console.log("✓ PATCH notificationsEnabled: false returned 200 OK");

    // Verify persisted directly in PostgreSQL
    const [dbRowOff] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.userId, "student-vansh"));
    assert(dbRowOff, "settings row in PostgreSQL must exist");
    assert.strictEqual(dbRowOff.notificationsEnabled, false, "PostgreSQL row must have notifications_enabled = false");
    console.log("✓ PostgreSQL persistence verified: notifications_enabled is false in DB");

    // Verify GET /api/settings after refresh
    const getOffRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { Cookie: `ac_session=${studentToken}` },
    });
    assert.strictEqual(getOffRes.status, 200);
    const getOffData = await getOffRes.json();
    assert.strictEqual(getOffData.notificationsEnabled, false, "Refreshed settings must have notificationsEnabled = false");
    console.log("✓ GET /api/settings returns persisted false after reload");

    console.log("[TEST A3] Toggle ON: PATCH /api/settings { notificationsEnabled: true }");
    const patchOnRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${studentToken}`,
      },
      body: JSON.stringify({ notificationsEnabled: true }),
    });
    assert.strictEqual(patchOnRes.status, 200);
    const patchOnData = await patchOnRes.json();
    assert.strictEqual(patchOnData.notificationsEnabled, true, "Response notificationsEnabled must be true");

    // Verify persisted directly in PostgreSQL
    const [dbRowOn] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.userId, "student-vansh"));
    assert.strictEqual(dbRowOn?.notificationsEnabled, true, "PostgreSQL row must have notifications_enabled = true");
    console.log("✓ Toggle ON persisted and verified in PostgreSQL");

    console.log("[TEST A4] Invalid PATCH rejected and does not corrupt state");
    const invalidPatchRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${studentToken}`,
      },
      body: JSON.stringify({ notificationsEnabled: "NOT_A_BOOLEAN" }),
    });
    assert.strictEqual(invalidPatchRes.status, 400, "Invalid payload must return HTTP 400");
    console.log("✓ Invalid PATCH rejected with HTTP 400");

    // ── PART B: TEACHER ATTENDANCE LOCK TESTS ──
    console.log("\n── PART B: TEACHER ATTENDANCE LOCK ──");

    // Setup test teacher
    const [teacher] = await db
      .select({
        id: teachersTable.id,
        teacherCode: teachersTable.teacherCode,
        name: usersTable.name,
        email: usersTable.email,
        initials: usersTable.initials,
      })
      .from(teachersTable)
      .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
      .where(eq(teachersTable.teacherCode, "MTR_ADS_01"));
    assert(teacher, "Teacher MTR_ADS_01 not found");

    const teacherUser: CurrentUser = {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email ?? "ads@test.local",
      role: "MENTOR",
      initials: teacher.initials,
      department: "CSE",
    };
    const teacherToken = sessionForUser(teacherUser);

    // Get teacher's assigned section & subject
    const [assignment] = await db
      .select()
      .from(teacherSubjectSectionsTable)
      .where(eq(teacherSubjectSectionsTable.teacherId, teacher.id));
    assert(assignment, "Teacher assignment not found");

    const [timetable] = await db
      .select()
      .from(timetablesTable)
      .where(and(eq(timetablesTable.sectionId, assignment.sectionId), eq(timetablesTable.status, "ACTIVE")));
    assert(timetable, "Active timetable not found");

    const testSlotAId = `test_lock_slot_A_${Date.now()}`;
    const testSlotBId = `test_lock_slot_B_${Date.now()}`;
    const testDate = "2026-08-31"; // Historical Monday

    await db.insert(timetableEntriesTable).values([
      {
        id: testSlotAId,
        timetableId: timetable.id,
        sectionId: assignment.sectionId,
        dayOfWeek: "MONDAY",
        startTime: "08:30",
        endTime: "09:20",
        subjectId: assignment.subjectId,
        subjectCode: "TEST_LOCK_A",
        subjectName: "Test Lock Subject A",
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        batchType: "FULL",
        batch: "ALL",
        room: "ROOM_LOCK_A",
        lectureType: "THEORY",
      },
      {
        id: testSlotBId,
        timetableId: timetable.id,
        sectionId: assignment.sectionId,
        dayOfWeek: "MONDAY",
        startTime: "14:00",
        endTime: "14:50",
        subjectId: assignment.subjectId,
        subjectCode: "TEST_LOCK_B",
        subjectName: "Test Lock Subject B",
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        batchType: "FULL",
        batch: "ALL",
        room: "ROOM_LOCK_B",
        lectureType: "THEORY",
      },
    ]);

    const students = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.sectionId, assignment.sectionId));
    assert(students.length > 0, "Enrolled students must exist");

    const instanceA = await getOrCreateLectureInstance(testSlotAId, testDate, teacher.id);
    const instanceB = await getOrCreateLectureInstance(testSlotBId, testDate, teacher.id);
    assert(instanceA && instanceB, "Test lecture instances must be created");

    console.log("[TEST B1] New lecture instance starts UNLOCKED");
    assert.strictEqual(instanceA.attendanceStatus, "UNMARKED");
    console.log("✓ Lecture instance A starts UNMARKED");

    console.log("[TEST B2] First save: attendance saved and lecture transitions to MARKED");
    const payloadA = {
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      date: testDate,
      timetableEntryId: testSlotAId,
      lectureInstanceId: instanceA.id,
      attendance: students.map((s) => ({ studentId: s.id, status: "PRESENT" as const })),
    };

    const firstSaveRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify(payloadA),
    });
    assert.strictEqual(firstSaveRes.status, 200, `First save must return 200 OK, got ${firstSaveRes.status}`);
    console.log("✓ First save succeeded with 200 OK");

    // Verify in database that lecture instance is MARKED
    const [instACheck] = await db
      .select()
      .from(lectureInstancesTable)
      .where(eq(lectureInstancesTable.id, instanceA.id));
    assert.strictEqual(instACheck?.attendanceStatus, "MARKED", "Lecture instance must be MARKED");
    assert.strictEqual(instACheck?.status, "COMPLETED", "Lecture instance status must be COMPLETED");
    assert(instACheck?.markedAt, "markedAt timestamp must be recorded");
    console.log("✓ Lecture instance A transitioned to attendanceStatus: MARKED, status: COMPLETED");

    console.log("[TEST B3] Second save attempt by same teacher is REJECTED (Server-side lock)");
    const secondSaveRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify(payloadA),
    });
    assert.strictEqual(secondSaveRes.status, 400, "Second save must be rejected with 400");
    const secondSaveData = (await secondSaveRes.json()) as any;
    assert.strictEqual(
      secondSaveData.error,
      "Attendance for this lecture has already been submitted and is locked."
    );
    console.log("✓ Second save strictly rejected with HTTP 400 and locked message");

    console.log("[TEST B4] Direct API write attempt with modified marks is REJECTED");
    const modifiedPayload = {
      ...payloadA,
      attendance: students.map((s, idx) => ({
        studentId: s.id,
        status: (idx === 0 ? "ABSENT" : "PRESENT") as "PRESENT" | "ABSENT",
      })),
    };
    const directApiRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify(modifiedPayload),
    });
    assert.strictEqual(directApiRes.status, 400, "Modified direct API write must be rejected with 400");
    console.log("✓ Modified marks write strictly rejected after lock");

    console.log("[TEST B5] Refresh verification: Attendance query returns locked status and records");
    const attendanceGetRes = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${assignment.subjectId}&sectionId=${assignment.sectionId}&date=${testDate}&lectureInstanceId=${instanceA.id}`,
      {
        headers: { Cookie: `ac_session=${teacherToken}` },
      }
    );
    assert.strictEqual(attendanceGetRes.status, 200);
    const existingRecords = (await attendanceGetRes.json()) as any[];
    assert.strictEqual(existingRecords.length, students.length, "All attendance records must be returned");
    assert(existingRecords[0].markedAt, "Records must include markedAt timestamp");
    console.log(`✓ Returned ${existingRecords.length} records with markedAt: ${existingRecords[0].markedAt}`);

    console.log("[TEST B6] Independent lecture instances: Instance B remains unlocked and editable");
    const [instBCheck] = await db
      .select()
      .from(lectureInstancesTable)
      .where(eq(lectureInstancesTable.id, instanceB.id));
    assert.strictEqual(instBCheck?.attendanceStatus, "UNMARKED", "Instance B must remain UNMARKED");

    const payloadB = {
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      date: testDate,
      timetableEntryId: testSlotBId,
      lectureInstanceId: instanceB.id,
      attendance: students.map((s, idx) => ({
        studentId: s.id,
        status: (idx === 0 ? "ABSENT" : "PRESENT") as "PRESENT" | "ABSENT",
      })),
    };
    const saveBRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify(payloadB),
    });
    assert.strictEqual(saveBRes.status, 200, "Instance B first save must succeed");
    console.log("✓ Instance B saved independently with its own marks");

    // Second save on B is also rejected
    const secondSaveBRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify(payloadB),
    });
    assert.strictEqual(secondSaveBRes.status, 400, "Instance B second save must be rejected");
    console.log("✓ Instance B is now locked as well");

    console.log("[TEST B7] Concurrency Test: 2 simultaneous submissions -> exactly 1 succeeds, 1 rejected");
    const testSlotCId = `test_lock_slot_C_${Date.now()}`;
    await db.insert(timetableEntriesTable).values({
      id: testSlotCId,
      timetableId: timetable.id,
      sectionId: assignment.sectionId,
      dayOfWeek: "MONDAY",
      startTime: "15:00",
      endTime: "15:50",
      subjectId: assignment.subjectId,
      subjectCode: "TEST_LOCK_C",
      subjectName: "Test Lock Subject C",
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherInitials: teacher.initials,
      batchType: "FULL",
      batch: "ALL",
      room: "ROOM_LOCK_C",
      lectureType: "THEORY",
    });

    const instanceC = await getOrCreateLectureInstance(testSlotCId, testDate, teacher.id);
    assert(instanceC, "Instance C must exist");

    const payloadC1 = {
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      date: testDate,
      timetableEntryId: testSlotCId,
      lectureInstanceId: instanceC.id,
      attendance: students.map((s) => ({ studentId: s.id, status: "PRESENT" as const })),
    };
    const payloadC2 = {
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      date: testDate,
      timetableEntryId: testSlotCId,
      lectureInstanceId: instanceC.id,
      attendance: students.map((s) => ({ studentId: s.id, status: "ABSENT" as const })),
    };

    // Launch two requests simultaneously
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/teacher/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: `ac_session=${teacherToken}` },
        body: JSON.stringify(payloadC1),
      }),
      fetch(`${baseUrl}/api/teacher/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: `ac_session=${teacherToken}` },
        body: JSON.stringify(payloadC2),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [200, 400], "Exactly one request must succeed (200) and one must fail (400)");
    console.log(`✓ Concurrent race condition test passed: statuses = [${statuses.join(", ")}]`);

    console.log("[TEST B8] Partial / Failed save rollback (Atomic transaction)");
    const testSlotDId = `test_lock_slot_D_${Date.now()}`;
    await db.insert(timetableEntriesTable).values({
      id: testSlotDId,
      timetableId: timetable.id,
      sectionId: assignment.sectionId,
      dayOfWeek: "MONDAY",
      startTime: "16:00",
      endTime: "16:50",
      subjectId: assignment.subjectId,
      subjectCode: "TEST_LOCK_D",
      subjectName: "Test Lock Subject D",
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherInitials: teacher.initials,
      batchType: "FULL",
      batch: "ALL",
      room: "ROOM_LOCK_D",
      lectureType: "THEORY",
    });

    const instanceD = await getOrCreateLectureInstance(testSlotDId, testDate, teacher.id);
    assert(instanceD, "Instance D must exist");

    // Submit invalid roster (only 1 student instead of entire section)
    const invalidPayloadD = {
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      date: testDate,
      timetableEntryId: testSlotDId,
      lectureInstanceId: instanceD.id,
      attendance: [{ studentId: students[0].id, status: "PRESENT" as const }],
    };

    const failedSaveRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${teacherToken}` },
      body: JSON.stringify(invalidPayloadD),
    });
    assert.strictEqual(failedSaveRes.status, 400, "Incomplete roster must fail with 400");

    // Verify instance D was NOT locked
    const [instDCheck] = await db
      .select()
      .from(lectureInstancesTable)
      .where(eq(lectureInstancesTable.id, instanceD.id));
    assert.strictEqual(instDCheck?.attendanceStatus, "UNMARKED", "Failed save must NOT lock the instance");
    console.log("✓ Atomic rollback verified: failed save left instance UNMARKED");

    // Clean up test records
    console.log("\n[CLEANUP] Cleaning up test slots and records...");
    await db.delete(attendanceTable).where(
      sql`${attendanceTable.lectureInstanceId} IN (${instanceA.id}, ${instanceB.id}, ${instanceC.id}, ${instanceD.id})`
    );
    await db.delete(lectureInstancesTable).where(
      sql`${lectureInstancesTable.id} IN (${instanceA.id}, ${instanceB.id}, ${instanceC.id}, ${instanceD.id})`
    );
    await db.delete(timetableEntriesTable).where(
      sql`${timetableEntriesTable.id} IN (${testSlotAId}, ${testSlotBId}, ${testSlotCId}, ${testSlotDId})`
    );
    console.log("✓ Cleanup completed successfully.");

    console.log("\n==================================================");
    console.log("ALL NOTIFICATIONS & LOCK TESTS PASSED (100% OK)!");
    console.log("==================================================");
  } finally {
    server.close();
    await pool.end();
  }
}

runLockAndNotificationTests().catch((err) => {
  console.error("Tests failed:", err);
  process.exit(1);
});
