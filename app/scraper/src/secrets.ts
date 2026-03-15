import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sodium from "libsodium-wrappers-sumo";

export type EncryptedPayload = {
  algorithm: "xchacha20poly1305-ietf";
  ciphertext: string;
  kdf: "argon2id";
  kdfParams: {
    keyLength: number;
    memLimit: number;
    opsLimit: number;
    salt: string;
  };
  nonce: string;
  version: 1;
};

const KEY_LENGTH = 32;

export async function encryptJson(value: unknown, password: string): Promise<EncryptedPayload> {
  await sodium.ready;

  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const key = sodium.crypto_pwhash(
    KEY_LENGTH,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
    sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
    "uint8array",
  );

  const plaintext = sodium.from_string(JSON.stringify(value));
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    key,
    "base64",
  );

  sodium.memzero(key);
  sodium.memzero(plaintext);

  return {
    algorithm: "xchacha20poly1305-ietf",
    ciphertext,
    kdf: "argon2id",
    kdfParams: {
      keyLength: KEY_LENGTH,
      memLimit: sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
      opsLimit: sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
      salt: sodium.to_base64(salt),
    },
    nonce: sodium.to_base64(nonce),
    version: 1,
  };
}

export async function saveEncryptedJson(
  filePath: string,
  value: unknown,
  password: string,
): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  const payload = await encryptJson(value, password);

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return resolvedPath;
}
