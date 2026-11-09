const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { refreshProjects } = require("../scripts/refresh-projects.cjs");

const tempDirectories = [];

async function createTempSnapshot() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "personal-site-"));
  tempDirectories.push(directory);
  return {
    filePath: path.join(directory, "projects.json")
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true })
    )
  );
  jest.restoreAllMocks();
});

test("refreshProjects stores the public repository response", async () => {
  const { filePath } = await createTempSnapshot();
  const repositories = [
    {
      name: "example",
      html_url: "https://github.com/tulonek45/example",
      description: "An example project",
      language: "JavaScript",
      pushed_at: "2026-01-01T00:00:00Z"
    }
  ];
  const result = await refreshProjects({
    filePath,
    username: "tulonek45",
    fetchImpl: async (url) => {
      expect(new URL(url).pathname).toBe("/users/tulonek45/repos");
      return { ok: true, json: async () => repositories };
    }
  });

  expect(result.refreshed).toBe(true);
  expect(result.changed).toBe(true);
  expect(result.snapshot.repositories).toEqual(repositories);
  expect(JSON.parse(await fs.readFile(filePath, "utf8"))).toEqual(result.snapshot);

  const unchangedResult = await refreshProjects({
    filePath,
    username: "tulonek45",
    fetchImpl: async () => ({ ok: true, json: async () => repositories })
  });
  expect(unchangedResult.refreshed).toBe(true);
  expect(unchangedResult.changed).toBe(false);
  expect(unchangedResult.snapshot.fetchedAt).toBe(result.snapshot.fetchedAt);
});

test("refreshProjects uses the last successful snapshot when GitHub is unavailable", async () => {
  const { filePath } = await createTempSnapshot();
  const cachedSnapshot = {
    fetchedAt: "2026-01-01T00:00:00.000Z",
    repositories: []
  };
  await fs.writeFile(filePath, JSON.stringify(cachedSnapshot));
  jest.spyOn(console, "warn").mockImplementation(() => { });

  const result = await refreshProjects({
    filePath,
    fetchImpl: async () => ({ ok: false, status: 503 })
  });

  expect(result.refreshed).toBe(false);
  expect(result.snapshot).toEqual(cachedSnapshot);
  expect(JSON.parse(await fs.readFile(filePath, "utf8"))).toEqual(cachedSnapshot);
});

test("refreshProjects fails when neither GitHub nor a valid snapshot is available", async () => {
  const { filePath } = await createTempSnapshot();

  await expect(
    refreshProjects({
      filePath,
      fetchImpl: async () => ({ ok: false, status: 503 })
    })
  ).rejects.toThrow(/no valid last-known-good snapshot is available/);
});
