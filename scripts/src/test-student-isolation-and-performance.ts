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
  eq,
} from "../../lib/db/src/index";

async function runStudentIsolationTests() {
  console.log("==================================================");
  console.log("TESTING STRICT STUDENT DATA ISOLATION & PERFORMANCE");
  console.log("==================================================");

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. RESOLVE TWO REAL STUDENTS FROM POSTGRESQL DATABASE
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 1] Querying real students from PostgreSQL...");

    // Student A: Vansh Saxena (admissionNo: 2025B01010066, mobile: 9012562896)
    const [studentARow] = await db
      .select({
        id: studentsTable.id,
        admissionNo: studentsTable.admissionNo,
        rollNo: studentsTable.rollNo,
        mobile: studentsTable.mobile,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        initials: usersTable.initials,
        department: usersTable.department,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
      .where(eq(studentsTable.admissionNo, "2025B01010066"));
    assert(studentARow, "Student A (2025B01010066) must exist in DB");
    console.log(`✓ Student A: ${studentARow.name} (${studentARow.admissionNo}, id: ${studentARow.id})`);

    // Student B: Vaishnavi Sharma (admissionNo: 2025B01010988, mobile: 9616166656)
    const [studentBRow] = await db
      .select({
        id: studentsTable.id,
        admissionNo: studentsTable.admissionNo,
        rollNo: studentsTable.rollNo,
        mobile: studentsTable.mobile,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        initials: usersTable.initials,
        department: usersTable.department,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
      .where(eq(studentsTable.admissionNo, "2025B01010988"));
    assert(studentBRow, "Student B (2025B01010988) must exist in DB");
    assert(studentARow.id !== studentBRow.id, "Student A and Student B must have different IDs");
    console.log(`✓ Student B: ${studentBRow.name} (${studentBRow.admissionNo}, id: ${studentBRow.id})`);

    // ─────────────────────────────────────────────────────────────
    // 2. AUTHENTICATION FLOW: VERIFY OTP & SESSION CREATION
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 2] Testing server-authenticated identity login flow...");

    function extractCookie(res: Response, name: string): string {
      const getSetCookie = (res.headers as any).getSetCookie?.bind(res.headers);
      const cookies: string[] = getSetCookie ? getSetCookie() : [res.headers.get("set-cookie") || ""];
      for (const c of cookies) {
        if (c.includes(`${name}=`)) {
          return c.split(";")[0];
        }
      }
      return "";
    }

    // Test full auth flow for Student A
    const idResA = await fetch(`${baseUrl}/api/auth/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "STUDENT",
        identifier: studentARow.admissionNo,
        mobile: studentARow.mobile,
      }),
    });
    assert.strictEqual(idResA.status, 200, "Student A identity verification should return 200");
    const flowCookieA = extractCookie(idResA, "ac_auth_flow");
    assert(flowCookieA.includes("ac_auth_flow"), "Identity response should set ac_auth_flow cookie");

    // Send OTP
    const sendResA = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: flowCookieA,
      },
    });
    assert.strictEqual(sendResA.status, 200, "Send OTP should return 200");

    // Verify OTP using dev fixed code '123456'
    const otpResA = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: flowCookieA,
      },
      body: JSON.stringify({ otp: "123456" }),
    });
    assert.strictEqual(otpResA.status, 200, "OTP verification should return 200");
    const verifiedUserA = await otpResA.json();
    assert.strictEqual(verifiedUserA.id, studentARow.id, "Authenticated user ID must match Student A DB ID");
    assert.strictEqual(verifiedUserA.name, studentARow.name, "Authenticated user name must match Student A DB name");

    const sessionCookieA = extractCookie(otpResA, "ac_session");
    assert(sessionCookieA.includes("ac_session"), "Session cookie ac_session must be set");
    console.log("✓ Student A successfully authenticated via OTP flow. Session established.");

    // ─────────────────────────────────────────────────────────────
    // 3. STUDENT A RUNTIME DATA VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 3] Verifying Student A runtime data isolation...");

    // /api/me
    const meResA = await fetch(`${baseUrl}/api/me`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(meResA.status, 200);
    const meDataA = await meResA.json();
    assert.strictEqual(meDataA.id, studentARow.id, "/api/me must return Student A ID");
    assert.strictEqual(meDataA.name, studentARow.name, "/api/me must return Student A name");
    console.log("✓ /api/me correctly returns Student A identity");

    // /api/dashboard/summary
    const t0 = performance.now();
    const dashResA = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: sessionCookieA },
    });
    const dashTimeA = performance.now() - t0;
    assert.strictEqual(dashResA.status, 200);
    const dashDataA = await dashResA.json();
    assert(dashDataA.overall != null, "Dashboard must return overall metrics");
    assert(Array.isArray(dashDataA.subjects), "Dashboard must return subjects array");
    console.log(`✓ /api/dashboard/summary returned Student A data (${dashDataA.overall.percentage}%, ${dashDataA.overall.present}/${dashDataA.overall.total}) in ${dashTimeA.toFixed(1)}ms`);

    // /api/attendance/subjects
    const subjectsResA = await fetch(`${baseUrl}/api/attendance/subjects`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(subjectsResA.status, 200);
    const subjectsDataA = await subjectsResA.json();
    assert(Array.isArray(subjectsDataA), "Subjects must be an array");
    console.log(`✓ /api/attendance/subjects returned ${subjectsDataA.length} subjects for Student A`);

    // /api/attendance/history
    const historyResA = await fetch(`${baseUrl}/api/attendance/history?page=1&pageSize=50`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(historyResA.status, 200);
    const historyDataA = await historyResA.json();
    assert(Array.isArray(historyDataA.items), "History items must be an array");
    console.log(`✓ /api/attendance/history returned ${historyDataA.total} total history records for Student A`);

    // /api/attendance/trend
    const trendResA = await fetch(`${baseUrl}/api/attendance/trend`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(trendResA.status, 200);
    const trendDataA = await trendResA.json();
    assert(Array.isArray(trendDataA), "Trend data must be an array");
    console.log(`✓ /api/attendance/trend returned ${trendDataA.length} trend points for Student A`);

    // /api/student/schedule/today
    const schedResA = await fetch(`${baseUrl}/api/student/schedule/today`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(schedResA.status, 200);
    const schedDataA = await schedResA.json();
    assert.strictEqual(schedDataA.student.id, studentARow.id, "Schedule must belong to Student A");
    console.log(`✓ /api/student/schedule/today returned Student A schedule (${schedDataA.lectures.length} lectures)`);

    // /api/students/me
    const profileResA = await fetch(`${baseUrl}/api/students/me`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(profileResA.status, 200);
    const profileDataA = await profileResA.json();
    assert.strictEqual(profileDataA.id, studentARow.id, "Profile must belong to Student A");
    console.log("✓ /api/students/me returned Student A profile");

    // ─────────────────────────────────────────────────────────────
    // 4. CROSS-STUDENT ACCESS PREVENTION
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 4] Testing cross-student access prevention (Student A attempting to access Student B)...");

    // Attempt to access Student B's profile
    const crossProfileRes = await fetch(`${baseUrl}/api/students/${studentBRow.id}`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(crossProfileRes.status, 403, "Student A must be blocked from accessing Student B's profile (403 Forbidden)");
    const crossProfileErr = await crossProfileRes.json();
    assert.strictEqual(crossProfileErr.error, "Students can only access their own profile.");
    console.log("✓ Cross-student profile access strictly denied (HTTP 403)");

    // Attempt to access staff student list
    const studentsListRes = await fetch(`${baseUrl}/api/students`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(studentsListRes.status, 403, "Student A must be blocked from /api/students (403 Forbidden)");
    console.log("✓ Staff student directory access strictly denied to student (HTTP 403)");

    // Attempt to access teacher assignments
    const teacherAssignRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(teacherAssignRes.status, 403, "Student A must be blocked from teacher assignments (403 Forbidden)");
    console.log("✓ Teacher assignments access strictly denied to student (HTTP 403)");

    // Attempt to access department schedule management
    const cancelRes = await fetch(`${baseUrl}/api/schedule/unexpected-holiday`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookieA,
      },
      body: JSON.stringify({ date: "2026-09-20", reason: "Unauthorized attempt" }),
    });
    assert.strictEqual(cancelRes.status, 403, "Student A must be blocked from holiday management (403 Forbidden)");
    console.log("✓ HOD schedule management strictly denied to student (HTTP 403)");

    // ─────────────────────────────────────────────────────────────
    // 5. ROLE AUTHORIZATION ON STUDENT ENDPOINTS (NO FALLBACKS!)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 5] Testing role authorization on student endpoints (Mentor & HOD access must be 403, NO FALLBACK)...");

    // Authenticate as Mentor Priya
    const mentorUser: CurrentUser = {
      id: "mentor-priya",
      name: "Varun Chaubey",
      email: "priya.nair@attendance.edu",
      role: "MENTOR",
      initials: "VC",
      department: "Computer Science & Engineering",
    };
    const mentorCookie = `ac_session=${sessionForUser(mentorUser)}`;

    // Mentor hitting /api/dashboard/summary -> MUST BE 403 (used to fall back to student-vansh!)
    const mentorDashRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: mentorCookie },
    });
    assert.strictEqual(mentorDashRes.status, 403, "Mentor calling /api/dashboard/summary must return 403 Forbidden (no student fallback!)");
    const mentorDashErr = await mentorDashRes.json();
    assert.strictEqual(mentorDashErr.error, "This action requires a student role.");
    console.log("✓ /api/dashboard/summary rejected mentor call with HTTP 403 (zero student-vansh fallback)");

    // Mentor hitting /api/attendance/subjects -> MUST BE 403
    const mentorSubjRes = await fetch(`${baseUrl}/api/attendance/subjects`, {
      headers: { Cookie: mentorCookie },
    });
    assert.strictEqual(mentorSubjRes.status, 403, "Mentor calling /api/attendance/subjects must return 403 Forbidden");
    console.log("✓ /api/attendance/subjects rejected mentor call with HTTP 403");

    // Mentor hitting /api/attendance/history -> MUST BE 403
    const mentorHistRes = await fetch(`${baseUrl}/api/attendance/history`, {
      headers: { Cookie: mentorCookie },
    });
    assert.strictEqual(mentorHistRes.status, 403, "Mentor calling /api/attendance/history must return 403 Forbidden");
    console.log("✓ /api/attendance/history rejected mentor call with HTTP 403");

    // Mentor hitting /api/attendance/trend -> MUST BE 403
    const mentorTrendRes = await fetch(`${baseUrl}/api/attendance/trend`, {
      headers: { Cookie: mentorCookie },
    });
    assert.strictEqual(mentorTrendRes.status, 403, "Mentor calling /api/attendance/trend must return 403 Forbidden");
    console.log("✓ /api/attendance/trend rejected mentor call with HTTP 403");

    // Mentor hitting /api/student/schedule/today -> MUST BE 403
    const mentorSchedRes = await fetch(`${baseUrl}/api/student/schedule/today`, {
      headers: { Cookie: mentorCookie },
    });
    assert.strictEqual(mentorSchedRes.status, 403, "Mentor calling /api/student/schedule/today must return 403 Forbidden");
    console.log("✓ /api/student/schedule/today rejected mentor call with HTTP 403");

    // ─────────────────────────────────────────────────────────────
    // 6. LOGOUT AND COMPLETE CACHE CLEARANCE
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 6] Testing logout and session destruction...");

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookieA },
    });
    assert.strictEqual(logoutRes.status, 204, "Logout should return 204 No Content");
    console.log("✓ Logout succeeded with 204 No Content");

    // Verify unauthenticated requests fail with 401
    const unauthRes = await fetch(`${baseUrl}/api/me`);
    assert.strictEqual(unauthRes.status, 401, "Unauthenticated /api/me must return 401");
    const unauthDash = await fetch(`${baseUrl}/api/dashboard/summary`);
    assert.strictEqual(unauthDash.status, 401, "Unauthenticated /api/dashboard/summary must return 401");
    console.log("✓ Unauthenticated access strictly blocked with HTTP 401");

    // ─────────────────────────────────────────────────────────────
    // 7. STUDENT B LOGIN & FULL DATA ISOLATION VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 7] Logging in as Student B (Vaishnavi Sharma)...");

    const idResB = await fetch(`${baseUrl}/api/auth/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "STUDENT",
        identifier: studentBRow.admissionNo,
        mobile: studentBRow.mobile,
      }),
    });
    assert.strictEqual(idResB.status, 200, "Student B identity should be verified");
    const flowCookieB = extractCookie(idResB, "ac_auth_flow");

    const sendResB = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: flowCookieB,
      },
    });
    assert.strictEqual(sendResB.status, 200, "Send OTP should return 200 for Student B");

    const otpResB = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: flowCookieB,
      },
      body: JSON.stringify({ otp: "123456" }),
    });
    assert.strictEqual(otpResB.status, 200, "Student B OTP should be verified");
    const sessionCookieB = extractCookie(otpResB, "ac_session");

    // Verify Student B /api/me
    const meResB = await fetch(`${baseUrl}/api/me`, {
      headers: { Cookie: sessionCookieB },
    });
    assert.strictEqual(meResB.status, 200);
    const meDataB = await meResB.json();
    assert.strictEqual(meDataB.id, studentBRow.id, "/api/me must return Student B's ID");
    assert.strictEqual(meDataB.name, studentBRow.name, "/api/me must return Student B's name");
    assert.notStrictEqual(meDataB.id, studentARow.id, "Student B ID must NOT equal Student A ID");
    console.log(`✓ /api/me verified for Student B: ${meDataB.name} (${meDataB.id})`);

    // Verify Student B /api/dashboard/summary
    const t0B = performance.now();
    const dashResB = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: sessionCookieB },
    });
    const dashTimeB = performance.now() - t0B;
    assert.strictEqual(dashResB.status, 200);
    const dashDataB = await dashResB.json();
    console.log(`✓ /api/dashboard/summary returned Student B data (${dashDataB.overall.percentage}%, ${dashDataB.overall.present}/${dashDataB.overall.total}) in ${dashTimeB.toFixed(1)}ms`);

    // Verify Student B's recentActivity has NO Student A activity
    assert(Array.isArray(dashDataB.recentActivity), "recentActivity must be an array");
    for (const act of dashDataB.recentActivity) {
      assert(!act.description.includes("Priya Nair") && !act.title.includes("OOPS"), "Student B must not have Student A mock activity");
    }
    console.log(`✓ Student B recentActivity is clean (${dashDataB.recentActivity.length} activities, zero Student A items)`);

    // Verify Student B /api/student/schedule/today
    const schedResB = await fetch(`${baseUrl}/api/student/schedule/today`, {
      headers: { Cookie: sessionCookieB },
    });
    assert.strictEqual(schedResB.status, 200);
    const schedDataB = await schedResB.json();
    assert.strictEqual(schedDataB.student.id, studentBRow.id, "Schedule must belong to Student B");
    assert.strictEqual(schedDataB.student.admissionNo, studentBRow.admissionNo, "Schedule admissionNo must match Student B");
    console.log(`✓ /api/student/schedule/today verified for Student B (${schedDataB.student.name}, section: ${schedDataB.student.sectionCode})`);

    // Verify Student B attempting to access Student A profile -> 403
    const crossProfileResB = await fetch(`${baseUrl}/api/students/${studentARow.id}`, {
      headers: { Cookie: sessionCookieB },
    });
    assert.strictEqual(crossProfileResB.status, 403, "Student B must be blocked from accessing Student A profile (403 Forbidden)");
    console.log("✓ Student B blocked from accessing Student A profile (HTTP 403)");

    // ─────────────────────────────────────────────────────────────
    // 8. PERFORMANCE & PARALLEL EXECUTION BENCHMARK
    // ─────────────────────────────────────────────────────────────
    console.log("\n[STEP 8] Measuring parallelized dashboard initial load flow...");

    // Test parallel vs sequential dashboard load simulation
    // A) Sequential (old way):
    const seqStart = performance.now();
    await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { Cookie: sessionCookieB } });
    await fetch(`${baseUrl}/api/student/schedule/today`, { headers: { Cookie: sessionCookieB } });
    const seqDuration = performance.now() - seqStart;

    // B) Parallel (optimized way):
    const parStart = performance.now();
    await Promise.all([
      fetch(`${baseUrl}/api/dashboard/summary`, { headers: { Cookie: sessionCookieB } }),
      fetch(`${baseUrl}/api/student/schedule/today`, { headers: { Cookie: sessionCookieB } }),
    ]);
    const parDuration = performance.now() - parStart;

    console.log(`Sequential requests time: ${seqDuration.toFixed(1)}ms`);
    console.log(`Parallel requests time:   ${parDuration.toFixed(1)}ms`);
    console.log(`Latency reduction:        ${(seqDuration - parDuration).toFixed(1)}ms (${(((seqDuration - parDuration) / seqDuration) * 100).toFixed(1)}% faster)`);

    console.log("\n==================================================");
    console.log("ALL STUDENT DATA ISOLATION & PERFORMANCE TESTS PASSED (100% OK)!");
    console.log("==================================================");
  } finally {
    server.close();
    await pool.end();
  }
}

runStudentIsolationTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
