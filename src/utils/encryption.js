const crypto = require("crypto");

// Fetch encryption key from environment variable
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error("CRITICAL: ENCRYPTION_KEY env variable must be exactly 32 characters long.");
  }
  return Buffer.from(key, "utf-8");
};

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size is always 16 bytes

/**
 * Encrypt plain text using AES-256-CBC
 * @param {string} text - Plain text input
 * @returns {string} - Encrypted string in format "iv_hex:ciphertext_hex"
 */
const encryptText = (text) => {
  if (text === null || text === undefined || text === "") return text;
  
  // Keep values unchanged if they are already objects/arrays or parsed parameters
  if (typeof text !== "string") {
    text = String(text);
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("❌ Encryption failed:", err.message);
    return text;
  }
};

/**
 * Decrypt cipher text using AES-256-CBC
 * @param {string} cipherText - Cipher text in format "iv_hex:ciphertext_hex"
 * @returns {string} - Decrypted plain text
 */
const decryptText = (cipherText) => {
  if (!cipherText || typeof cipherText !== "string") return cipherText;

  // If the text does not contain a colon, it is not in the format "iv:ciphertext" (e.g. legacy clear text)
  if (!cipherText.includes(":")) {
    return cipherText;
  }

  try {
    const key = getEncryptionKey();
    const parts = cipherText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    
    // Safety check on IV length
    if (iv.length !== IV_LENGTH) {
      return cipherText;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    // If decryption fails, return the original text gracefully (supports database migrations/fallback)
    return cipherText;
  }
};

/**
 * Hash plain text using SHA-256 for exact match search lookups in indexing
 * @param {string} text - Input text (e.g. phone number or email)
 * @returns {string} - SHA-256 hex string
 */
const hashText = (text) => {
  if (text === null || text === undefined || text === "") return text;
  
  const cleanText = String(text).trim().toLowerCase();
  return crypto.createHash("sha256").update(cleanText).digest("hex");
};

module.exports = {
  encryptText,
  decryptText,
  hashText
};
