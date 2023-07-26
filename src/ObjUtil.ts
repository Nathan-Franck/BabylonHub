import { Invert } from "ts-toolbelt/out/Object/Invert";

export namespace ObjUtil {
  export function mapValues<T extends EntryObject, U>(obj: T, fn: (entry: { key: keyof T; value: T[keyof T]; }) => U): {
    [key in keyof T]: U;
  } {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => <const>[key, fn({ key, value })]));
  }
  export function randomKey<T extends {}>(obj: T): keyof T {
    const keys = Object.keys(obj);
    return keys[Math.floor(Math.random() * keys.length)] as keyof T;
  }
  export function filterByPrefix<T extends Record<string, any>, Prefix extends string>(obj: T, prefix: Prefix) {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => (key as string).startsWith(prefix))) as any as {
      [key in keyof T as key extends `${Prefix}${string}` ? key : never]: T[key];
    };
  }
  export function invert<T extends Record<string, string>>(obj: T) {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => <const>[value, key])) as Invert<T>;
  }
  export function singleKeyObject<K extends string | number | symbol, V>(key: K, value: V) {
    return Object.fromEntries([[key, value]]);
  }
}
