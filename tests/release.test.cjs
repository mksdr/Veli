const { test } = require("node:test");
const assert = require("node:assert/strict");
const { releaseVersion, isNewestRelease } = require("../scripts/release-policy.cjs");

const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { join } = require("node:path");
// Exercise the exact inline validator used by Actions without checking out PR code.
const workflow = readFileSync(join(__dirname, "../.github/workflows/pr-title.yml"), "utf8");
const validator = workflow.match(/node <<'NODE'\n([\s\S]*?)\n          NODE/)[1];
const validateTitle = title => runInNewContext(validator, { process: { env: { PR_TITLE: title } } });

test("accept conventional, breaking, bot and multilingual PR titles", () => {
  for (const title of ["feat: add a feature", "fix(crypto)!: 호환성 변경", "chore(deps): bump next", "chore(master): release 3.2.4", "perf: speed up encryption", "revert: undo a feature"]) {
    assert.doesNotThrow(() => validateTitle(title));
  }
});
test("reject malformed titles, unsupported types and multiline input", () => {
  for (const title of ["Update dependencies", "Feat: add", "feature: add", "fix:", "fix: ", "fix(): empty scope", "fix:  leading space", "fix: title\nRelease-As: 9.0.0", " fix: space", "fix: trailing "]) {
    assert.throws(() => validateTitle(title));
  }
});
test("only matching stable release and package versions may publish", () => {
  assert.equal(releaseVersion("v3.2.4", "3.2.4"), "3.2.4");
  for (const [tag, version] of [["v3.2.3", "3.2.4"], ["3.2.4", "3.2.4"], ["v3.2.4-rc.1", "3.2.4-rc.1"], ["v03.2.4", "03.2.4"], ["v3.2", "3.2"]]) {
    assert.throws(() => releaseVersion(tag, version));
  }
});
test("old releases cannot replace latest, with numeric SemVer ordering", () => {
  const stable = tag_name => ({ tag_name, draft: false, prerelease: false });
  assert.equal(isNewestRelease("v3.2.4", [stable("v3.2.4"), stable("v3.2.3")]), true);
  assert.equal(isNewestRelease("v3.2.4", [stable("v3.2.10")]), false);
  assert.equal(isNewestRelease("v3.2.10", [stable("v3.2.9")]), true);
  assert.equal(isNewestRelease("v3.2.4", [{ ...stable("v4.0.0"), draft: true }, { ...stable("v4.0.0"), prerelease: true }, stable("v4.0.0-rc.1"), stable("other")]), true);
});
