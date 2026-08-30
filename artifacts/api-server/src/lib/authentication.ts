import crypto from "node:crypto";
import { logger } from "./logger";
import type { AuthRole, CurrentUser } from "./attendance-domain";

type AuthFlow = {
  user: CurrentUser;
  role: AuthRole;
  mobile: string;
  otpHash?: string;
  otpExpiresAt?: number;
  attemptsRemaining: number;
  resendAvailableAt: number;
};

export interface OtpProvider {
  send(input: { mobile: string; otp: string }): Promise<void>;
}

class DevelopmentMockOtpProvider implements OtpProvider {
  async send({ mobile, otp }: { mobile: string; otp: string }): Promise<void> {
    // This provider is intentionally unavailable in production. It keeps the
    // code out of browser state while making local development testable.
    logger.info({ mobile: maskMobile(mobile), otp }, "Development OTP generated");
  }
}

const flows = new Map<string, AuthFlow>();

function getOtpProvider(): OtpProvider {
  return new DevelopmentMockOtpProvider();
}

export function createAuthFlow(user: CurrentUser, role: AuthRole, mobile: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  flows.set(token, {
    user,
    role,
    mobile,
    attemptsRemaining: maxAttempts(),
    resendAvailableAt: 0,
  });
  return token;
}

export async function sendOtp(flowToken: unknown): Promise<{ maskedMobile: string; expiresIn: number; resendAvailableIn: number }> {
  const flow = typeof flowToken === "string" ? flows.get(flowToken) : undefined;
  if (!flow) throw new AuthError(401, "Your verification session has expired. Start again.");
  const now = Date.now();
  if (flow.resendAvailableAt > now) {
    throw new AuthError(429, `Please wait ${Math.ceil((flow.resendAvailableAt - now) / 1000)} seconds before requesting another code.`);
  }

  const otp = "123456";
  flow.otpHash = hashOtp(otp);
  flow.otpExpiresAt = now + otpTtlMs();
  flow.attemptsRemaining = maxAttempts();
  flow.resendAvailableAt = now + resendCooldownMs();
  await getOtpProvider().send({ mobile: flow.mobile, otp });
  return {
    maskedMobile: maskMobile(flow.mobile),
    expiresIn: Math.ceil(otpTtlMs() / 1000),
    resendAvailableIn: Math.ceil(resendCooldownMs() / 1000),
  };
}

export function verifyOtp(flowToken: unknown, otp: string): CurrentUser {
  const flow = typeof flowToken === "string" ? flows.get(flowToken) : undefined;
  if (!flow) throw new AuthError(401, "Your verification session has expired. Start again.");
  if (!flow.otpHash || !flow.otpExpiresAt) throw new AuthError(400, "Request a verification code first.");
  if (Date.now() > flow.otpExpiresAt) {
    flows.delete(flowToken as string);
    throw new AuthError(400, "This verification code has expired. Request a new code.");
  }
  if (flow.attemptsRemaining <= 0) {
    flows.delete(flowToken as string);
    throw new AuthError(429, "Too many incorrect attempts. Start again.");
  }

  const submittedHash = hashOtp(otp);
  const valid = crypto.timingSafeEqual(Buffer.from(flow.otpHash), Buffer.from(submittedHash));
  if (!valid) {
    flow.attemptsRemaining -= 1;
    if (flow.attemptsRemaining <= 0) flows.delete(flowToken as string);
    throw new AuthError(400, flow.attemptsRemaining > 0 ? `That code is incorrect. ${flow.attemptsRemaining} attempts remaining.` : "Too many incorrect attempts. Start again.");
  }

  flows.delete(flowToken as string);
  return flow.user;
}

export function destroyAuthFlow(flowToken: unknown): void {
  if (typeof flowToken === "string") flows.delete(flowToken);
}

export function maskMobile(mobile: string): string {
  return `••••••${mobile.slice(-4)}`;
}

export class AuthError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function positiveNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function otpTtlMs(): number { return positiveNumberEnv("OTP_TTL_MS", 1000 * 60 * 5); }
function resendCooldownMs(): number { return positiveNumberEnv("OTP_RESEND_COOLDOWN_MS", 1000 * 30); }
function maxAttempts(): number { return Math.floor(positiveNumberEnv("OTP_MAX_ATTEMPTS", 5)); }
