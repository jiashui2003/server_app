import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Optional local credential-at-rest protection (planned extension, default off).
// When SERVERLENS_CRED_KEY is set, sensitive server fields such as the SSH key
// path are stored as an AES-256-GCM envelope instead of plaintext. When the
// variable is absent the store keeps the current plaintext metadata behavior so
// demo mode still runs with zero configuration.

const ENVELOPE_TYPE = 'serverlens.cred.v1';
const SENSITIVE_SERVER_FIELDS = ['keyPath'];

export function createCredentialCipher(secret = process.env.SERVERLENS_CRED_KEY ?? '') {
  const key = String(secret ?? '').trim();
  if (!key) {
    return { enabled: false, encryptServer: passthrough, decryptServer: passthrough };
  }
  const derivedKey = scryptSync(key, 'serverlens-credential-salt', 32);

  function encryptValue(plain) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
    const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      __enc: ENVELOPE_TYPE,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: data.toString('base64')
    };
  }

  function decryptValue(envelope) {
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const data = Buffer.from(envelope.data, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  return {
    enabled: true,
    encryptServer(server) {
      const clone = { ...server };
      for (const field of SENSITIVE_SERVER_FIELDS) {
        if (typeof clone[field] === 'string' && clone[field]) {
          clone[field] = encryptValue(clone[field]);
        }
      }
      return clone;
    },
    decryptServer(server) {
      const clone = { ...server };
      for (const field of SENSITIVE_SERVER_FIELDS) {
        if (isEnvelope(clone[field])) {
          clone[field] = decryptValue(clone[field]);
        }
      }
      return clone;
    }
  };
}

function isEnvelope(value) {
  return Boolean(value) && typeof value === 'object' && value.__enc === ENVELOPE_TYPE;
}

function passthrough(value) {
  return value;
}
