import fs from "node:fs";
import * as XLSX from "../../lib/db/node_modules/xlsx/xlsx.mjs";

const p = "C:\\Users\\vansh\\OneDrive\\Desktop\\Attendance-Companion\\data\\seed\\Attendance_Demo.xlsx";
console.log("File exists?", fs.existsSync(p));
if (fs.existsSync(p)) {
  const buf = fs.readFileSync(p);
  console.log("Buffer length:", buf.length);
  const wb = XLSX.read(buf, { type: "buffer" });
  console.log("Sheet names:", wb.SheetNames);
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Sheet "${sheetName}": ${rows.length} rows`);
    if (rows.length > 0) {
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        console.log(`  [${sheetName}] Row ${i}:`, JSON.stringify(rows[i]));
      }
    }
  }
}
