import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type BrowserKind = "chrome" | "edge" | "brave" | "opera";

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

async function firstExisting(
  candidates: Array<string | undefined>
): Promise<string | undefined> {
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
  const executablePath = detected.executablePath;
  const exeLower = executablePath?.toLowerCase() ?? "";
  const progLower = detected.progId?.toLowerCase() ?? "";

  const opera =
    exeLower.includes("opera") ||
    progLower.includes("opera");

  if (opera) {
    const isGx =
      exeLower.includes("opera gx") ||
      exeLower.includes("opera_gx") ||
      progLower.includes("operagx") ||
      progLower.includes("opera gx");

    const userDataDir = isGx
      ? path.join(appData, "Opera Software", "Opera GX Stable")
      : path.join(appData, "Opera Software", "Opera Stable");

    if (await exists(userDataDir)) {
      return {
        kind: "opera",
        browserName: isGx ? "Opera GX" : "Opera",
        userDataDir,
        executablePath: await firstExisting([
          executablePath,
          isGx
            ? path.join(localAppData, "Programs", "Opera GX", "opera.exe")
            : undefined,
          path.join(localAppData, "Programs", "Opera", "opera.exe"),
        ]),
      };
    }
  }

  const brave =
    exeLower.includes("brave") ||
    progLower.includes("brave");

  if (brave) {
    const userDataDir = path.join(
      localAppData,
      "BraveSoftware",
      "Brave-Browser",
      "User Data"
    );

    if (await exists(userDataDir)) {
      return {
        kind: "brave",
        browserName: "Brave",
        userDataDir,
        profileDirectory: await lastUsedChromiumProfile(userDataDir),
        executablePath: await firstExisting([
          executablePath,
          path.join(
            localAppData,
            "BraveSoftware",
            "Brave-Browser",
            "Application",
            "brave.exe"
          ),
        ]),
      };
    }
  }

  const edge =
    exeLower.includes("msedge") ||
    progLower.includes("msedge");

  if (edge) {
    const userDataDir = path.join(
      localAppData,
      "Microsoft",
      "Edge",
      "User Data"
    );

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

  const chrome =
    exeLower.includes("chrome") ||
    progLower.includes("chrome");

  if (chrome) {
    const userDataDir = path.join(
      localAppData,
      "Google",
      "Chrome",
      "User Data"
    );

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

  return null;
}

export async function prepareBrowserProfile(
  _managedFallbackDir: string
): Promise<PreparedBrowserProfile> {
  const source = await detectBrowserSource();

  if (!source) {
    throw new Error(
      "O navegador padrao do Windows nao e um navegador Chromium compativel ou nao foi localizado. " +
      "Por enquanto o Auto Future suporta o perfil real do Opera/Opera GX, Chrome, Edge e Brave."
    );
  }

  if (!source.executablePath && !source.channel) {
    throw new Error(
      "Encontrei o perfil do navegador padrao, mas nao consegui localizar o executavel dele."
    );
  }

  return {
    browserName: source.browserName,
    userDataDir: source.userDataDir,
    profileDirectory: source.profileDirectory,
    channel: source.channel,
    executablePath: source.executablePath,
    importedFromExisting: true,
  };
}
