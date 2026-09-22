import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const READY_MARKER = ".autofuture-profile-ready";

type BrowserKind = "chrome" | "edge" | "brave" | "opera";

export interface PreparedBrowserProfile {
  browserName: string;
  userDataDir: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
  importedFromExisting: boolean;
  firstUse: boolean;
}

export interface BrowserProfileStatus {
  browserName: string;
  userDataDir: string;
  ready: boolean;
}

interface BrowserSource {
  kind: BrowserKind;
  browserName: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
}

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
  for (const line of output.split(/\r?\n/)) {
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

async function firstExisting(
  candidates: Array<string | undefined>
): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (candidate && (await exists(candidate))) return candidate;
  }

  return undefined;
}

async function detectDefaultBrowserExecutable(): Promise<{
  progId?: string;
  executablePath?: string;
}> {
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

    return {
      progId,
      executablePath: executableFromCommand(parseRegistryValue(commandOutput)),
    };
  } catch {
    return {};
  }
}

async function detectBrowserSource(): Promise<BrowserSource | null> {
  if (process.platform !== "win32") return null;

  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env["PROGRAMFILES(X86)"];

  if (!localAppData) return null;

  const detected = await detectDefaultBrowserExecutable();
  const detectedExe = detected.executablePath;
  const exeLower = detectedExe?.toLowerCase() ?? "";
  const progLower = detected.progId?.toLowerCase() ?? "";

  if (exeLower.includes("opera") || progLower.includes("opera")) {
    const isGx =
      exeLower.includes("opera gx") ||
      exeLower.includes("opera_gx") ||
      progLower.includes("operagx") ||
      progLower.includes("opera gx");

    const executablePath = await firstExisting([
      detectedExe,
      isGx
        ? path.join(localAppData, "Programs", "Opera GX", "opera.exe")
        : undefined,
      path.join(localAppData, "Programs", "Opera", "opera.exe"),
    ]);

    if (executablePath) {
      return {
        kind: "opera",
        browserName: isGx ? "Opera GX" : "Opera",
        executablePath,
      };
    }
  }

  if (exeLower.includes("brave") || progLower.includes("brave")) {
    const executablePath = await firstExisting([
      detectedExe,
      path.join(
        localAppData,
        "BraveSoftware",
        "Brave-Browser",
        "Application",
        "brave.exe"
      ),
      programFiles
        ? path.join(
            programFiles,
            "BraveSoftware",
            "Brave-Browser",
            "Application",
            "brave.exe"
          )
        : undefined,
    ]);

    if (executablePath) {
      return {
        kind: "brave",
        browserName: "Brave",
        executablePath,
      };
    }
  }

  if (exeLower.includes("msedge") || progLower.includes("msedge")) {
    const executablePath = await firstExisting([
      detectedExe,
      programFilesX86
        ? path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
      programFiles
        ? path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
    ]);

    return {
      kind: "edge",
      browserName: "Microsoft Edge",
      channel: "msedge",
      executablePath,
    };
  }

  if (exeLower.includes("chrome") || progLower.includes("chrome")) {
    const executablePath = await firstExisting([
      detectedExe,
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      programFiles
        ? path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe")
        : undefined,
      programFilesX86
        ? path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe")
        : undefined,
    ]);

    return {
      kind: "chrome",
      browserName: "Google Chrome",
      channel: "chrome",
      executablePath,
    };
  }

  return null;
}

async function resolveManagedProfile(
  managedRootDir: string
): Promise<{ source: BrowserSource; userDataDir: string; ready: boolean }> {
  const source = await detectBrowserSource();

  if (!source) {
    throw new Error(
      "O navegador padrao do Windows nao e um Chromium compativel ou nao foi localizado. " +
      "Por enquanto o Auto Future suporta Opera/Opera GX, Chrome, Edge e Brave."
    );
  }

  const userDataDir = path.join(managedRootDir, source.kind);
  await fs.mkdir(userDataDir, { recursive: true });

  return {
    source,
    userDataDir,
    ready: await exists(path.join(userDataDir, READY_MARKER)),
  };
}

export async function getBrowserProfileStatus(
  managedRootDir: string
): Promise<BrowserProfileStatus> {
  const { source, userDataDir, ready } = await resolveManagedProfile(managedRootDir);

  return {
    browserName: source.browserName,
    userDataDir,
    ready,
  };
}

export async function launchBrowserProfileSetup(
  managedRootDir: string
): Promise<BrowserProfileStatus> {
  const { source, userDataDir, ready } = await resolveManagedProfile(managedRootDir);

  if (!source.executablePath) {
    throw new Error(
      "Encontrei " + source.browserName +
      ", mas nao consegui localizar o executavel para abrir a configuracao da sessao."
    );
  }

  const child = spawn(
    source.executablePath,
    [
      "--user-data-dir=" + userDataDir,
      "--no-first-run",
      "--no-default-browser-check",
      "--new-window",
      "https://accounts.google.com/",
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }
  );

  child.unref();

  return {
    browserName: source.browserName,
    userDataDir,
    ready,
  };
}

export async function markBrowserProfileReady(
  managedRootDir: string
): Promise<BrowserProfileStatus> {
  const { source, userDataDir } = await resolveManagedProfile(managedRootDir);

  await fs.writeFile(
    path.join(userDataDir, READY_MARKER),
    new Date().toISOString(),
    "utf8"
  );

  return {
    browserName: source.browserName,
    userDataDir,
    ready: true,
  };
}

export async function prepareBrowserProfile(
  managedRootDir: string
): Promise<PreparedBrowserProfile> {
  const { source, userDataDir, ready } = await resolveManagedProfile(managedRootDir);

  return {
    browserName: source.browserName,
    userDataDir,
    channel: source.channel,
    executablePath: source.executablePath,
    importedFromExisting: false,
    firstUse: !ready,
  };
}
