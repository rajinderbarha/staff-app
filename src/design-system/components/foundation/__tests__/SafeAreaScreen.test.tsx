import fs from "fs";
import path from "path";

/**
 * `SafeAreaScreen` is a full-flex screen container: it sets `flex: 1` and then
 * spreads the caller's `style` over the top, so a caller passing `flex: 0`
 * silently wins.
 *
 * In React Native `flex: 0` is not "no opinion" -- it means
 * `flexGrow: 0, flexShrink: 0, flexBasis: auto`, so the container sizes to its
 * content instead of filling the screen. Every job-execution screen is built as
 * header + `<ScrollView style={{ flex: 1 }}>` + footer, and a `flex: 1`
 * ScrollView inside an auto-height parent resolves to `flexBasis: 0` with no
 * free space to grow into: **height zero**.
 *
 * The failure is invisible in every way that normally catches a bug. Nothing
 * throws, nothing logs, the screen still renders, and the header and footer
 * still draw at their intrinsic heights -- so a technician sees a title bar and
 * working buttons with a blank void between them. All six job-execution screens
 * shipped this way, which is why the Inspection screen showed
 * "Complete inspection (10 left)" above an empty page: the ten checklist items
 * were in the payload and laid out in a box zero pixels tall.
 *
 * Layout is not exercised by the test renderer, so this reads the source. It is
 * a lint rule in test form, and worth it for a mistake that costs a whole
 * screen and announces nothing.
 */
const SCREENS_DIR = path.join(__dirname, "..", "..", "..", "..", "screens");

function screenFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : screenFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

describe("SafeAreaScreen callers", () => {
  it("never overrides the screen container's flex, which would collapse its scroll body", () => {
    const offenders: string[] = [];
    for (const file of screenFiles(SCREENS_DIR)) {
      const source = fs.readFileSync(file, "utf8");
      // Only the opening tag matters; `flex: 0` anywhere inside the screen body
      // is a normal, deliberate thing to write.
      for (const tag of source.match(/<SafeAreaScreen[^>]*>/g) ?? []) {
        if (/flex:\s*0/.test(tag)) {
          offenders.push(`${path.relative(SCREENS_DIR, file)}: ${tag.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
