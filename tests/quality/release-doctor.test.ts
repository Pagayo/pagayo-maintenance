import { execFileSync, spawnSync } from "child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = "/Users/sjoerdoverdiep/my-vscode-workspace";
const SCRIPT = join(
  WORKSPACE_ROOT,
  "pagayo-maintenance/.github/scripts/release-doctor.sh",
);

type DoctorPayload = {
  repo: string;
  branch: string;
  status: "ok" | "warning" | "blocked";
  recommendedPhase: string;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
  design: {
    status: string;
    localVersion: string;
    storefrontLockVersion: string;
    assetVersion: string;
  };
  git: {
    dirtyTrackedFiles: number;
  };
};

function makeTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "release-doctor-"));
}

function runGit(repoPath: string, args: string[]) {
  execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf-8",
    stdio: "pipe",
  });
}

function initRepo(workspace: string, repoName: string): string {
  const repoPath = join(workspace, repoName);
  mkdirSync(repoPath, { recursive: true });
  runGit(repoPath, ["init", "-b", branchName()]);
  runGit(repoPath, ["config", "user.email", "release-doctor@example.test"]);
  runGit(repoPath, ["config", "user.name", "Release Doctor Test"]);
  writeFileSync(join(repoPath, "README.md"), `# ${repoName}\n`);
  runGit(repoPath, ["add", "README.md"]);
  runGit(repoPath, ["commit", "-m", "test: initial"]);
  return repoPath;
}

function branchName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `feature/batch-staging-${yyyy}${mm}${dd}`;
}

function runDoctor(
  repoPath: string,
  options: { workspace?: string; phase?: string; path?: string } = {},
) {
  const args = [repoPath];
  if (options.phase) {
    args.push("--phase", options.phase);
  }

  const result = spawnSync(SCRIPT, args, {
    cwd: options.workspace ?? WORKSPACE_ROOT,
    encoding: "utf-8",
    env: {
      ...process.env,
      PAGAYO_WORKSPACE_ROOT: options.workspace ?? WORKSPACE_ROOT,
      PATH: options.path ?? process.env.PATH ?? "",
    },
  });

  const marker = "\nJSON:\n";
  const markerIndex = result.stdout.indexOf(marker);
  const payload =
    markerIndex >= 0
      ? (JSON.parse(result.stdout.slice(markerIndex + marker.length)) as DoctorPayload)
      : null;

  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    payload,
  };
}

describe("release-doctor.sh", () => {
  it("rapporteert een schone repo als ok", () => {
    const workspace = makeTempWorkspace();
    const repoPath = initRepo(workspace, "pagayo-maintenance");

    const result = runDoctor(repoPath, { workspace });

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(result.payload?.status).toBe("ok");
    expect(result.payload?.repo).toBe("pagayo-maintenance");
    expect(result.payload?.git.dirtyTrackedFiles).toBe(0);
  });

  it("rapporteert dirty tracked files als waarschuwing in auto/00 context", () => {
    const workspace = makeTempWorkspace();
    const repoPath = initRepo(workspace, "pagayo-maintenance");
    writeFileSync(join(repoPath, "README.md"), "# changed\n");

    const result = runDoctor(repoPath, { workspace });

    expect(result.code).toBe(1);
    expect(result.payload?.status).toBe("warning");
    expect(result.payload?.recommendedPhase).toBe("00");
    expect(result.payload?.warnings.join("\n")).toContain(
      "Tracked uncommitted changes",
    );
  });

  it("blokkeert dirty tracked files in pushfase", () => {
    const workspace = makeTempWorkspace();
    const repoPath = initRepo(workspace, "pagayo-maintenance");
    writeFileSync(join(repoPath, "README.md"), "# changed\n");

    const result = runDoctor(repoPath, { workspace, phase: "01" });

    expect(result.code).toBe(2);
    expect(result.payload?.status).toBe("blocked");
    expect(result.payload?.blockers.join("\n")).toContain(
      "Tracked uncommitted changes",
    );
  });

  it("blokkeert storefront design drift met duidelijke next action", () => {
    const workspace = makeTempWorkspace();
    const storefront = initRepo(workspace, "pagayo-storefront");
    const design = initRepo(workspace, "pagayo-design");

    writeFileSync(
      join(design, "package.json"),
      JSON.stringify({ name: "@pagayo/design", version: "2.0.0" }, null, 2),
    );
    mkdirSync(join(storefront, "src/workers/generated"), { recursive: true });
    writeFileSync(
      join(storefront, "package-lock.json"),
      JSON.stringify(
        {
          packages: {
            "node_modules/@pagayo/design": {
              version: "1.0.0",
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(storefront, "src/workers/generated/design-asset-version.ts"),
      'export const DESIGN_ASSET_VERSION = "1.0.0";\n',
    );

    const result = runDoctor(storefront, { workspace });

    expect(result.code).toBe(2);
    expect(result.payload?.status).toBe("blocked");
    expect(result.payload?.design.status).toBe("blocked");
    expect(result.payload?.design.localVersion).toBe("2.0.0");
    expect(result.payload?.design.storefrontLockVersion).toBe("1.0.0");
    expect(result.payload?.blockers.join("\n")).toContain("@pagayo/design drift");
    expect(result.payload?.nextActions.join("\n")).toContain("@pagayo/design");
  });

  it("blokkeert non-git directories met structured JSON", () => {
    const workspace = makeTempWorkspace();
    const path = join(workspace, "geen-repo");
    mkdirSync(path);

    const result = runDoctor(path, { workspace });

    expect(result.code).toBe(2);
    expect(result.payload?.status).toBe("blocked");
    expect(result.payload?.repo).toBe("geen-repo");
    expect(result.payload?.blockers.join("\n")).toContain("Geen git-repository");
  });

  it("blokkeert ontbrekende gh alleen wanneer CI verplicht is", () => {
    const workspace = makeTempWorkspace();
    const repoPath = initRepo(workspace, "pagayo-storefront");
    const fakeBin = join(workspace, "bin");
    mkdirSync(fakeBin);
    writeFileSync(
      join(fakeBin, "node"),
      `#!/usr/bin/env bash\nexec ${JSON.stringify(process.execPath)} "$@"\n`,
    );
    chmodSync(join(fakeBin, "node"), 0o755);

    const result = runDoctor(repoPath, {
      workspace,
      phase: "02",
      path: `${fakeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
    });

    expect(result.code).toBe(2);
    expect(result.payload?.status).toBe("blocked");
    expect(result.payload?.ci.status).toBe("gh_missing");
    expect(result.payload?.blockers.join("\n")).toContain("gh CLI ontbreekt");
  });

  it("schrijft dezelfde JSON naar --json-out", () => {
    const workspace = makeTempWorkspace();
    const repoPath = initRepo(workspace, "pagayo-maintenance");
    const jsonOut = join(workspace, "doctor.json");

    const result = spawnSync(SCRIPT, [repoPath, "--json-out", jsonOut], {
      cwd: workspace,
      encoding: "utf-8",
      env: {
        ...process.env,
        PAGAYO_WORKSPACE_ROOT: workspace,
      },
    });

    const marker = "\nJSON:\n";
    const stdoutPayload = JSON.parse(
      result.stdout.slice(result.stdout.indexOf(marker) + marker.length),
    ) as DoctorPayload;
    const filePayload = JSON.parse(readFileSync(jsonOut, "utf-8")) as DoctorPayload;

    expect(result.status).toBe(0);
    expect(filePayload).toEqual(stdoutPayload);
  });
});
