import { describe, expect, it } from "vitest";
import { pushState, vapidKeyBytes, type PushDevice } from "@/lib/push-client";

const device: PushDevice = { supported: true, ios: false, standalone: false, permission: "default", subscribed: false };

describe("pushState", () => {
  it("is unconfigured without server keys, whatever the device", () => {
    expect(pushState(false, { ...device, permission: "granted", subscribed: true })).toBe("unconfigured");
  });
  it("asks an iPhone in a browser tab to install the app first", () => {
    expect(pushState(true, { ...device, ios: true, supported: false })).toBe("needs-install");
    expect(pushState(true, { ...device, ios: true, standalone: true })).toBe("off");
  });
  it("tells unsupported and blocked apart from off", () => {
    expect(pushState(true, { ...device, supported: false })).toBe("unsupported");
    expect(pushState(true, { ...device, permission: "denied", subscribed: true })).toBe("blocked");
    expect(pushState(true, device)).toBe("off");
  });
  it("is on only with permission and a subscription", () => {
    expect(pushState(true, { ...device, permission: "granted", subscribed: true })).toBe("on");
    expect(pushState(true, { ...device, permission: "granted" })).toBe("off");
    expect(pushState(true, { ...device, subscribed: true })).toBe("off");
  });
});

describe("vapidKeyBytes", () => {
  it("decodes URL-safe base64 without padding", () => {
    expect([...vapidKeyBytes("AQID")]).toEqual([1, 2, 3]);
    expect([...vapidKeyBytes("-_8")]).toEqual([251, 255]);
  });
});
