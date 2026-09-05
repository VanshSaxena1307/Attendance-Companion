export * from "./generated/api";
// The types/ barrel (plain TS interfaces) is intentionally not re-exported here.
// All consumers use the Zod schemas from ./generated/api directly (.safeParse / .parse).
// Re-exporting types/ would cause ambiguous-export errors when orval generates
// identically-named symbols in both api.ts and types/ (e.g. GetTeacherSectionStudentsParams).
