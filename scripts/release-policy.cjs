const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function releaseVersion(tag, packageVersion) {
  if (!STABLE_VERSION.test(packageVersion) || tag !== `v${packageVersion}`) {
    throw new Error("Release tag must exactly match the stable package version: v" + packageVersion);
  }
  return packageVersion;
}

function isNewestRelease(tag, releases) {
  const version = tag.slice(1);
  releaseVersion(tag, version);
  const compare = (a, b) => {
    const left = a.split(".").map(BigInt);
    const right = b.split(".").map(BigInt);
    for (let i = 0; i < 3; i++) {
      if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
    }
    return 0;
  };
  return !releases.some(release => !release.draft && !release.prerelease &&
    release.tag_name.startsWith("v") && STABLE_VERSION.test(release.tag_name.slice(1)) &&
    compare(release.tag_name.slice(1), version) > 0);
}

module.exports = { releaseVersion, isNewestRelease };
