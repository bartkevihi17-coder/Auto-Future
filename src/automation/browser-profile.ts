import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type BrowserKind = "chrome" | "edge" | "brave" | "opera";

export interface PreparedBrowserProfile {
  browserName: string;
  userDataDir: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
  importedFromExisting: boolean;
  firstUse: boolean;
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
  if (!localAppData) return null;

  const detected = await detectDefaultBrowserExecutable();
  const executablePath = detected.executablePath;
  const exeLower = executablePath?.toLowerCase() ?? "";
  const progLower = detected.progId?.toLowerCase() ?? "";

  if (exeLower.includes("opera") || progLower.includes("opera")) {
    const isGx =
      exeLower.includes("opera gx") ||
      exeLower.includes("opera_gx") ||
      progLower.includes("operagx") ||
      progLower.includes("opera gx");

    const resolvedExe = await firstExisting([
      executablePath,
      isGx
        ? path.join(localAppData, "Programs", "Opera GX", "opera.exe")
        : undefined,
      path.join(localAppData, "Programs", "Opera", "opera.exe"),
    ]);

    if (resolvedExe) {
      return {
        kind: "opera",
        browserName: isGx ? "Opera GX" : "Opera",
        executablePath: resolvedExe,
      };
    }
  }

  if (exeLower.includes("brave") || progLower.includes("brave")) {
    const resolvedExe = await firstExisting([
      executablePath,
      path.join(
        localAppData,
        "BraveSoftware",
        "Brave-Browser",
        "Application",
        "brave.exe"
      ),
    ]);

    if (resolvedExe) {
      return {
        kind: "brave",
        browserName: "Brave",
        executablePath: resolvedExe,
      };
    }
  }

  if (exeLower.includes("msedge") || progLower.includes("msedge")) {
    return {
      kind: "edge",
      browserName: "Microsoft Edge",
      channel: "msedge",
    };
  }

  if (exeLower.includes("chrome") || progLower.includes("chrome")) {
    return {
      kind: "chrome",
      browserName: "Google Chrome",
      channel: "chrome",
    };
  }

  return null;
}

export async function prepareBrowserProfile(
  managedRootDir: string
): Promise<PreparedBrowserProfile> {
  const source = await detectBrowserSource();

  if (!source) {
    throw new Error(
      "O navegador padrao do Windows nao e um Chromium compativel ou nao foi localizado. " +
      "Por enquanto o Auto Future suporta Opera/Opera GX, Chrome, Edge e Brave."
    );
  }

  const managedUserDataDir = path.join(managedRootDir, source.kind);
  const firstUse = !(await exists(path.join(managedUserDataDir, "Local State")));

  await fs.mkdir(managedUserDataDir, { recursive: true });

  return {
    browserName: source.browserName,
    userDataDir: managedUserDataDir,
    channel: source.channel,
    executablePath: source.executablePath,
    importedFromExisting: false,
    firstUse,
  };
}
