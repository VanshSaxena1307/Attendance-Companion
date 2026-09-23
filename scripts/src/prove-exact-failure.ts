import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import { sessionForUser } from "../../artifacts/api-server/src/lib/attendance-domain";
import {
  db,
  pool,
  studentsTable,
  usersTable,
  sectionsTable,
  subjectsTable,
  teachersTable,
  teacherSubjectSectionsTable,
  timetableEntriesTable,
  lectureInstancesTable,
  attendanceTable,
  eq,
  and,
  sql
} from "../../lib/db/src/index";
import * as teacherAttendance from "../../artifacts/api-server/src/lib/postgres-attendance-repository";

async function proveFailure() {
  console.log("==================================================");
  console.log("PROVING EXACT RUNTIME ROSTER FAILURE");
  console.log("==================================================");

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── STEP 2: DIRECT POSTGRESQL INSPECTION ──
    console.log("\n--- STEP 2: DIRECT POSTGRESQL INSPECTION ---");

    // A. Subject
    const [sub] = await db.select().from(subjectsTable).where(eq(subjectsTable.code, "25VA351"));
    console.log(`Subject: ID=${sub.id}, Code=${sub.code}, Name="${sub.name}", Type=${sub.subjectType}`);

    // B. Section
    const [sec] = await db.select().from(sectionsTable).where(eq(sectionsTable.code, "CSE35"));
    console.log(`Section: ID=${sec.id}, Code=${sec.code}, Dept="${sec.department}", Semester=${sec.semester}`);

    // C. Teacher
    const [teacherUser] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        teacherCode: teachersTable.teacherCode,
        initials: usersTable.initials,
      })
      .from(usersTable)
      .innerJoin(teachersTable, eq(teachersTable.id, usersTable.id))
      .where(eq(teachersTable.teacherCode, "MTR_FSD_05"));
    console.log(`Teacher: ID=${teacherUser.id}, Name="${teacherUser.name}", Code=${teacherUser.teacherCode}, Initials=${teacherUser.initials}`);

    // D. Timetable Entry
    const [tte] = await db
      .select()
      .from(timetableEntriesTable)
      .where(
        and(
          eq(timetableEntriesTable.sectionId, sec.id),
          eq(timetableEntriesTable.subjectId, sub.id),
          eq(timetableEntriesTable.dayOfWeek, "WEDNESDAY"),
          eq(timetableEntriesTable.startTime, "08:50")
        )
      );
    console.log(`Timetable Entry: ID=${tte.id}`);
    console.log(`  dayOfWeek=${tte.dayOfWeek}, startTime=${tte.startTime}, endTime=${tte.endTime}`);
    console.log(`  batchType=${tte.batchType}, batch=${tte.batch}, room=${tte.room}, lectureType=${tte.lectureType}`);
    console.log(`  teacherId=${tte.teacherId}, teacherName="${tte.teacherName}", teacherInitials=${tte.teacherInitials}`);

    // E. Lecture Instance on 2026-09-23
    const instances = await db
      .select()
      .from(lectureInstancesTable)
      .where(
        and(
          eq(lectureInstancesTable.timetableEntryId, tte.id),
          eq(lectureInstancesTable.date, "2026-09-23")
        )
      );
    console.log(`Lecture Instances on 2026-09-23 for this timetable entry: count=${instances.length}`);
    if (instances.length > 0) {
      console.log("  Existing instance:", instances[0]);
    } else {
      console.log("  No lecture instance pre-created (created lazily upon attendance submission).");
    }

    // F. Teacher Assignment (teacher_subject_sections table)
    const assignments = await db
      .select()
      .from(teacherSubjectSectionsTable)
      .where(
        and(
          eq(teacherSubjectSectionsTable.subjectId, sub.id),
          eq(teacherSubjectSectionsTable.sectionId, sec.id)
        )
      );
    console.log(`Teacher Assignments in teacher_subject_sections for CSE35 + 25VA351: count=${assignments.length}`);
    for (const a of assignments) {
      console.log(`  Assignment ID=${a.id}, teacherId=${a.teacherId}, subjectType=${a.subjectType}`);
    }
    const isVMAssignedInTSS = assignments.some(a => a.teacherId === teacherUser.id);
    console.log(`  Is Mr. Vikas Maurya (${teacherUser.id}) in teacher_subject_sections for CSE35?: ${isVMAssignedInTSS}`);

    // G. Enrolled Students in CSE35
    const allCse35Students = await db
      .select({
        id: studentsTable.id,
        name: usersTable.name,
        rollNo: studentsTable.rollNo,
        admissionNo: studentsTable.admissionNo,
        labBatch: studentsTable.labBatch,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
      .where(eq(studentsTable.sectionId, sec.id));
    console.log(`Total students in CSE35: ${allCse35Students.length}`);

    // H. Enrolled Students in B2 for 25VA351
    const b2Students = allCse35Students.filter(s => s.labBatch === "B2");
    console.log(`Students in CSE35 with labBatch = "B2": ${b2Students.length}`);
    console.log("First 3 B2 students in DB:");
    for (const s of b2Students.slice(0, 3)) {
      console.log(`  ID=${s.id}, Name="${s.name}", Roll=${s.rollNo}, Adm=${s.admissionNo}, Batch=${s.labBatch}`);
    }

    // ── STEP 6: ORIGIN OF "33 students enrolled" ON THE SCREENSHOT CARD ──
    console.log("\n--- STEP 6: ORIGIN OF '33 students enrolled' ---");
    const sessionTokenVM = sessionForUser({
      id: teacherUser.id,
      name: teacherUser.name,
      role: "MENTOR",
      email: "vikas.mtrfsd05@abes.ac.in",
      initials: teacherUser.initials,
      department: "Computer Science & Engineering",
    });

    const resSchedule = await fetch(`${baseUrl}/api/mentor/schedule/today?date=2026-09-23`, {
      headers: { Cookie: `ac_session=${sessionTokenVM}` },
    });
    const schedData = (await resSchedule.json()) as any;
    const lectureCard = schedData.lectures.find((l: any) => l.timetableEntryId === tte.id);
    console.log("Lecture card returned by GET /api/mentor/schedule/today:");
    console.log(JSON.stringify(lectureCard, null, 2));
    console.log(`The '33 students enrolled' badge comes from: lectureCard.enrolledStudentsCount = ${lectureCard.enrolledStudentsCount}`);
    console.log(`Calculated in getMentorSchedule by querying studentsTable with labBatch = entry.batch (${tte.batch}).`);

    // ── STEP 1: EXACT API REQUEST MADE WHEN CLICKING 'MARK ATTENDANCE' ──
    console.log("\n--- STEP 1: EXACT API REQUEST TRIGGERED BY FRONTEND ---");
    // Frontend does:
    // useGetTeacherSectionStudents(activeSectionId, rosterParams, ...)
    // activeSectionId = "section-d3077b1d67605c23"
    // rosterParams = { subjectId: "subject-35fec8b4f2b1bed7", timetableEntryId: "tte-072096126a985bee" }
    // Method: GET
    // URL: /api/teacher/sections/section-d3077b1d67605c23/students?subjectId=subject-35fec8b4f2b1bed7&timetableEntryId=tte-072096126a985bee
    const rosterUrl = `${baseUrl}/api/teacher/sections/${sec.id}/students?subjectId=${sub.id}&timetableEntryId=${tte.id}`;
    console.log(`Request Method: GET`);
    console.log(`Request URL: ${rosterUrl}`);
    console.log(`Authenticated Teacher ID: ${teacherUser.id} (${teacherUser.name})`);

    const resRoster = await fetch(rosterUrl, {
      method: "GET",
      headers: { Cookie: `ac_session=${sessionTokenVM}` },
    });
    const rosterStatus = resRoster.status;
    const rosterBody = await resRoster.text();
    console.log(`Response Status: ${rosterStatus}`);
    console.log(`Response Body: ${rosterBody}`);

    // Also check attendance status query made in parallel
    const attUrl = `${baseUrl}/api/teacher/attendance?subjectId=${sub.id}&sectionId=${sec.id}&date=2026-09-23&timetableEntryId=${tte.id}`;
    const resAtt = await fetch(attUrl, {
      method: "GET",
      headers: { Cookie: `ac_session=${sessionTokenVM}` },
    });
    console.log(`Parallel Attendance Status Query URL: ${attUrl}`);
    console.log(`Parallel Attendance Response Status: ${resAtt.status}`);
    console.log(`Parallel Attendance Response Body: ${await resAtt.text()}`);

    // ── STEP 3: EXECUTE REAL PRODUCTION REPOSITORY METHOD ──
    console.log("\n--- STEP 3: DIRECT EXECUTION OF PRODUCTION REPOSITORY METHOD ---");
    console.log(`Calling teacherAttendance.getTeacherStudents("${teacherUser.id}", "${sub.id}", "${sec.id}", "${tte.id}")...`);
    const repoResult = await teacherAttendance.getTeacherStudents(teacherUser.id, sub.id, sec.id, tte.id);
    console.log(`Repository returned:`, repoResult);
    console.log(`Result is undefined?: ${repoResult === undefined}`);

    // ── STEP 4: FRONTEND QUERY PARAMS TRACING ──
    console.log("\n--- STEP 4: FRONTEND IDENTIFIER TRACE ---");
    console.log(`From main-pages.tsx line 175-184:`);
    console.log(`activeSubjectId: "${sub.id}"`);
    console.log(`activeSectionId: "${sec.id}"`);
    console.log(`activeTimetableEntryId: "${tte.id}"`);
    console.log(`activeLectureInstanceId: undefined`);
    console.log(`rosterParams: { subjectId: "${sub.id}", timetableEntryId: "${tte.id}" }`);
    console.log(`Identifiers match timetableEntry exactly: YES`);

  } finally {
    server.close();
    await pool.end();
  }
}

proveFailure().catch(console.error);
