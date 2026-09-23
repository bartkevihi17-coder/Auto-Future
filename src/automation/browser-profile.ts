import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const READY_MARKER = ".autofuture-profile-ready";
const GOOGLE_AUTH_COOKIE_MARKERS = [
  "__Secure-1PSID",
  "__Secure-3PSID",
  "SAPISID",
  "APISID",
];

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

export interface ManagedBrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
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

async function detectBrowserSourceForKind(
  kind: BrowserKind
): Promise<BrowserSource | null> {
  if (process.platform !== "win32") return null;

  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env["PROGRAMFILES(X86)"];
  const detected = await detectDefaultBrowserExecutable();
  const detectedExe = detected.executablePath;
  const detectedLower = detectedExe?.toLowerCase() ?? "";

  if (!localAppData) return null;

  if (kind === "chrome") {
    const executablePath = await firstExisting([
      detectedLower.includes("chrome") ? detectedExe : undefined,
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      programFiles
        ? path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe")
        : undefined,
      programFilesX86
        ? path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe")
        : undefined,
    ]);

    return executablePath
      ? {
          kind,
          browserName: "Google Chrome",
          channel: "chrome",
          executablePath,
        }
      : null;
  }

  if (kind === "edge") {
    const executablePath = await firstExisting([
      detectedLower.includes("msedge") ? detectedExe : undefined,
      programFilesX86
        ? path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
      programFiles
        ? path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
    ]);

    return executablePath
      ? {
          kind,
          browserName: "Microsoft Edge",
          channel: "msedge",
          executablePath,
        }
      : null;
  }

  if (kind === "brave") {
    const executablePath = await firstExisting([
      detectedLower.includes("brave") ? detectedExe : undefined,
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

    return executablePath
      ? {
          kind,
          browserName: "Brave",
          executablePath,
        }
      : null;
  }

  const gxPath = path.join(localAppData, "Programs", "Opera GX", "opera.exe");
  const operaPath = path.join(localAppData, "Programs", "Opera", "opera.exe");
  const executablePath = await firstExisting([
    detectedLower.includes("opera") ? detectedExe : undefined,
    gxPath,
    operaPath,
  ]);

  if (!executablePath) return null;

  return {
    kind,
    browserName: executablePath.toLowerCase().includes("opera gx")
      ? "Opera GX"
      : "Opera",
    executablePath,
  };
}

async function profileDirectories(userDataDir: string): Promise<string[]> {
  const candidates = ["Default"];

  try {
    const entries = await fs.readdir(userDataDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (/^Profile\s+\d+$/i.test(entry.name)) {
        candidates.push(entry.name);
      }
    }
  } catch {
    // The managed directory may still be empty on first use.
  }

  return [...new Set(candidates)];
}

function preferencesShowGoogleAccount(raw: string): boolean {
  try {
    const preferences = JSON.parse(raw) as Record<string, unknown>;
    const stack: unknown[] = [preferences];
    let visited = 0;

    while (stack.length && visited < 12000) {
      const current = stack.pop();
      visited += 1;

      if (!current || typeof current !== "object") continue;

      if (Array.isArray(current)) {
        for (const item of current) stack.push(item);
        continue;
      }

      const object = current as Record<string, unknown>;
      const email = typeof object.email === "string" ? object.email : "";
      const gaia = typeof object.gaia === "string" ? object.gaia : "";

      if (email.includes("@") && gaia.length >= 6) {
        return true;
      }

      for (const value of Object.values(object)) {
        if (value && typeof value === "object") stack.push(value);
      }
    }
  } catch {
    // Preferences can be mid-write if the browser has not fully closed yet.
  }

  return false;
}

async function cookiesShowGoogleSession(cookiePath: string): Promise<boolean> {
  if (!(await exists(cookiePath))) return false;

  try {
    const stat = await fs.stat(cookiePath);
    if (stat.size < 256) return false;

    const raw = await fs.readFile(cookiePath);
    const text = raw.toString("latin1");

    if (!text.toLowerCase().includes("google.com")) return false;

    return GOOGLE_AUTH_COOKIE_MARKERS.some((marker) => text.includes(marker));
  } catch {
    return false;
  }
}

async function hasManagedGoogleLogin(userDataDir: string): Promise<boolean> {
  for (const profileName of await profileDirectories(userDataDir)) {
    const profileDir = path.join(userDataDir, profileName);

    try {
      const preferences = await fs.readFile(
        path.join(profileDir, "Preferences"),
        "utf8"
      );

      if (preferencesShowGoogleAccount(preferences)) {
        return true;
      }
    } catch {
      // Fall through to the cookie heuristic.
    }

    const cookieCandidates = [
      path.join(profileDir, "Network", "Cookies"),
      path.join(profileDir, "Cookies"),
    ];

    for (const cookiePath of cookieCandidates) {
      if (await cookiesShowGoogleSession(cookiePath)) {
        return true;
      }
    }
  }

  return false;
}

async function resolveManagedProfile(
  managedRootDir: string
): Promise<{ source: BrowserSource; userDataDir: string; ready: boolean }> {
  const savedKinds: BrowserKind[] = ["chrome", "edge", "brave", "opera"];
  const savedProfiles: Array<{
    source: BrowserSource;
    userDataDir: string;
    markerTime: number;
  }> = [];

  for (const kind of savedKinds) {
    const userDataDir = path.join(managedRootDir, kind);
    const markerPath = path.join(userDataDir, READY_MARKER);

    if (!(await exists(markerPath))) continue;
    if (!(await hasManagedGoogleLogin(userDataDir))) continue;

    const source = await detectBrowserSourceForKind(kind);
    if (!source) continue;

    const markerTime = await fs
      .stat(markerPath)
      .then((stat) => stat.mtimeMs)
      .catch(() => 0);

    savedProfiles.push({
      source,
      userDataDir,
      markerTime,
    });
  }

  savedProfiles.sort((a, b) => b.markerTime - a.markerTime);

  if (savedProfiles[0]) {
    return {
      source: savedProfiles[0].source,
      userDataDir: savedProfiles[0].userDataDir,
      ready: true,
    };
  }

  const source = await detectBrowserSource();

  if (!source) {
    throw new Error(
      "O navegador padrao do Windows nao e um Chromium compativel ou nao foi localizado. " +
      "Por enquanto o Auto Future suporta Opera/Opera GX, Chrome, Edge e Brave."
    );
  }

  const userDataDir = path.join(managedRootDir, source.kind);
  await fs.mkdir(userDataDir, { recursive: true });

  const hasLogin = await hasManagedGoogleLogin(userDataDir);

  return {
    source,
    userDataDir,
    ready: hasLogin,
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
  const { source, userDataDir, ready } = await resolveManagedProfile(managedRootDir);

  if (!ready) {
    throw new Error(
      "Ainda nao encontrei uma sessao Google autenticada no perfil do Auto Future. " +
      "Entre na conta na janela de configuracao, aguarde a pagina carregar e feche o navegador antes de confirmar."
    );
  }

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

export async function exportManagedBrowserCookies(
  managedRootDir: string
): Promise<{
  browserName: string;
  ready: boolean;
  cookies: ManagedBrowserCookie[];
}> {
  const { source, userDataDir, ready } = await resolveManagedProfile(managedRootDir);

  if (!ready) {
    return {
      browserName: source.browserName,
      ready: false,
      cookies: [],
    };
  }

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null = null;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      channel: source.channel,
      executablePath: source.executablePath,
      viewport: { width: 1280, height: 720 },
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
      ],
    });

    const cookies = await context.cookies();

    return {
      browserName: source.browserName,
      ready: true,
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (
      lower.includes("processsingleton") ||
      lower.includes("already in use") ||
      lower.includes("user data directory") ||
      (lower.includes("profile") && lower.includes("lock"))
    ) {
      throw new Error(
        "O perfil salvo do Auto Future está aberto em outra janela do navegador. " +
          "Feche essa janela e tente executar com IA novamente."
      );
    }

    throw new Error(
      "Não consegui ler a sessão salva de " +
        source.browserName +
        ". " +
        message
    );
  } finally {
    await context?.close().catch(() => undefined);
  }
}
