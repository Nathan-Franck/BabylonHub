export namespace ObjUtil {
  // Strongly typed Object.fromEntries implementation
  export function entries<T>(obj: T) {
    return Object.entries(obj as any) as any as Array<readonly [keyof T, T[keyof T]]>;
  }
  export function fromEntries<K extends string | number | symbol, V>(entries: Array<readonly [K, V]>) {
    return Object.fromEntries(entries) as {
      [key in K]: V;
    };
  }
  export function mapValues<T, U>(obj: T, fn: (entry: { key: keyof T; value: T[keyof T]; }) => U): {
    [key in keyof T]: U;
  } {
    return fromEntries(entries(obj).map(([key, value]) => <const>[key, fn({ key, value })]));
  }
}
