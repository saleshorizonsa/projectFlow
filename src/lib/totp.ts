import { generateSecret as otpGenerateSecret, generate, verify, generateURI } from "otplib";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { encryptField, decryptField } from "@/lib/encrypt";

const ISSUER = "JASCOMiyaar";
const TOTP_OPTIONS = { digits: 6 } as const;

export function generateSecret(): string {
  return otpGenerateSecret();
}

export async function generateOtpAuthUrl(email: string, secret: string): Promise<string> {
  return generateURI({ label: email, secret, issuer: ISSUER, ...TOTP_OPTIONS });
}

export async function verifyTotp(token: string, encryptedSecret: string): Promise<boolean> {
  try {
    const secret = decryptField(encryptedSecret);
    const result = await verify({ token, secret, ...TOTP_OPTIONS });
    return result.valid;
  } catch {
    return false;
  }
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString("hex").toUpperCase(),
  );
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

export async function verifyAndConsumeBackupCode(
  input: string,
  hashedCodes: string[],
): Promise<{ valid: boolean; remaining: string[] }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(input.toUpperCase(), hashedCodes[i])) {
      return { valid: true, remaining: hashedCodes.filter((_, idx) => idx !== i) };
    }
  }
  return { valid: false, remaining: hashedCodes };
}

export function encryptSecret(secret: string): string {
  return encryptField(secret);
}
