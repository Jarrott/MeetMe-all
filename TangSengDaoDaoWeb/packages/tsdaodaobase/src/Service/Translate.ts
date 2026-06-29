import { Message } from "wukongimjssdk";
import StorageService from "./StorageService";

const userAutoTranslateKeyPrefix = "meetme_auto_translate_on";

function userAutoTranslateKey(uid?: string): string {
  return `${userAutoTranslateKeyPrefix}_${uid || "guest"}`;
}

export function getUserAutoTranslateOn(uid?: string): boolean {
  const value = StorageService.shared.getItem(userAutoTranslateKey(uid));
  return value !== "0";
}

export function setUserAutoTranslateOn(uid: string | undefined, enabled: boolean) {
  StorageService.shared.setItem(userAutoTranslateKey(uid), enabled ? "1" : "0");
}

export function getPreferredTargetLang(): string {
  const lang = (navigator.language || "zh-CN").trim();
  if (!lang) {
    return "zh-CN";
  }
  if (lang.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }
  return lang;
}

export function getMessagePlainText(message: Message): string {
  const content = (message?.content || {}) as any;
  return `${content.text || content.content || content.contentObj?.content || content.conversationDigest || ""}`.trim();
}

export function shouldSkipAutoTranslate(text: string, targetLang: string): boolean {
  const value = text.trim();
  if (!value || value.length > 1000) {
    return true;
  }
  if (!hasTranslatableText(value)) {
    return true;
  }
  const target = targetLang.toLowerCase();
  const hasCJK = /[\u3400-\u9fff]/.test(value);
  if (target.startsWith("zh") && hasCJK) {
    return true;
  }
  if (target.startsWith("en") && /^[\x00-\x7F\s]+$/.test(value)) {
    return true;
  }
  return false;
}

function hasTranslatableText(text: string): boolean {
  return /\p{L}/u.test(text);
}
