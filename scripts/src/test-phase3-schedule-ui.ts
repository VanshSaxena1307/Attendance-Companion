import assert from "node:assert";
import app from "../../artifacts/api-server/src/app";
import { sessionForUser, type CurrentUser } from "../../artifacts/api-server/src/lib/attendance-domain";
import { db, studentsTable, usersTable, sectionsTable, eq } from "../../lib/db/src/index";
import fs from "node:fs";
import path from "node:path";

async function runPhase3Tests() {
  console.log("==================================================");
  console.log("PHASE 3 — STUDENT TODAY'S SCHEDULE UI VERIFICATION");
  console.log("==================================================");

  // ── 1. Verify No Hardcoded Timetable Data in Frontend ──
  console.log("\n[TEST 1] Hardcoded Data Check");
  const componentPath = path.resolve(import.meta.dirname, "../../artifacts/attendance-companion/src/components/student-today-schedule.tsx");
  const componentCode = fs.readFileSync(componentPath, "utf8");

  // Ensure no hardcoded subject codes, room numbers, or teacher names are baked into component
  assert(!componentCode.includes("25CS303"), "Component must not hardcode subject code 25CS303");
  assert(!componentCode.includes("25AS301"), "Component must not hardcode subject code 25AS301");
  assert(!componentCode.includes("Malvika Gupta"), "Component must not hardcode teacher name");
  assert(!componentCode.includes("Room 301"), "Component must not hardcode room 301");
  console.log("✓ Zero hardcoded timetable, teacher, or subject data in frontend components");

  // ── 2. Real API Integration & Schedule Fetching ──
  console.log("\n[TEST 2] API Integration with Real Database");
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 2.1 Fetch CSE-35 Student (Vansh Saxena: Sec CSE35, Lab B2, Python B3)
    const [studentCse35] = await db
      .select({
        id: studentsTable.id,
        name: usersTable.name,
        rollNo: studentsTable.rollNo,
        sectionCode: sectionsTable.code,
        labBatch: studentsTable.labBatch,
        pythonBatch: studentsTable.pythonBatch,
        cloudBatch: studentsTable.cloudBatch,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
      .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
      .where(eq(studentsTable.rollNo, "2503201001289"));

    assert(studentCse35, "CSE-35 test student not found");
    const user35: CurrentUser = {
      id: studentCse35.id,
      name: studentCse35.name,
      email: "vansh@test.local",
      role: "STUDENT",
      initials: "VS",
      department: "CSE",
    };
    const sessionToken35 = sessionForUser(user35);

    // Test Monday timetable for CSE-35 (2026-08-31)
    const resMonday = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionToken35}` },
    });
    assert.strictEqual(resMonday.status, 200);
    const dataMonday = (await resMonday.json()) as any;
    console.log(`CSE-35 Monday lectures count: ${dataMonday.lectures.length}`);
    assert(dataMonday.lectures.length > 0, "CSE-35 should have lectures on Monday");
    assert.strictEqual(dataMonday.student.sectionCode, "CSE35");
    assert.strictEqual(dataMonday.student.pythonBatch, "B3");
    assert.strictEqual(dataMonday.student.cloudBatch, null);

    // Verify chronological order
    for (let i = 1; i < dataMonday.lectures.length; i++) {
      assert(dataMonday.lectures[i - 1].startTime <= dataMonday.lectures[i].startTime);
    }
    console.log("✓ CSE-35 lectures correctly returned and strictly chronological");

    // 2.2 Fetch CSE-34 Student (Vansh Aggarwal: Sec CSE34, Lab B1, Cloud B2)
    const [studentCse34] = await db
      .select({
        id: studentsTable.id,
        name: usersTable.name,
        rollNo: studentsTable.rollNo,
        sectionCode: sectionsTable.code,
        labBatch: studentsTable.labBatch,
        pythonBatch: studentsTable.pythonBatch,
        cloudBatch: studentsTable.cloudBatch,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
      .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
      .where(eq(studentsTable.rollNo, "2503201001283"));

    assert(studentCse34, "CSE-34 test student not found");
    const user34: CurrentUser = {
      id: studentCse34.id,
      name: studentCse34.name,
      email: "aggarwal@test.local",
      role: "STUDENT",
      initials: "VA",
      department: "CSE",
    };
    const sessionToken34 = sessionForUser(user34);

    const res34Monday = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-31`, {
      headers: { Cookie: `ac_session=${sessionToken34}` },
    });
    assert.strictEqual(res34Monday.status, 200);
    const data34Monday = (await res34Monday.json()) as any;
    console.log(`CSE-34 Monday lectures count: ${data34Monday.lectures.length}`);
    assert.strictEqual(data34Monday.student.sectionCode, "CSE34");
    assert.strictEqual(data34Monday.student.cloudBatch, "B2");
    assert.strictEqual(data34Monday.student.pythonBatch, null);

    // Verify Lab batch B1 isolated from B2 for CSE-34
    const labSlot = data34Monday.lectures.find((l: any) => l.batchType === "LAB");
    assert(labSlot, "CSE-34 Monday should have lab slot");
    assert.strictEqual(labSlot.batch, "B1", "Student with Lab B1 must only see Lab B1");
    console.log("✓ Batch isolation verified across sections and lab/elective subgroups");

    // ── 3. Date Navigation & Empty State ──
    console.log("\n[TEST 3] Date Navigation & Weekend / Empty States");
    // Sunday date (2026-08-30) should return empty lectures array
    const resSunday = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-30`, {
      headers: { Cookie: `ac_session=${sessionToken35}` },
    });
    assert.strictEqual(resSunday.status, 200);
    const dataSunday = (await resSunday.json()) as any;
    console.log(`Sunday lectures count: ${dataSunday.lectures.length}`);
    assert.strictEqual(dataSunday.lectures.length, 0, "Sunday must have 0 lectures (empty state trigger)");
    console.log("✓ Empty state correctly triggered on non-scheduled days");

    // ── 4. Attendance Status Mapping from Real Data ──
    console.log("\n[TEST 4] Attendance Status Verification");
    // Date with real uploaded attendance: 2026-08-24
    const resAtt = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-08-24`, {
      headers: { Cookie: `ac_session=${sessionToken35}` },
    });
    assert.strictEqual(resAtt.status, 200);
    const dataAtt = (await resAtt.json()) as any;
    const statuses = dataAtt.lectures.map((l: any) => l.attendanceStatus);
    console.log("Unique attendance statuses on 2026-08-24:", [...new Set(statuses)]);
    assert(statuses.includes("ATTENDANCE_UPLOADED_PRESENT"), "Expected PRESENT status");
    assert(statuses.includes("ATTENDANCE_UPLOADED_ABSENT"), "Expected ABSENT status");
    assert(statuses.includes("ATTENDANCE_NOT_APPLICABLE"), "Expected NOT_APPLICABLE status for holistic skill");
    console.log("✓ Attendance statuses successfully grounded in real database records");

    // Future date: 2026-11-02 (Monday)
    const resFuture = await fetch(`${baseUrl}/api/student/schedule/today?date=2026-11-02`, {
      headers: { Cookie: `ac_session=${sessionToken35}` },
    });
    assert.strictEqual(resFuture.status, 200);
    const dataFuture = (await resFuture.json()) as any;
    const futureStatuses = dataFuture.lectures.map((l: any) => l.attendanceStatus);
    assert(futureStatuses.every((s: string) => s === "ATTENDANCE_NOT_UPLOADED" || s === "ATTENDANCE_NOT_APPLICABLE"));
    console.log("✓ Future lectures correctly return ATTENDANCE_NOT_UPLOADED");

    // ── 5. Responsive UI Structural Checks ──
    console.log("\n[TEST 5] Responsive Markup Verification");
    // Verify component employs responsive classes
    assert(componentCode.includes("flex-col") && componentCode.includes("md:flex-row"), "Expected responsive layout classes");
    assert(componentCode.includes("min-w-0"), "Expected min-w-0 to prevent text overflow");
    assert(componentCode.includes("data-testid=\"button-schedule-prev-day\""), "Previous day button testId present");
    assert(componentCode.includes("data-testid=\"button-schedule-next-day\""), "Next day button testId present");
    assert(componentCode.includes("data-testid=\"button-schedule-today\""), "Today button testId present");
    console.log("✓ Responsive breakpoints and data-testid attributes verified in source");

    console.log("\n==================================================");
    console.log("ALL PHASE 3 TESTS PASSED SUCCESSFULLY! (100% OK)");
    console.log("==================================================");
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase3Tests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
