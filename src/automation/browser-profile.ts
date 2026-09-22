import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type BrowserKind = "chrome" | "edge" | "brave" | "opera" | "managed";

export interface PreparedBrowserProfile {
  browserName: string;
  userDataDir: string;
  profileDirectory?: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
  importedFromExisting: boolean;
}

interface BrowserSource {
  kind: BrowserKind;
  browserName: string;
  userDataDir: string;
  profileDirectory?: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
}

interface ProfileManifest {
  version: 1;
  browserName: string;
  kind: BrowserKind;
  profileDirectory?: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
  importedAt: string;
}

const PROFILE_MANIFEST = ".autofuture-profile.json";

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function queryRegistry(args: string[]): Promise<string> {
  const result = await execFileAsync("reg.exe", args, {
    windowsHide: true,
    encoding: "utf8",
  });

  return String(result.stdout || "");
}

function parseRegistryValue(output: string, valueName?: string): string | null {
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    if (!line.includes("REG_")) continue;
    if (valueName && !line.toLowerCase().includes(valueName.toLowerCase())) continue;

    const match = line.match(/REG_\w+\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function executableFromCommand(command: string | null): string | undefined {
  if (!command) return undefined;

  const quoted = command.match(/^\s*"([^"]+\.exe)"/i);
  if (quoted?.[1]) return quoted[1];

  const plain = command.match(/^\s*([^\s]+\.exe)/i);
  return plain?.[1];
}

async function detectDefaultBrowserExecutable(): Promise<{ progId?: string; executablePath?: string }> {
  if (process.platform !== "win32") return {};

  try {
    const userChoice = await queryRegistry([
      "query",
      "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
      "/v",
      "ProgId",
    ]);

    const progId = parseRegistryValue(userChoice, "ProgId") ?? undefined;
    if (!progId) return {};

    const commandOutput = await queryRegistry([
      "query",
      "HKCR\\" + progId + "\\shell\\open\\command",
      "/ve",
    ]);

    const command = parseRegistryValue(commandOutput);
    return {
      progId,
      executablePath: executableFromCommand(command),
    };
  } catch {
    return {};
  }
}

async function lastUsedChromiumProfile(userDataDir: string): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(userDataDir, "Local State"), "utf8");
    const state = JSON.parse(raw) as {
      profile?: {
        last_used?: string;
        last_active_profiles?: string[];
      };
    };

    return (
      state.profile?.last_used ||
      state.profile?.last_active_profiles?.[0] ||
      "Default"
    );
  } catch {
    return "Default";
  }
}

async function firstExisting(candidates: Array<string | undefined>): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (candidate && (await exists(candidate))) return candidate;
  }
  return undefined;
}

async function detectBrowserSource(): Promise<BrowserSource | null> {
  if (process.platform !== "win32") return null;

  const localAppData = process.env.LOCALAPPDATA;
  const appData = process.env.APPDATA;

  if (!localAppData || !appData) return null;

  const detected = await detectDefaultBrowserExecutable();
  const exeLower = detected.executablePath?.toLowerCase() ?? "";
  const progLower = detected.progId?.toLowerCase() ?? "";

  const isOpera = exeLower.includes("opera") || progLower.includes("opera");
  if (isOpera) {
    const isGx = exeLower.includes("opera gx") || progLower.includes("operagx") || progLower.includes("opera gx");
    const sourceDir = isGx
      ? path.join(appData, "Opera Software", "Opera GX Stable")
      : path.join(appData, "Opera Software", "Opera Stable");

    const executablePath = await firstExisting([
      detected.executablePath,
      isGx ? path.join(localAppData, "Programs", "Opera GX", "opera.exe") : undefined,
      path.join(localAppData, "Programs", "Opera", "opera.exe"),
    ]);

    if (await exists(sourceDir)) {
      return {
        kind: "opera",
        browserName: isGx ? "Opera GX" : "Opera",
        userDataDir: sourceDir,
        executablePath,
      };
    }
  }

  const isBrave = exeLower.includes("brave") || progLower.includes("brave");
  if (isBrave) {
    const userDataDir = path.join(localAppData, "BraveSoftware", "Brave-Browser", "User Data");
    if (await exists(userDataDir)) {
      return {
        kind: "brave",
        browserName: "Brave",
        userDataDir,
        profileDirectory: await lastUsedChromiumProfile(userDataDir),
        executablePath: await firstExisting([
          detected.executablePath,
          path.join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        ]),
      };
    }
  }

  const isEdge = exeLower.includes("msedge") || progLower.includes("msedge");
  if (isEdge) {
    const userDataDir = path.join(localAppData, "Microsoft", "Edge", "User Data");
    if (await exists(userDataDir)) {
      return {
        kind: "edge",
        browserName: "Microsoft Edge",
        userDataDir,
        profileDirectory: await lastUsedChromiumProfile(userDataDir),
        channel: "msedge",
      };
    }
  }

  const isChrome = exeLower.includes("chrome") || progLower.includes("chrome");
  if (isChrome) {
    const userDataDir = path.join(localAppData, "Google", "Chrome", "User Data");
    if (await exists(userDataDir)) {
      return {
        kind: "chrome",
        browserName: "Google Chrome",
        userDataDir,
        profileDirectory: await lastUsedChromiumProfile(userDataDir),
        channel: "chrome",
      };
    }
  }

  // Fallback order for Chromium-based browsers if Windows does not expose
  // the default browser registry entry in the expected shape.
  const fallbacks: Array<() => Promise<BrowserSource | null>> = [
    async () => {
      const dir = path.join(appData, "Opera Software", "Opera GX Stable");
      if (!(await exists(dir))) return null;
      return {
        kind: "opera",
        browserName: "Opera GX",
        userDataDir: dir,
        executablePath: await firstExisting([
          path.join(localAppData, "Programs", "Opera GX", "opera.exe"),
        ]),
      };
    },
    async () => {
      const dir = path.join(localAppData, "Google", "Chrome", "User Data");
      if (!(await exists(dir))) return null;
      return {
        kind: "chrome",
        browserName: "Google Chrome",
        userDataDir: dir,
        profileDirectory: await lastUsedChromiumProfile(dir),
        channel: "chrome",
      };
    },
    async () => {
      const dir = path.join(localAppData, "Microsoft", "Edge", "User Data");
      if (!(await exists(dir))) return null;
      return {
        kind: "edge",
        browserName: "Microsoft Edge",
        userDataDir: dir,
        profileDirectory: await lastUsedChromiumProfile(dir),
        channel: "msedge",
      };
    },
  ];

  for (const fallback of fallbacks) {
    const source = await fallback();
    if (source) return source;
  }

  return null;
}

async function copyEntry(source: string, destination: string): Promise<boolean> {
  if (!(await exists(source))) return false;

  const stat = await fs.stat(source);
  await fs.mkdir(path.dirname(destination), { recursive: true });

  if (stat.isDirectory()) {
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(source, destination, {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
  } else {
    await fs.copyFile(source, destination);
  }

  return true;
}

async function importProfile(source: BrowserSource, destinationRoot: string): Promise<void> {
  await fs.mkdir(destinationRoot, { recursive: true });

  const sourceProfileRoot = source.profileDirectory
    ? path.join(source.userDataDir, source.profileDirectory)
    : source.userDataDir;

  const destinationProfileRoot = source.profileDirectory
    ? path.join(destinationRoot, source.profileDirectory)
    : destinationRoot;

  await fs.mkdir(destinationProfileRoot, { recursive: true });

  // "Local State" carries Chromium's encrypted-key metadata and must travel
  // with cookies/session storage when available.
  await copyEntry(
    path.join(source.userDataDir, "Local State"),
    path.join(destinationRoot, "Local State")
  ).catch(() => false);

  const profileEntries = [
    "Preferences",
    "Secure Preferences",
    "Network/Cookies",
    "Network/Cookies-journal",
    "Network/Network Persistent State",
    "Cookies",
    "Cookies-journal",
    "Local Storage",
    "Session Storage",
    "IndexedDB",
    "Storage",
    "Sync Data",
  ];

  let copiedSessionData = false;

  for (const entry of profileEntries) {
    const copied = await copyEntry(
      path.join(sourceProfileRoot, entry),
      path.join(destinationProfileRoot, entry)
    ).catch((error: NodeJS.ErrnoException) => {
      if (entry === "Network/Cookies" || entry === "Cookies") {
        throw new Error(
          "Nao consegui copiar a sessao do navegador. Feche o navegador padrao e tente gravar novamente. " +
          (error.message || "")
        );
      }

      return false;
    });

    if (entry === "Network/Cookies" || entry === "Cookies") {
      copiedSessionData = copiedSessionData || copied;
    }
  }

  if (!copiedSessionData) {
    // Some Chromium variants keep cookies elsewhere. We still continue with
    // storage/preferences because the user may already be authenticated by
    // local storage, but the modal warns that a login/CAPTCHA can still occur.
  }
}

async function readManifest(destinationRoot: string): Promise<ProfileManifest | null> {
  try {
    const raw = await fs.readFile(path.join(destinationRoot, PROFILE_MANIFEST), "utf8");
    return JSON.parse(raw) as ProfileManifest;
  } catch {
    return null;
  }
}

export async function prepareBrowserProfile(destinationRoot: string): Promise<PreparedBrowserProfile> {
  const existing = await readManifest(destinationRoot);

  if (existing) {
    return {
      browserName: existing.browserName,
      userDataDir: destinationRoot,
      profileDirectory: existing.profileDirectory,
      channel: existing.channel,
      executablePath: existing.executablePath,
      importedFromExisting: true,
    };
  }

  const source = await detectBrowserSource();

  if (!source) {
    await fs.mkdir(destinationRoot, { recursive: true });

    const manifest: ProfileManifest = {
      version: 1,
      browserName: "Chromium do Auto Future",
      kind: "managed",
      importedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(destinationRoot, PROFILE_MANIFEST),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    return {
      browserName: manifest.browserName,
      userDataDir: destinationRoot,
      importedFromExisting: false,
    };
  }

  await importProfile(source, destinationRoot);

  const manifest: ProfileManifest = {
    version: 1,
    browserName: source.browserName,
    kind: source.kind,
    profileDirectory: source.profileDirectory,
    channel: source.channel,
    executablePath: source.executablePath,
    importedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(destinationRoot, PROFILE_MANIFEST),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  return {
    browserName: source.browserName,
    userDataDir: destinationRoot,
    profileDirectory: source.profileDirectory,
    channel: source.channel,
    executablePath: source.executablePath,
    importedFromExisting: true,
  };
}
