export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// The database reads an id in any letter case, so compare ids the same way (a changed form field
// in capitals must not get past "not yourself").
export function sameId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
