// utils/encryption.ts
import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.SECRET_KEY || "my-secret-key"; // .env file e rakh

export const encrypt = (data: string): string => {
  return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
};

export const decrypt = (cipherText: string): string => {
  const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
