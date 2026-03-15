import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sodium from "libsodium-wrappers-sumo";

/**
 * 復号に必要なメタデータを含む暗号化済み JSON ペイロードです。
 */
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

/**
 * 任意の JSON 化可能な値を、パスワードベース鍵導出と AEAD で暗号化します。
 *
 * 鍵導出には Argon2id、暗号化には XChaCha20-Poly1305-IETF を利用し、
 * 復号に必要なソルトや nonce も合わせて返します。
 *
 * @param value 暗号化対象の値
 * @param password 鍵導出に利用するパスワード
 * @returns 暗号化済みペイロード
 */
export async function encryptJson(value: unknown, password: string): Promise<EncryptedPayload> {
  await sodium.ready;

  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  // 復号側でも再現できるよう、KDF パラメータとソルトをペイロードに保存します。
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

  // 生成済みデータ以外の機微情報は、利用後すぐにメモリ上から消去します。
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

/**
 * JSON 値を暗号化し、親ディレクトリを含めて保存先へ書き出します。
 *
 * ファイルは `0600` で作成し、ローカルユーザー以外から読めない状態を既定にします。
 *
 * @param filePath 出力先パス
 * @param value 暗号化して保存する値
 * @param password 鍵導出に利用するパスワード
 * @returns 保存先の絶対パス
 */
export async function saveEncryptedJson(
  filePath: string,
  value: unknown,
  password: string,
): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  const payload = await encryptJson(value, password);

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  // 改行付きで整形保存し、人間がメタデータを確認しやすい形にします。
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return resolvedPath;
}
