/**
 * Does this request come from a phone? Read from the client hint when the browser sends it
 * (`Sec-CH-UA-Mobile: ?1`), otherwise from the user agent. Tablets count as desktop: they are
 * wide enough for the sidebar layout.
 */
export function isPhoneRequest(headers: { get(name: string): string | null }): boolean {
  const hint = headers.get("sec-ch-ua-mobile");
  if (hint === "?1") return true;
  if (hint === "?0") return false;
  const ua = headers.get("user-agent") ?? "";
  if (/iPad|Tablet/i.test(ua)) return false;
  return /iPhone|iPod|Android.+Mobile|Mobile.+Firefox|Windows Phone/i.test(ua);
}
