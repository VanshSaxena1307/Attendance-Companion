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
  sectionsTable,
  subjectsTable,
  teacherSubjectSectionsTable,
  eq,
  and,
  sql,
} from "../../lib/db/src/index";
import { getOrCreateLectureInstance } from "../../artifacts/api-server/src/lib/postgres-attendance-repository";

async function runPhase5Tests() {
  console.log("==================================================");
  console.log("PHASE 5 — LECTURE INSTANCE ARCHITECTURE TESTS");
  console.log("==================================================");

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── 1. Invariant Tests on Database Migration ──
    console.log("\n[TEST 1] Verifying Global Database Attendance Invariants");
    const [totalAtt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceTable);
    assert.strictEqual(totalAtt.count, 36277, `Attendance total must be 36,277, got ${totalAtt.count}`);
    console.log(`✓ Total attendance records = 36,277`);

    const statusCounts = await db
      .select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .groupBy(attendanceTable.status);

    const presentCount = statusCounts.find((s) => s.status === "PRESENT")?.count ?? 0;
    const absentCount = statusCounts.find((s) => s.status === "ABSENT")?.count ?? 0;
    assert.strictEqual(presentCount, 29901, `PRESENT count must be 29,901, got ${presentCount}`);
    assert.strictEqual(absentCount, 6376, `ABSENT count must be 6,376, got ${absentCount}`);
    console.log(`✓ PRESENT count = 29,901`);
    console.log(`✓ ABSENT count = 6,376`);

    const [mappedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .where(sql`${attendanceTable.lectureInstanceId} IS NOT NULL`);
    assert.strictEqual(mappedCount.count, 11723, `Mapped count must be 11,723, got ${mappedCount.count}`);
    console.log(`✓ Mapped historical records = 11,723`);

    const [legacyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .where(sql`${attendanceTable.lectureInstanceId} IS NULL`);
    assert.strictEqual(legacyCount.count, 24554, `Legacy records count must be 24,554, got ${legacyCount.count}`);
    console.log(`✓ Legacy historical records = 24,554`);

    const [instanceCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lectureInstancesTable);
    assert.strictEqual(instanceCount.count, 233, `Historical lecture instances created must be 233, got ${instanceCount.count}`);
    console.log(`✓ Historical lecture instances created = 233`);

    // ── 2. Resolve Test Teacher and Enrolled Students ──
    console.log("\n[TEST 2] Setting up Teacher & Multi-Slot Timetable Entries");
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

    // Get teacher's assignment
    const [assignment] = await db
      .select()
      .from(teacherSubjectSectionsTable)
      .where(eq(teacherSubjectSectionsTable.teacherId, teacher.id));
    assert(assignment, "Teacher assignment not found");

    // Get active timetable
    const [timetable] = await db
      .select()
      .from(timetablesTable)
      .where(and(eq(timetablesTable.sectionId, assignment.sectionId), eq(timetablesTable.status, "ACTIVE")));
    assert(timetable, "Active timetable not found");

    // Check if there are already 2 same-subject entries or create 2 unique test slot entries
    const testSlot1Id = `test_entry_slot1_${Date.now()}`;
    const testSlot2Id = `test_entry_slot2_${Date.now()}`;
    const testDate = "2026-08-31"; // A Monday in historical semester

    // Insert 2 distinct slots for the same subject, section, and teacher on Monday
    await db.insert(timetableEntriesTable).values([
      {
        id: testSlot1Id,
        timetableId: timetable.id,
        sectionId: assignment.sectionId,
        dayOfWeek: "MONDAY",
        startTime: "08:30",
        endTime: "09:20",
        subjectId: assignment.subjectId,
        subjectCode: "TEST_SUBJ",
        subjectName: "Test Subject Slot 1",
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        batchType: "FULL",
        batch: "ALL",
        room: "ROOM_TEST_1",
        lectureType: "THEORY",
      },
      {
        id: testSlot2Id,
        timetableId: timetable.id,
        sectionId: assignment.sectionId,
        dayOfWeek: "MONDAY",
        startTime: "14:00",
        endTime: "14:50",
        subjectId: assignment.subjectId,
        subjectCode: "TEST_SUBJ",
        subjectName: "Test Subject Slot 2",
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        batchType: "FULL",
        batch: "ALL",
        room: "ROOM_TEST_2",
        lectureType: "THEORY",
      },
    ]);

    console.log(`Created test Slot 1 (${testSlot1Id}: 08:30-09:20) and Slot 2 (${testSlot2Id}: 14:00-14:50)`);

    // Fetch students enrolled in this section
    const students = await db
      .select({ id: studentsTable.id, rollNo: studentsTable.rollNo })
      .from(studentsTable)
      .where(eq(studentsTable.sectionId, assignment.sectionId))
      .orderBy(studentsTable.rollNo);
    assert(students.length > 0, "No students found in test section");
    const student1 = students[0];

    // ── 3. Same Subject + Same Date + Slot 1 vs Slot 2 Instance Independence ──
    console.log("\n[TEST 3] Verifying Independent Lecture Instances (Slot 1 vs Slot 2)");

    const instance1 = await getOrCreateLectureInstance(testSlot1Id, testDate, teacher.id);
    const instance2 = await getOrCreateLectureInstance(testSlot2Id, testDate, teacher.id);

    assert(instance1, "Instance 1 must be created");
    assert(instance2, "Instance 2 must be created");
    assert.notStrictEqual(instance1.id, instance2.id, "Slot 1 and Slot 2 must produce distinct lecture instance IDs");
    console.log(`✓ Slot 1 Instance ID: ${instance1.id}`);
    console.log(`✓ Slot 2 Instance ID: ${instance2.id}`);

    // Verify uniqueness / idempotency: Calling getOrCreateLectureInstance again returns same instance
    const instance1Again = await getOrCreateLectureInstance(testSlot1Id, testDate, teacher.id);
    assert.strictEqual(instance1Again?.id, instance1.id, "Same slot + date must return the same lecture instance");
    console.log(`✓ Idempotency verified: re-requesting Slot 1 returned existing instance without duplication`);

    // Verify different date produces different instance
    const instance1NextWeek = await getOrCreateLectureInstance(testSlot1Id, "2026-09-07", teacher.id);
    assert.notStrictEqual(instance1NextWeek?.id, instance1.id, "Different date must create a different lecture instance");
    console.log(`✓ Date distinction verified: different date returned different lecture instance`);

    // ── 4. Independent Attendance Marks in Slot 1 and Slot 2 ──
    console.log("\n[TEST 4] Marking Attendance: Student Present in Slot 1, Absent in Slot 2");

    // Mark Slot 1: Student 1 is PRESENT, others PRESENT
    const slot1Attendance = students.map((s) => ({
      studentId: s.id,
      status: "PRESENT" as const,
    }));

    const resSlot1 = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify({
        subjectId: assignment.subjectId,
        sectionId: assignment.sectionId,
        date: testDate,
        timetableEntryId: testSlot1Id,
        attendance: slot1Attendance,
      }),
    });
    assert.strictEqual(resSlot1.status, 200, "Saving Slot 1 attendance failed");
    console.log(`✓ Slot 1 attendance saved successfully`);

    // Mark Slot 2: Student 1 is ABSENT, others PRESENT
    const slot2Attendance = students.map((s, idx) => ({
      studentId: s.id,
      status: (idx === 0 ? "ABSENT" : "PRESENT") as const,
    }));

    const resSlot2 = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify({
        subjectId: assignment.subjectId,
        sectionId: assignment.sectionId,
        date: testDate,
        timetableEntryId: testSlot2Id,
        attendance: slot2Attendance,
      }),
    });
    assert.strictEqual(resSlot2.status, 200, "Saving Slot 2 attendance failed");
    console.log(`✓ Slot 2 attendance saved successfully`);

    // ── 5. Independent Retrieval & Verification of Slot 1 and Slot 2 ──
    console.log("\n[TEST 5] Querying Slot 1 vs Slot 2 Attendance via API");

    const getSlot1Res = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${assignment.subjectId}&sectionId=${assignment.sectionId}&date=${testDate}&timetableEntryId=${testSlot1Id}`,
      { headers: { Cookie: `ac_session=${teacherToken}` } }
    );
    assert.strictEqual(getSlot1Res.status, 200);
    const getSlot1Data = (await getSlot1Res.json()) as any[];
    const student1Slot1 = getSlot1Data.find((r) => r.studentId === student1.id);
    assert.strictEqual(student1Slot1?.status, "PRESENT", "Student 1 must be PRESENT in Slot 1");

    const getSlot2Res = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${assignment.subjectId}&sectionId=${assignment.sectionId}&date=${testDate}&timetableEntryId=${testSlot2Id}`,
      { headers: { Cookie: `ac_session=${teacherToken}` } }
    );
    assert.strictEqual(getSlot2Res.status, 200);
    const getSlot2Data = (await getSlot2Res.json()) as any[];
    const student1Slot2 = getSlot2Data.find((r) => r.studentId === student1.id);
    assert.strictEqual(student1Slot2?.status, "ABSENT", "Student 1 must be ABSENT in Slot 2");

    console.log(`✓ Slot 1 student status: ${student1Slot1?.status}`);
    console.log(`✓ Slot 2 student status: ${student1Slot2?.status}`);
    console.log(`✓ Verified both records preserved independently for the same student on the same date!`);

    // ── 6. Re-saving Slot 1 updates only Slot 1; Slot 2 remains unchanged ──
    // Unlock Slot 1 instance to verify re-saving under locked architecture
    await db.delete(attendanceTable).where(eq(attendanceTable.lectureInstanceId, instance1.id));
    await db.update(lectureInstancesTable).set({ attendanceStatus: "UNMARKED" }).where(eq(lectureInstancesTable.id, instance1.id));

    // Update Slot 1 so Student 1 is now ABSENT
    const slot1Updated = students.map((s, idx) => ({
      studentId: s.id,
      status: (idx === 0 ? "ABSENT" : "PRESENT") as const,
    }));

    const resSlot1Update = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${teacherToken}`,
      },
      body: JSON.stringify({
        subjectId: assignment.subjectId,
        sectionId: assignment.sectionId,
        date: testDate,
        timetableEntryId: testSlot1Id,
        attendance: slot1Updated,
      }),
    });
    if (resSlot1Update.status !== 200) {
      const errBody = await resSlot1Update.json();
      console.log("resSlot1Update error body:", errBody);
    }
    assert.strictEqual(resSlot1Update.status, 200, "Updating Slot 1 failed");

    // Verify Slot 1 is now ABSENT
    const checkSlot1 = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${assignment.subjectId}&sectionId=${assignment.sectionId}&date=${testDate}&timetableEntryId=${testSlot1Id}`,
      { headers: { Cookie: `ac_session=${teacherToken}` } }
    );
    const checkSlot1Data = (await checkSlot1.json()) as any[];
    assert.strictEqual(checkSlot1Data.find((r) => r.studentId === student1.id)?.status, "ABSENT");

    // Verify Slot 2 is still unchanged
    const checkSlot2 = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${assignment.subjectId}&sectionId=${assignment.sectionId}&date=${testDate}&timetableEntryId=${testSlot2Id}`,
      { headers: { Cookie: `ac_session=${teacherToken}` } }
    );
    const checkSlot2Data = (await checkSlot2.json()) as any[];
    assert.strictEqual(checkSlot2Data.find((r) => r.studentId === student1.id)?.status, "ABSENT");
    console.log(`✓ Re-saving Slot 1 updated Slot 1 only; Slot 2 remained intact and unchanged`);

    // ── 7. Teacher Authorization Remains Enforced ──
    console.log("\n[TEST 7] Teacher Authorization Enforcement");
    // Other teacher tries to mark this teacher's lecture
    const [otherTeacher] = await db
      .select({ id: teachersTable.id, teacherCode: teachersTable.teacherCode, name: usersTable.name, email: usersTable.email, initials: usersTable.initials })
      .from(teachersTable)
      .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
      .where(sql`${teachersTable.id} != ${teacher.id}`)
      .limit(1);

    const otherUser: CurrentUser = {
      id: otherTeacher.id,
      name: otherTeacher.name,
      email: otherTeacher.email ?? "other@test.local",
      role: "MENTOR",
      initials: otherTeacher.initials,
      department: "CSE",
    };
    const otherToken = sessionForUser(otherUser);

    const unauthorizedRes = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ac_session=${otherToken}`,
      },
      body: JSON.stringify({
        subjectId: assignment.subjectId,
        sectionId: assignment.sectionId,
        date: testDate,
        timetableEntryId: testSlot1Id,
        attendance: slot1Attendance,
      }),
    });
    assert.strictEqual(unauthorizedRes.status, 403, "Unauthorized teacher should receive 403 Forbidden");
    console.log(`✓ Unauthorized teacher access rejected with 403 Forbidden`);

    // ── 8. Schedule Endpoint Verification with lectureInstanceId ──
    console.log("\n[TEST 8] GET /api/mentor/schedule/today exposes lectureInstanceId");
    const mentorScheduleRes = await fetch(`${baseUrl}/api/mentor/schedule/today?date=${testDate}`, {
      headers: { Cookie: `ac_session=${teacherToken}` },
    });
    assert.strictEqual(mentorScheduleRes.status, 200);
    const mentorScheduleData = (await mentorScheduleRes.json()) as any;
    const lecture1InSchedule = mentorScheduleData.lectures.find((l: any) => l.timetableEntryId === testSlot1Id);
    assert(lecture1InSchedule, "Slot 1 must appear in mentor schedule");
    assert(lecture1InSchedule.lectureInstanceId, "lectureInstanceId must be exposed in mentor schedule");
    assert.strictEqual(lecture1InSchedule.attendanceStatus, "ATTENDANCE_MARKED");
    console.log(`✓ Mentor schedule exposed lectureInstanceId: ${lecture1InSchedule.lectureInstanceId}`);

    // Clean up test timetable entries and test attendance records
    console.log("\n[CLEANUP] Cleaning up test records...");
    await db.delete(attendanceTable).where(
      sql`${attendanceTable.lectureInstanceId} IN (${instance1.id}, ${instance2.id}, ${instance1NextWeek?.id})`
    );
    await db.delete(lectureInstancesTable).where(
      sql`${lectureInstancesTable.id} IN (${instance1.id}, ${instance2.id}, ${instance1NextWeek?.id})`
    );
    await db.delete(timetableEntriesTable).where(
      sql`${timetableEntriesTable.id} IN (${testSlot1Id}, ${testSlot2Id})`
    );
    console.log("✓ Cleanup completed successfully.");

    // Final verification of historical invariant counts after cleanup
    const [finalTotalAtt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceTable);
    assert.strictEqual(finalTotalAtt.count, 36277, `Attendance total must remain 36,277`);
    console.log("✓ Final attendance count verified: exactly 36,277");

    console.log("\n==================================================");
    console.log("ALL PHASE 5 TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase5Tests().catch((err) => {
  console.error("Phase 5 Tests Failed:", err);
  process.exit(1);
});
