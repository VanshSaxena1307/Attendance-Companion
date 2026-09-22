const timeZone = "Asia/Kolkata";

function getLocalDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getISTMinutesAndDate(d: Date = new Date()): { currentMinutes: number; todayStr: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d).split(":");
  const currentMinutes = (parseInt(parts[0], 10) % 24) * 60 + parseInt(parts[1], 10);
  return { currentMinutes, todayStr: getLocalDateString(d) };
}

// Test case 1: Right now
const now = new Date();
console.log("Current system UTC:", now.toISOString());
console.log("Current IST date:", getLocalDateString(now));
console.log("Current IST minutes:", getISTMinutesAndDate(now));

// Test case 2: 02:00 AM IST (which is 20:30 UTC previous day)
const pastMidnightInIndia = new Date("2026-09-21T21:00:00.000Z"); // 02:30 AM IST on 2026-09-22
console.log("\n2026-09-21T21:00:00Z:");
console.log("  UTC date:", pastMidnightInIndia.toISOString().slice(0, 10));
console.log("  IST date:", getLocalDateString(pastMidnightInIndia));
console.log("  IST minutes:", getISTMinutesAndDate(pastMidnightInIndia)); // 2 * 60 + 30 = 150

// Test case 3: 14:15 IST (which is 08:45 UTC)
const afternoonInIndia = new Date("2026-09-22T08:45:00.000Z");
console.log("\n2026-09-22T08:45:00Z:");
console.log("  UTC date:", afternoonInIndia.toISOString().slice(0, 10));
console.log("  IST date:", getLocalDateString(afternoonInIndia));
console.log("  IST minutes:", getISTMinutesAndDate(afternoonInIndia)); // 14 * 60 + 15 = 855

// Check getLectureState behavior:
function getLectureState(startTime: string, endTime: string, queryDateStr: string, now = new Date()) {
  const { currentMinutes, todayStr } = getISTMinutesAndDate(now);
  if (queryDateStr < todayStr) return "COMPLETED";
  if (queryDateStr > todayStr) return "UPCOMING";

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (currentMinutes < startMinutes) return "UPCOMING";
  if (currentMinutes <= endMinutes) return "IN_PROGRESS";
  return "COMPLETED";
}

console.log("\nAt 14:15 IST (08:45 UTC):");
console.log("  Slot 08:50 - 09:40:", getLectureState("08:50", "09:40", "2026-09-22", afternoonInIndia));
console.log("  Slot 14:00 - 15:40:", getLectureState("14:00", "15:40", "2026-09-22", afternoonInIndia));
console.log("  Slot 15:40 - 16:30:", getLectureState("15:40", "16:30", "2026-09-22", afternoonInIndia));
