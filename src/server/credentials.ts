import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { z } from "zod";
const envelopeSchema = z.object({
  version: z.literal(1),
  wrapped: z.string(),
  wrapIv: z.string(),
  wrapTag: z.string(),
  body: z.string(),
  iv: z.string(),
  tag: z.string(),
});
function rootKey(root: string) {
  const key = Buffer.from(root, "base64");
  if (key.length !== 32)
    throw new Error("EVE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}
function seal(key: Buffer, plain: Buffer, aad: Buffer) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    body: body.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
function unseal(
  key: Buffer,
  body: string,
  iv: string,
  tag: string,
  aad: Buffer,
) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64")),
    decipher.final(),
  ]);
}
/** Per-credential random data key, wrapped by the deployment root. Tenant and provider are authenticated. */
export function encryptCredential(
  plaintext: string,
  workspaceId: string,
  provider: string,
  root: string,
) {
  const aad = Buffer.from(`eve:v1:${workspaceId}:${provider}`),
    dataKey = randomBytes(32);
  const payload = seal(dataKey, Buffer.from(plaintext), aad),
    wrapped = seal(rootKey(root), dataKey, aad);
  dataKey.fill(0);
  return JSON.stringify({
    version: 1,
    wrapped: wrapped.body,
    wrapIv: wrapped.iv,
    wrapTag: wrapped.tag,
    ...payload,
  });
}
export function decryptCredential(
  ciphertext: string,
  workspaceId: string,
  provider: string,
  root: string,
) {
  const e = envelopeSchema.parse(JSON.parse(ciphertext)),
    aad = Buffer.from(`eve:v1:${workspaceId}:${provider}`),
    key = unseal(rootKey(root), e.wrapped, e.wrapIv, e.wrapTag, aad);
  try {
    return unseal(key, e.body, e.iv, e.tag, aad).toString();
  } finally {
    key.fill(0);
  }
}
export const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);
export const hashIngestKey = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newIngestKey = () =>
  `eve_${randomBytes(32).toString("base64url")}`;
export function publicWebsite(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(
      url.hostname,
    ) ||
    /\.(localhost|local|internal|test|example)$/.test(url.hostname)
  )
    throw new Error("Enter a public HTTPS website.");
  return url;
}
