import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import { sessionForUser } from "../../artifacts/api-server/src/lib/attendance-domain";
import {
  db,
  pool,
  studentsTable,
  usersTable,
  teachersTable,
  timetableEntriesTable,
  lectureInstancesTable,
  attendanceTable,
  eq,
  and
} from "../../lib/db/src/index";

async function runRegressionTests() {
  console.log("==================================================");
  console.log("COMPREHENSIVE REGRESSION TEST SUITE FOR ROSTER FIX");
  console.log("==================================================");

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── 1. Setup Teachers ──
    const [vmUser] = await db
      .select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials })
      .from(usersTable)
      .innerJoin(teachersTable, eq(teachersTable.id, usersTable.id))
      .where(eq(teachersTable.teacherCode, "MTR_FSD_05"));

    const [akUser] = await db
      .select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials })
      .from(usersTable)
      .innerJoin(teachersTable, eq(teachersTable.id, usersTable.id))
      .where(eq(teachersTable.teacherCode, "MTR_FSD_06"));

    const [nyUser] = await db
      .select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials })
      .from(usersTable)
      .innerJoin(teachersTable, eq(teachersTable.id, usersTable.id))
      .where(eq(teachersTable.teacherCode, "MTR_OOP_01"));

    const sessionVM = sessionForUser({
      id: vmUser.id,
      name: vmUser.name,
      role: "MENTOR",
      email: "vikas.mtrfsd05@abes.ac.in",
      initials: vmUser.initials,
      department: "Computer Science & Engineering",
    });

    const sessionAK = sessionForUser({
      id: akUser.id,
      name: akUser.name,
      role: "MENTOR",
      email: "arvind.mtrfsd06@abes.ac.in",
      initials: akUser.initials,
      department: "Computer Science & Engineering",
    });

    const sessionNY = sessionForUser({
      id: nyUser.id,
      name: nyUser.name,
      role: "MENTOR",
      email: "nidhi.mtroop01@abes.ac.in",
      initials: nyUser.initials,
      department: "Computer Science & Engineering",
    });

    // ── 2. Test LAB B2 Lecture Flow (Mr. Vikas Maurya) ──
    console.log("\n[TEST 1] LAB B2: Schedule -> Mark Attendance -> Roster -> Attendance -> Lock");
    const testDate = "2026-09-23";
    const resSchedVM = await fetch(`${baseUrl}/api/mentor/schedule/today?date=${testDate}`, {
      headers: { Cookie: `ac_session=${sessionVM}` },
    });
    assert.strictEqual(resSchedVM.status, 200, "Mentor schedule must return 200");
    const schedVM = (await resSchedVM.json()) as any;
    const labB2 = schedVM.lectures.find(
      (l: any) => l.subjectCode === "25VA351" && l.batch === "B2"
    );
    assert(labB2, "Must find CSE35 25VA351 Batch B2 lecture");
    assert.strictEqual(labB2.enrolledStudentsCount, 33, "Enrolled count must be 33");
    console.log(`✓ Schedule card verified: ${labB2.subjectName} (${labB2.subjectCode}), Section: ${labB2.section}, Batch: ${labB2.batch}, Enrolled: ${labB2.enrolledStudentsCount}`);

    // Clean any prior test marks for this instance if present
    await db.delete(attendanceTable).where(
      and(
        eq(attendanceTable.subjectId, labB2.subjectId),
        eq(attendanceTable.sectionId, labB2.sectionId),
        eq(attendanceTable.date, testDate)
      )
    );
    await db.delete(lectureInstancesTable).where(
      and(
        eq(lectureInstancesTable.timetableEntryId, labB2.timetableEntryId),
        eq(lectureInstancesTable.date, testDate)
      )
    );

    // Fetch roster
    const resRosterVM = await fetch(
      `${baseUrl}/api/teacher/sections/${labB2.sectionId}/students?subjectId=${labB2.subjectId}&timetableEntryId=${labB2.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionVM}` } }
    );
    assert.strictEqual(resRosterVM.status, 200, "Roster fetch must return 200 OK");
    const rosterVM = (await resRosterVM.json()) as any[];
    assert.strictEqual(rosterVM.length, 33, "Roster must contain exactly 33 students");

    // Verify all 33 students belong to B2 in the database
    const studentDbRecords = await db
      .select({ id: studentsTable.id, labBatch: studentsTable.labBatch })
      .from(studentsTable)
      .where(eq(studentsTable.sectionId, labB2.sectionId));
    const b2DbSet = new Set(studentDbRecords.filter((s) => s.labBatch === "B2").map((s) => s.id));
    assert(rosterVM.every((s) => b2DbSet.has(s.id)), "Every student in roster must belong to Lab Batch B2");
    console.log(`✓ Roster loaded successfully: exactly 33 students, all in Batch B2`);

    // Fetch existing attendance (should be empty initially)
    const resAttBefore = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${labB2.subjectId}&sectionId=${labB2.sectionId}&date=${testDate}&timetableEntryId=${labB2.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionVM}` } }
    );
    assert.strictEqual(resAttBefore.status, 200, "Existing attendance must return 200");
    const attBefore = (await resAttBefore.json()) as any[];
    assert.strictEqual(attBefore.length, 0, "No existing attendance records initially");
    console.log(`✓ Existing attendance loaded: 0 records (attendance controls unlocked)`);

    // Submit attendance (Mark all present)
    const submitPayload = rosterVM.map((s, idx) => ({
      studentId: s.id,
      status: idx === 0 ? "ABSENT" : "PRESENT",
    }));
    const resSubmit = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${sessionVM}` },
      body: JSON.stringify({
        subjectId: labB2.subjectId,
        sectionId: labB2.sectionId,
        date: testDate,
        timetableEntryId: labB2.timetableEntryId,
        attendance: submitPayload,
      }),
    });
    assert.strictEqual(resSubmit.status, 200, "Attendance submission must return 200");
    const submittedAtt = (await resSubmit.json()) as any[];
    assert.strictEqual(submittedAtt.length, 33, "Submission must return 33 recorded attendance items");
    console.log(`✓ Attendance successfully marked: 33 records written (1 absent, 32 present)`);

    // Fetch existing attendance again (should return the 33 records)
    const resAttAfter = await fetch(
      `${baseUrl}/api/teacher/attendance?subjectId=${labB2.subjectId}&sectionId=${labB2.sectionId}&date=${testDate}&timetableEntryId=${labB2.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionVM}` } }
    );
    assert.strictEqual(resAttAfter.status, 200);
    const attAfter = (await resAttAfter.json()) as any[];
    assert.strictEqual(attAfter.length, 33, "Must return 33 saved records");
    console.log(`✓ Existing attendance reloaded: 33 records verified`);

    // Verify Lecture Lock (re-submission rejected)
    const resSubmitAgain = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${sessionVM}` },
      body: JSON.stringify({
        subjectId: labB2.subjectId,
        sectionId: labB2.sectionId,
        date: testDate,
        timetableEntryId: labB2.timetableEntryId,
        attendance: submitPayload,
      }),
    });
    assert.strictEqual(resSubmitAgain.status, 400, "Locked lecture submission must be rejected with 400");
    const lockErr = await resSubmitAgain.json();
    assert(lockErr.error.includes("locked") || lockErr.error.includes("already"), "Must state attendance is locked");
    console.log(`✓ Lecture lock verified: re-submission rejected with "${lockErr.error}"`);

    // Clean up test attendance
    await db.delete(attendanceTable).where(
      and(
        eq(attendanceTable.subjectId, labB2.subjectId),
        eq(attendanceTable.sectionId, labB2.sectionId),
        eq(attendanceTable.date, testDate)
      )
    );
    await db.delete(lectureInstancesTable).where(
      and(
        eq(lectureInstancesTable.timetableEntryId, labB2.timetableEntryId),
        eq(lectureInstancesTable.date, testDate)
      )
    );
    console.log(`✓ Test attendance cleaned up`);

    // ── 3. Test THEORY Lecture (Arvind Kumar) ──
    console.log("\n[TEST 2] THEORY Lecture: Full Section Roster (Arvind Kumar)");
    const [theoryTte] = await db
      .select()
      .from(timetableEntriesTable)
      .where(
        and(
          eq(timetableEntriesTable.teacherId, akUser.id),
          eq(timetableEntriesTable.subjectId, labB2.subjectId),
          eq(timetableEntriesTable.sectionId, labB2.sectionId),
          eq(timetableEntriesTable.batchType, "ALL")
        )
      );
    assert(theoryTte, "Theory timetable entry must exist for Arvind Kumar");

    const resRosterAK = await fetch(
      `${baseUrl}/api/teacher/sections/${theoryTte.sectionId}/students?subjectId=${theoryTte.subjectId}&timetableEntryId=${theoryTte.id}`,
      { headers: { Cookie: `ac_session=${sessionAK}` } }
    );
    assert.strictEqual(resRosterAK.status, 200, "Theory roster fetch must return 200");
    const rosterAK = (await resRosterAK.json()) as any[];
    assert.strictEqual(rosterAK.length, 67, "Theory roster must return all 67 students");
    console.log(`✓ Theory roster returned exactly 67 students for Arvind Kumar`);

    // ── 4. Cross-Teacher Authorization Tests ──
    console.log("\n[TEST 3] Cross-Teacher Authorization Enforcement");

    // A. Arvind Kumar tries to access Vikas Maurya's B2 Lab Roster
    const resAKonVM = await fetch(
      `${baseUrl}/api/teacher/sections/${labB2.sectionId}/students?subjectId=${labB2.subjectId}&timetableEntryId=${labB2.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionAK}` } }
    );
    assert.strictEqual(resAKonVM.status, 403, "Unauthorized teacher access to lab roster must return 403");
    console.log(`✓ Arvind Kumar blocked from Vikas Maurya's B2 Lab (HTTP 403)`);

    // B. Vikas Maurya tries to access Arvind Kumar's Theory Roster
    const resVMonAK = await fetch(
      `${baseUrl}/api/teacher/sections/${theoryTte.sectionId}/students?subjectId=${theoryTte.subjectId}&timetableEntryId=${theoryTte.id}`,
      { headers: { Cookie: `ac_session=${sessionVM}` } }
    );
    assert.strictEqual(resVMonAK.status, 403, "Unauthorized teacher access to theory roster must return 403");
    console.log(`✓ Vikas Maurya blocked from Arvind Kumar's Theory class (HTTP 403)`);

    // C. Non-subject teacher (Nidhi Yadav) tries to access Vikas Maurya's B2 Lab
    const resNYonVM = await fetch(
      `${baseUrl}/api/teacher/sections/${labB2.sectionId}/students?subjectId=${labB2.subjectId}&timetableEntryId=${labB2.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionNY}` } }
    );
    assert.strictEqual(resNYonVM.status, 403, "Unrelated teacher access to lab roster must return 403");
    console.log(`✓ Nidhi Yadav blocked from Vikas Maurya's B2 Lab (HTTP 403)`);

    console.log("\n==================================================");
    console.log("ALL REGRESSION TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } finally {
    server.close();
    await pool.end();
  }
}

runRegressionTests().catch(console.error);
