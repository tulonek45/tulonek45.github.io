const fs = require("node:fs/promises");
const path = require("node:path");

require('dotenv').config();

const snapshotPath = path.join(__dirname, "..", "src", "_data", "projects.json");

function isValidSnapshot(snapshot) {
  return (
    snapshot !== null &&
    typeof snapshot === "object" &&
    typeof snapshot.fetchedAt === "string" &&
    Array.isArray(snapshot.repositories)
  );
}

async function readSnapshot(filePath) {
  let contents;
  try {
    contents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  let snapshot;
  try {
    snapshot = JSON.parse(contents);
  } catch (error) {
    throw new Error(`The cached projects snapshot is not valid JSON: ${error.message}`);
  }

  return isValidSnapshot(snapshot) ? snapshot : null;
}

async function fetchRepositories(fetchImpl, username) {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
  url.search = new URLSearchParams({
    type: "owner",
    sort: "pushed",
    direction: "desc",
    per_page: "100"
  });

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tulonek45-personal-site"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}`);
  }

  const repositories = await response.json();
  if (!Array.isArray(repositories)) {
    throw new Error("GitHub API returned an unexpected repository list");
  }

  return repositories.map((repository) => ({
    name: repository.name,
    html_url: repository.html_url,
    description: repository.description,
    language: repository.language,
    pushed_at: repository.pushed_at
  }));
}

async function refreshProjects({
  fetchImpl = globalThis.fetch,
  filePath = snapshotPath,
  username = process.env.GITHUB_USERNAME
} = {}) {
  if (!username) {
    console.warn("GitHub username is not set in the environment variables");
  }

  try {
    const repositories = await fetchRepositories(fetchImpl, username);
    let cachedSnapshot;
    try {
      cachedSnapshot = await readSnapshot(filePath);
    } catch (error) {
      console.warn(`::warning::Replacing invalid GitHub projects snapshot. ${error.message}`);
    }

    if (
      cachedSnapshot &&
      JSON.stringify(cachedSnapshot.repositories) === JSON.stringify(repositories)
    ) {
      return { refreshed: true, changed: false, snapshot: cachedSnapshot };
    }

    const snapshot = {
      fetchedAt: new Date().toISOString(),
      repositories
    };
    await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);

    return { refreshed: true, changed: true, snapshot };
  } catch (refreshError) {
    let cachedSnapshot;
    try {
      cachedSnapshot = await readSnapshot(filePath);
    } catch (cacheError) {
      throw new Error(
        `Could not refresh projects from GitHub (${refreshError.message}); ` +
        `the cached snapshot is unavailable (${cacheError.message})`
      );
    }

    if (!cachedSnapshot) {
      throw new Error(
        `Could not refresh projects from GitHub (${refreshError.message}), ` +
        "and no valid last-known-good snapshot is available"
      );
    }

    console.warn(
      `::warning::Could not refresh GitHub projects; using the snapshot from ` +
      `${cachedSnapshot.fetchedAt}. ${refreshError.message}`
    );

    return { refreshed: false, changed: false, snapshot: cachedSnapshot };
  }
}

if (require.main === module) {
  refreshProjects()
    .then(({ refreshed, changed, snapshot }) => {
      const state = !refreshed
        ? "Keeping cached"
        : changed
          ? "Updated"
          : "Projects unchanged";
      console.log(`${state} ${snapshot.repositories.length} GitHub projects.`);
    })
    .catch((error) => {
      console.error(`Project refresh failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { refreshProjects };
