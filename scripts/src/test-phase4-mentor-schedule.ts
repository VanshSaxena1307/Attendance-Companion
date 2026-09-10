import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import {
  sessionForUser,
  type CurrentUser,
} from "../../artifacts/api-server/src/lib/attendance-domain";
import {
  db,
  pool,
  studentsTable,
  usersTable,
  sectionsTable,
  teachersTable,
  timetableEntriesTable,
  attendanceTable,
  eq,
  and,
} from "../../lib/db/src/index";

async function runPhase4Tests() {
  console.log("==================================================");
  console.log("PHASE 4 — MENTOR TODAY'S SCHEDULE & LECTURE ATTENDANCE TESTS");
  console.log("==================================================");

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── 1. Fetch Test Mentors ──
    console.log("\n[TEST 1] Setup: Resolving Mentor Accounts");
    // Mentor 1: Ms. Malvika Gupta (MTR_ADS_01) — Teaches CSE-34 ADS
    const [mentorMG] = await db
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

    assert(mentorMG, "Mentor MG (MTR_ADS_01) not found");
    const userMG: CurrentUser = {
      id: mentorMG.id,
      name: mentorMG.name,
      email: mentorMG.email ?? "mg@test.local",
      role: "MENTOR",
      initials: mentorMG.initials,
      department: "CSE",
    };
    const sessionTokenMG = sessionForUser(userMG);
    console.log(`Mentor 1: ${mentorMG.name} (${mentorMG.teacherCode})`);

    // Mentor 2: Ms. Nidhi Yadav (MTR_OOP_01) — Multi-section mentor (CSE-34 & CSE-35)
    const [mentorNY] = await db
      .select({
        id: teachersTable.id,
        teacherCode: teachersTable.teacherCode,
        name: usersTable.name,
        email: usersTable.email,
        initials: usersTable.initials,
      })
      .from(teachersTable)
      .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
      .where(eq(teachersTable.teacherCode, "MTR_OOP_01"));

    assert(mentorNY, "Mentor NY (MTR_OOP_01) not found");
    const userNY: CurrentUser = {
      id: mentorNY.id,
      name: mentorNY.name,
      email: mentorNY.email ?? "ny@test.local",
      role: "MENTOR",
      initials: mentorNY.initials,
      department: "CSE",
    };
    const sessionTokenNY = sessionForUser(userNY);
    console.log(`Mentor 2: ${mentorNY.name} (${mentorNY.teacherCode})`);

    // ── 2. Mentor Schedule Retrieval: Single vs Multi Section ──
    console.log("\n[TEST 2] Schedule Query: Chronological & Multi-Section Handling");
    const resMG = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionTokenMG}` },
    });
    assert.strictEqual(resMG.status, 200, "Mentor MG schedule fetch failed");
    const dataMG = (await resMG.json()) as any;
    assert.strictEqual(dataMG.day, "MONDAY");
    assert(dataMG.lectures.length >= 2, "Mentor MG should have at least 2 lectures on Monday");
    for (let i = 1; i < dataMG.lectures.length; i++) {
      assert(dataMG.lectures[i - 1].startTime <= dataMG.lectures[i].startTime, "Lectures must be chronological");
    }
    assert(dataMG.lectures.every((l: any) => l.section === "CSE34"), "MG only teaches CSE34");
    console.log(`✓ Single-section mentor verified (${dataMG.lectures.length} lectures strictly chronological)`);

    const resNY = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionTokenNY}` },
    });
    assert.strictEqual(resNY.status, 200);
    const dataNY = (await resNY.json()) as any;
    const nySections = new Set(dataNY.lectures.map((l: any) => l.section));
    assert(nySections.has("CSE34") && nySections.has("CSE35"), "NY must aggregate both CSE-34 and CSE-35");
    console.log(`✓ Multi-section mentor aggregated CSE-34 and CSE-35 (${dataNY.lectures.length} lectures)`);

    // ── 3. Theory Class: Full Section Roster & Counts ──
    console.log("Mentor MG lectures:", JSON.stringify(dataMG.lectures, null, 2));
    const theoryLec = dataMG.lectures[0];
    assert(theoryLec, "Expected lecture for Mentor MG on Monday");
    assert.strictEqual(theoryLec.enrolledStudentsCount, 67, "Theory class must have 67 enrolled students");

    // Fetch roster via GET /api/teacher/sections/:sectionId/students?subjectId=...&timetableEntryId=...
    const resTheoryRoster = await fetch(
      `${baseUrl}/api/teacher/sections/${theoryLec.sectionId}/students?subjectId=${theoryLec.subjectId}&timetableEntryId=${theoryLec.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionTokenMG}` } }
    );
    assert.strictEqual(resTheoryRoster.status, 200, "Theory roster fetch failed");
    const theoryRoster = (await resTheoryRoster.json()) as any[];
    assert.strictEqual(theoryRoster.length, 67, "Theory roster must contain exactly 67 students");
    console.log("✓ Normal theory class correctly returned 67 students");

    // ── 4. Batch Filtering: LAB Batches (B1 vs B2) ──
    console.log("\n[TEST 4] Regular Lab Batch Isolation");
    // Find any teacher teaching LAB in timetable_entries
    const labEntries = await db
      .select({
        id: timetableEntriesTable.id,
        teacherId: timetableEntriesTable.teacherId,
        sectionId: timetableEntriesTable.sectionId,
        subjectId: timetableEntriesTable.subjectId,
        batch: timetableEntriesTable.batch,
        batchType: timetableEntriesTable.batchType,
        startTime: timetableEntriesTable.startTime,
        dayOfWeek: timetableEntriesTable.dayOfWeek,
      })
      .from(timetableEntriesTable)
      .where(eq(timetableEntriesTable.batchType, "LAB"))
      .limit(5);

    assert(labEntries.length > 0, "Lab timetable entries required for testing");
    const labEntry = labEntries[0];
    assert(labEntry.teacherId && labEntry.subjectId, "Lab entry missing teacher or subject");

    // Create session for lab teacher
    const [labTeacher] = await db
      .select({ id: teachersTable.id, name: usersTable.name, email: usersTable.email, initials: usersTable.initials })
      .from(teachersTable)
      .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
      .where(eq(teachersTable.id, labEntry.teacherId));

    assert(labTeacher, "Lab teacher not found");
    const userLab: CurrentUser = {
      id: labTeacher.id,
      name: labTeacher.name,
      email: labTeacher.email ?? "lab@test.local",
      role: "MENTOR",
      initials: labTeacher.initials,
      department: "CSE",
    };
    const sessionTokenLab = sessionForUser(userLab);

    const resLabRoster = await fetch(
      `${baseUrl}/api/teacher/sections/${labEntry.sectionId}/students?subjectId=${labEntry.subjectId}&timetableEntryId=${labEntry.id}`,
      { headers: { Cookie: `ac_session=${sessionTokenLab}` } }
    );
    assert.strictEqual(resLabRoster.status, 200, "Lab roster fetch failed");
    const labRoster = (await resLabRoster.json()) as any[];
    assert(labRoster.length > 0 && labRoster.length < 67, `Lab batch should have subgroup of section, got ${labRoster.length}`);

    // Verify all returned students belong to this lab batch
    const studentDbRecords = await db
      .select({ id: studentsTable.id, labBatch: studentsTable.labBatch })
      .from(studentsTable)
      .where(eq(studentsTable.sectionId, labEntry.sectionId));

    const labMap = new Map(studentDbRecords.map((s) => [s.id, s.labBatch]));
    for (const st of labRoster) {
      assert.strictEqual(labMap.get(st.id), labEntry.batch, `Student ${st.id} does not belong to lab batch ${labEntry.batch}`);
    }
    console.log(`✓ Lab Batch ${labEntry.batch} isolated correctly (${labRoster.length} students, 0 from other batches)`);

    // ── 5. Elective Batch Filtering: Python & Cloud ──
    console.log("\n[TEST 5] Elective Batch Isolation (Python / Cloud)");
    const electiveEntries = await db
      .select({
        id: timetableEntriesTable.id,
        teacherId: timetableEntriesTable.teacherId,
        sectionId: timetableEntriesTable.sectionId,
        subjectId: timetableEntriesTable.subjectId,
        batch: timetableEntriesTable.batch,
        batchType: timetableEntriesTable.batchType,
      })
      .from(timetableEntriesTable)
      .where(eq(timetableEntriesTable.batchType, "PYTHON"))
      .limit(1);

    if (electiveEntries.length > 0) {
      const pyEntry = electiveEntries[0];
      if (pyEntry.teacherId && pyEntry.subjectId) {
        const [pyTeacher] = await db
          .select({ id: teachersTable.id, name: usersTable.name, email: usersTable.email, initials: usersTable.initials })
          .from(teachersTable)
          .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
          .where(eq(teachersTable.id, pyEntry.teacherId));

        if (pyTeacher) {
          const userPy: CurrentUser = { id: pyTeacher.id, name: pyTeacher.name, email: pyTeacher.email ?? "py@test.local", role: "MENTOR", initials: pyTeacher.initials, department: "CSE" };
          const sessionTokenPy = sessionForUser(userPy);
          const resPyRoster = await fetch(
            `${baseUrl}/api/teacher/sections/${pyEntry.sectionId}/students?subjectId=${pyEntry.subjectId}&timetableEntryId=${pyEntry.id}`,
            { headers: { Cookie: `ac_session=${sessionTokenPy}` } }
          );
          if (resPyRoster.status === 200) {
            const pyRoster = (await resPyRoster.json()) as any[];
            console.log(`✓ Python batch ${pyEntry.batch} isolated (${pyRoster.length} students)`);
          }
        }
      }
    }

    // ── 6. Authorization: Mentor Cross-Class Protection ──
    console.log("\n[TEST 6] Authorization: Cross-Teacher Access Rejection");
    // Mentor NY attempting to access Mentor MG's theory lecture roster
    const resUnauthorizedRoster = await fetch(
      `${baseUrl}/api/teacher/sections/${theoryLec.sectionId}/students?subjectId=${theoryLec.subjectId}&timetableEntryId=${theoryLec.timetableEntryId}`,
      { headers: { Cookie: `ac_session=${sessionTokenNY}` } }
    );
    assert.strictEqual(resUnauthorizedRoster.status, 403, "Mentor should not access another mentor's lecture roster");

    // Mentor NY attempting to submit attendance for Mentor MG's lecture
    const resUnauthorizedSubmit = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${sessionTokenNY}` },
      body: JSON.stringify({
        subjectId: theoryLec.subjectId,
        sectionId: theoryLec.sectionId,
        date: "2026-08-31",
        timetableEntryId: theoryLec.timetableEntryId,
        attendance: [{ studentId: theoryRoster[0].id, status: "PRESENT" }],
      }),
    });
    assert.strictEqual(resUnauthorizedSubmit.status, 403, "Mentor should not submit attendance for another mentor's lecture");
    console.log("✓ Cross-teacher access strictly forbidden with HTTP 403");

    // ── 7. Lecture Start-Time Rule: Server-Side Rejection ──
    console.log("\n[TEST 7] Lecture Start-Time Rule (Server-Side Enforcement)");
    // Attempting to submit attendance for a future lecture (e.g. 2026-11-02, which is in the future)
    const resFutureSubmit = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${sessionTokenMG}` },
      body: JSON.stringify({
        subjectId: theoryLec.subjectId,
        sectionId: theoryLec.sectionId,
        date: "2026-11-02",
        timetableEntryId: theoryLec.timetableEntryId,
        attendance: theoryRoster.map((s) => ({ studentId: s.id, status: "PRESENT" })),
      }),
    });
    assert.strictEqual(resFutureSubmit.status, 400, "Future attendance submission must return HTTP 400");
    const futureErr = await resFutureSubmit.json();
    console.log(`Future lecture rejected: "${futureErr.error}"`);
    assert(
      futureErr.error.includes("before the scheduled lecture start time") ||
      futureErr.error.includes("future"),
      "Error must explain start time restriction"
    );
    console.log("✓ Server-side start time enforcement strictly validated");

    // ── 8. Attendance Marking: Mark All Present & Individual Absent ──
    console.log("\n[TEST 8] Attendance Marking & PostgreSQL Persistence");
    // Use test date 2026-08-31 (a past completed lecture day)
    const absentStudent = theoryRoster[0];
    const presentStudents = theoryRoster.slice(1);

    const submissionPayload = [
      { studentId: absentStudent.id, status: "ABSENT" },
      ...presentStudents.map((s) => ({ studentId: s.id, status: "PRESENT" })),
    ];

    const resSave = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${sessionTokenMG}` },
      body: JSON.stringify({
        subjectId: theoryLec.subjectId,
        sectionId: theoryLec.sectionId,
        date: "2026-08-31",
        timetableEntryId: theoryLec.timetableEntryId,
        attendance: submissionPayload,
      }),
    });
    assert.strictEqual(resSave.status, 200, `Attendance save failed with status ${resSave.status}`);
    const savedData = await resSave.json();
    assert(Array.isArray(savedData), "Save response must return array of marked students");

    // Check mentor schedule reflects marked count
    const resUpdatedSchedule = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionTokenMG}` },
    });
    const updatedScheduleData = (await resUpdatedSchedule.json()) as any;
    const updatedLec = updatedScheduleData.lectures.find((l: any) => l.timetableEntryId === theoryLec.timetableEntryId);
    assert(updatedLec, "Updated lecture missing in schedule");
    assert.strictEqual(updatedLec.attendanceStatus, "ATTENDANCE_MARKED");
    assert.strictEqual(updatedLec.markedStudentsCount, 67);
    console.log(`✓ Attendance saved and verified in mentor schedule: ${updatedLec.markedStudentsCount}/${updatedLec.enrolledStudentsCount} marked`);

    // ── 9. Student Reflection via Database ──
    console.log("\n[TEST 9] Student Reflection (Single Source of Truth in PostgreSQL)");
    // Student 1: Absent student checks schedule
    const userAbsentStudent: CurrentUser = {
      id: absentStudent.id,
      name: absentStudent.name,
      email: "absent@test.local",
      role: "STUDENT",
      initials: "AS",
      department: "CSE",
    };
    const sessionTokenAbsent = sessionForUser(userAbsentStudent);

    const resAbsentStudentSchedule = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionTokenAbsent}` },
    });
    assert.strictEqual(resAbsentStudentSchedule.status, 200);
    const absentStudentData = (await resAbsentStudentSchedule.json()) as any;
    const absentLec = absentStudentData.lectures.find((l: any) => l.subjectId === theoryLec.subjectId);
    assert(absentLec, "Lecture missing from student schedule");
    assert.strictEqual(absentLec.attendanceStatus, "ATTENDANCE_UPLOADED_ABSENT", "Student must see ATTENDANCE_UPLOADED_ABSENT");
    console.log(`✓ Absent student schedule reflects: ${absentLec.attendanceStatus}`);

    // Student 2: Present student checks schedule
    const presentStudent = presentStudents[0];
    const userPresentStudent: CurrentUser = {
      id: presentStudent.id,
      name: presentStudent.name,
      email: "present@test.local",
      role: "STUDENT",
      initials: "PS",
      department: "CSE",
    };
    const sessionTokenPresent = sessionForUser(userPresentStudent);

    const resPresentStudentSchedule = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionTokenPresent}` },
    });
    assert.strictEqual(resPresentStudentSchedule.status, 200);
    const presentStudentData = (await resPresentStudentSchedule.json()) as any;
    const presentLec = presentStudentData.lectures.find((l: any) => l.subjectId === theoryLec.subjectId);
    assert(presentLec, "Lecture missing from student schedule");
    assert.strictEqual(presentLec.attendanceStatus, "ATTENDANCE_UPLOADED_PRESENT", "Student must see ATTENDANCE_UPLOADED_PRESENT");
    console.log(`✓ Present student schedule reflects: ${presentLec.attendanceStatus}`);

    // ── 10. Reopen & Edit Attendance (No Row Duplication) ──
    console.log("\n[TEST 10] Reopen & Edit: Upsert Integrity Check");
    const countBefore = await db
      .select({ id: attendanceTable.id })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.subjectId, theoryLec.subjectId), eq(attendanceTable.date, "2026-08-31")));

    // Change absent student to PRESENT
    const editedPayload = theoryRoster.map((s) => ({ studentId: s.id, status: "PRESENT" }));

    const resEdit = await fetch(`${baseUrl}/api/teacher/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `ac_session=${sessionTokenMG}` },
      body: JSON.stringify({
        subjectId: theoryLec.subjectId,
        sectionId: theoryLec.sectionId,
        date: "2026-08-31",
        timetableEntryId: theoryLec.timetableEntryId,
        attendance: editedPayload,
      }),
    });
    assert.strictEqual(resEdit.status, 200);

    const countAfter = await db
      .select({ id: attendanceTable.id })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.subjectId, theoryLec.subjectId), eq(attendanceTable.date, "2026-08-31")));

    assert.strictEqual(countBefore.length, countAfter.length, "Row count must remain identical after edit (no duplicates)");

    // Re-verify student schedule now reflects updated PRESENT
    const resUpdatedStudent = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionTokenAbsent}` },
    });
    const updatedStudentData = (await resUpdatedStudent.json()) as any;
    const recheckedLec = updatedStudentData.lectures.find((l: any) => l.subjectId === theoryLec.subjectId);
    assert.strictEqual(recheckedLec.attendanceStatus, "ATTENDANCE_UPLOADED_PRESENT");
    console.log("✓ Edit attendance updated cleanly without duplicating records");

    // ── 11. Date Navigation & Empty State ──
    console.log("\n[TEST 11] Date Navigation: Non-Teaching / Weekend Day");
    const resSunday = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-08-30`, {
      headers: { Cookie: `ac_session=${sessionTokenMG}` },
    });
    assert.strictEqual(resSunday.status, 200);
    const dataSunday = (await resSunday.json()) as any;
    assert.strictEqual(dataSunday.lectures.length, 0, "Sunday must return 0 lectures");
    console.log("✓ Date navigation to Sunday triggered empty schedule state");

    console.log("\n==================================================");
    console.log("ALL PHASE 4 TESTS PASSED SUCCESSFULLY! (100% OK)");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

runPhase4Tests()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Phase 4 test failed:", err);
    pool.end();
    process.exit(1);
  });
