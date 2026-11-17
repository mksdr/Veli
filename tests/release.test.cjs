const { test } = require("node:test");
const assert = require("node:assert/strict");
const { releaseVersion, isNewestRelease, normalizeChangelog } = require("../scripts/release-policy.cjs");

const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { join } = require("node:path");
const { createRequire } = require("node:module");
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

test("release changelog headings omit dates and retain notes", () => {
  const original = "# Changelog\n\n## [3.2.4](https://github.com/mksdr/Veli/compare/v3.2.3...v3.2.4) (2026-11-17)\n\n### Bug Fixes\n\n- Keep the 2016/07/18 reference and v2 file format.\n\n## v3.2.3\n\n## v3.0.0\n";
  const expected = original.replace(original.split("\n")[2], "## v3.2.4");
  assert.equal(normalizeChangelog(original), expected);
  assert.equal(normalizeChangelog(expected), expected);
  assert.equal(normalizeChangelog("### 3.3.0 (2026-11-17)\n"), "## v3.3.0\n");
  assert.equal(normalizeChangelog("## v4.0.0 (2026-11-17)\n"), "## v4.0.0\n");
});

test("release workflow formats its own PR and leaves unchanged files alone", async () => {
  const releaseWorkflow = readFileSync(join(__dirname, "../.github/workflows/release.yml"), "utf8");
  const script = releaseWorkflow.match(/          script: \|\n([\s\S]*?)\n\n  containers:/)[1];
  const pending = "## [3.2.4](https://example.com/compare) (2026-11-17)\n\n- A fix.\n";
  const formatted = normalizeChangelog(pending);
  const writes = [];
  let content = pending;
  const pr = {
    state: "open", base: { ref: "master" },
    head: { ref: "release-please--branches--master", sha: "release-sha", repo: { full_name: "mksdr/Veli" } }
  };
  const github = { rest: {
    pulls: { get: async () => ({ data: pr }) },
    repos: {
      getContent: async request => {
        assert.equal(request.ref, "release-sha");
        assert.equal(request.path, "CHANGELOG.md");
        return { data: { type: "file", encoding: "base64", sha: "blob-sha", content: Buffer.from(content).toString("base64") } };
      },
      createOrUpdateFileContents: async request => { writes.push(request); }
    }
  } };
  const run = () => runInNewContext(`(async () => {${script}\n})()`, {
    require: createRequire(join(__dirname, "../package.json")), Buffer, github,
    context: { repo: { owner: "mksdr", repo: "Veli" } },
    process: { env: { RELEASE_PR: JSON.stringify({ number: 123 }) } }
  });
  await run();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].branch, pr.head.ref);
  assert.equal(writes[0].sha, "blob-sha");
  assert.equal(Buffer.from(writes[0].content, "base64").toString("utf8"), formatted);
  content = formatted;
  await run();
  assert.equal(writes.length, 1);
  pr.head.repo.full_name = "someone/Veli";
  await assert.rejects(run, /Expected an open release PR/);
  assert.equal(writes.length, 1);
});
