import { uploadChecklistEvidence, uploadProfilePhoto, uploadStaffDocument } from "../mediaApi";
import { ENV } from "../../../config/environment";
import { setTokens, __resetTokenCoordinatorForTests } from "../../auth/tokenCoordinator";

/** Stand-in for React Native's XMLHttpRequest: records the request and lets
 * each test decide how the native layer finishes it. */
class FakeXhr {
  static last: FakeXhr | null = null;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  timeout = 0;
  status = 0;
  responseText = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  constructor() { FakeXhr.last = this; }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send(body: unknown) { this.body = body; }
  respond(status: number, json: unknown) { this.status = status; this.responseText = JSON.stringify(json); this.onload?.(); }
}

const originalXhr = global.XMLHttpRequest;
const originalFetch = global.fetch;
const originalFormData = global.FormData;

beforeEach(() => {
  __resetTokenCoordinatorForTests();
  setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
  FakeXhr.last = null;
  global.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  global.fetch = jest.fn();
  // The device's FormData is React Native's; Jest's default is Node's, which
  // would stringify the { uri } file part and hide what is really sent.
  global.FormData = require("react-native/Libraries/Network/FormData").default;
});

afterEach(() => {
  jest.restoreAllMocks();
  global.XMLHttpRequest = originalXhr;
  global.fetch = originalFetch;
  global.FormData = originalFormData;
});

const SUCCESS = { success: true, data: { id: "media-1" }, meta: { request_id: "r1", timestamp: "t", version: "1" } };

function sentParts() {
  return (FakeXhr.last!.body as { getParts(): Array<Record<string, unknown>> }).getParts();
}

describe("uploadChecklistEvidence", () => {
  it("posts the photo as a native file part over XMLHttpRequest, never the global fetch", async () => {
    // expo/fetch (the global fetch since SDK 56) throws on a { uri } part
    // before sending anything, which the app reported as "Check your
    // connection" -- so the upload must not go anywhere near fetch.
    const pending = uploadChecklistEvidence("job-1", "file:///cache/x.jpeg", "x.jpeg", "image/jpeg");
    FakeXhr.last!.respond(201, SUCCESS);

    expect(await pending).toEqual(expect.objectContaining({ ok: true, data: { id: "media-1" } }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(FakeXhr.last!.method).toBe("POST");
    expect(FakeXhr.last!.url).toBe(`${ENV.apiBaseUrl}/v1/media/upload`);
    expect(FakeXhr.last!.headers.Authorization).toBe("Bearer access-1");

    const [file, ...fields] = sentParts();
    expect(file).toEqual(expect.objectContaining({
      fieldName: "file", uri: "file:///cache/x.jpeg", name: "x.jpeg", type: "image/jpeg",
      headers: expect.objectContaining({ "content-type": "image/jpeg" }),
    }));
    expect(fields.map(p => [p.fieldName, p.string])).toEqual([
      ["media_context", "checklist_photo"], ["owner_type", "service_job"], ["owner_id", "job-1"],
    ]);
  });

  it("gives a multi-megabyte photo far longer than a JSON call to finish", async () => {
    void uploadChecklistEvidence("job-1", "file:///x.jpeg", "x.jpeg", "image/jpeg");
    expect(FakeXhr.last!.timeout).toBeGreaterThan(ENV.apiTimeoutMs);
  });

  it("passes the server's own reason through when it rejects the file", async () => {
    const pending = uploadChecklistEvidence("job-1", "file:///x.gif", "x.gif", "image/gif");
    FakeXhr.last!.respond(400, { type: "about:blank", title: "Bad Request", status: 400, detail: "MIME type 'image/gif' is not allowed.", error_code: "MEDIA_TYPE_NOT_ALLOWED" });

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.safeMessage).toBe("MIME type 'image/gif' is not allowed.");
      expect(result.error.backendCode).toBe("MEDIA_TYPE_NOT_ALLOWED");
    }
  });

  it("maps a transport failure to offline and a stalled upload to timeout", async () => {
    const offline = uploadChecklistEvidence("job-1", "file:///x.jpeg", "x.jpeg", "image/jpeg");
    FakeXhr.last!.onerror?.();
    expect(await offline).toEqual({ ok: false, error: expect.objectContaining({ code: "NETWORK_OFFLINE" }) });

    const stalled = uploadChecklistEvidence("job-1", "file:///x.jpeg", "x.jpeg", "image/jpeg");
    FakeXhr.last!.ontimeout?.();
    expect(await stalled).toEqual({ ok: false, error: expect.objectContaining({ code: "NETWORK_TIMEOUT" }) });
  });

  it("does not claim the network is down when the request could not even be built", async () => {
    jest.spyOn(FakeXhr.prototype, "send").mockImplementation(() => { throw new Error("boom"); });
    const result = await uploadChecklistEvidence("job-1", "file:///x.jpeg", "x.jpeg", "image/jpeg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).not.toBe("network");
  });

  it("asks the technician to sign in instead of sending an unauthenticated upload", async () => {
    __resetTokenCoordinatorForTests();
    const result = await uploadChecklistEvidence("job-1", "file:///x.jpeg", "x.jpeg", "image/jpeg");
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "AUTH_REQUIRED" }) });
    expect(FakeXhr.last).toBeNull();
  });
});

describe("the other uploads share the same transport", () => {
  it("uploadStaffDocument owns the file by the technician's user id", async () => {
    const pending = uploadStaffDocument("file:///licence.pdf", "licence.pdf", "application/pdf", "user-1");
    FakeXhr.last!.respond(201, SUCCESS);

    expect((await pending).ok).toBe(true);
    expect(sentParts().slice(1).map(p => [p.fieldName, p.string])).toEqual([
      ["media_context", "provider_document"], ["owner_type", "user"], ["owner_id", "user-1"],
    ]);
  });

  it("uploadProfilePhoto posts just the file to /v1/me/profile-photo", async () => {
    const pending = uploadProfilePhoto("file:///me.jpg", "me.jpg", "image/jpeg");
    FakeXhr.last!.respond(201, { ...SUCCESS, data: { id: "media-2", preview_url: "/v1/media/media-2/view" } });

    expect(await pending).toEqual(expect.objectContaining({ ok: true, data: { id: "media-2", preview_url: "/v1/media/media-2/view" } }));
    expect(FakeXhr.last!.url).toBe(`${ENV.apiBaseUrl}/v1/me/profile-photo`);
    expect(sentParts()).toEqual([expect.objectContaining({ fieldName: "file", uri: "file:///me.jpg" })]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
