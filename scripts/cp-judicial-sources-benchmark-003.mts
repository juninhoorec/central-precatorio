import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { createResearchOfficialProcessRoutes, OfficialProcessSourceCollector } from "../src/lib/official-process-source-collector";
import { TjspJuscraperAdapter, type TjspJuscraperRunnerInput } from "../src/lib/tjsp-juscraper-adapter";

const execFileAsync = promisify(execFile);
const processNumber = "0196151-64.2018.8.26.0500";
const commandDiagnostics: Array<Record<string, unknown>> = [];

async function runJuscraper(input: TjspJuscraperRunnerInput) {
  let pythonExecutable: string | null = null;
  let pythonVersion: string | null = null;
  for (const candidate of ["python3", "python"]) {
    const command = `${candidate} --version`;
    try {
      const result = await execFileAsync(candidate, ["--version"], { timeout: 2_000, windowsHide: true });
      pythonExecutable = candidate;
      pythonVersion = (result.stdout || result.stderr).trim();
      commandDiagnostics.push({ command, executable: candidate, exitCode: 0, stdout: result.stdout, stderr: result.stderr, version: pythonVersion });
      break;
    } catch (error) {
      const result = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
      commandDiagnostics.push({ command, executable: candidate, exitCode: result.code ?? null, stdout: result.stdout ?? "", stderr: result.stderr ?? result.message ?? "" });
    }
  }

  if (!pythonExecutable) {
    const runtimeDiagnostics = {
      command: "python3 -c \"import juscraper as jus; scraper=jus.scraper('tjsp'); scraper.cpopg('0196151-64.2018.8.26.0500')\" (não executado: nenhum interpretador Python disponível)",
      executable: null,
      version: null,
      error: "Python runtime não encontrado; os comandos python3 --version e python --version falharam.",
      missingDependency: "Python runtime (juscraper não pôde ser verificado sem Python)",
      stdout: commandDiagnostics.map(item => item.stdout ?? "").join(""),
      stderr: commandDiagnostics.map(item => item.stderr ?? "").join("\n"),
      probes: commandDiagnostics,
    };
    return {
      stdout: JSON.stringify({ status: "NOT_CONFIGURED", message: runtimeDiagnostics.error, runtimeDiagnostics }),
      stderr: runtimeDiagnostics.stderr,
      code: 127,
      requestAttempted: false,
    };
  }

  const command = `${pythonExecutable} -c <juscraper-cpopg-script> ${processNumber} cpopg`;
  const pythonScript = `import json, sys\ntry:\n import juscraper as jus\n scraper = jus.scraper('tjsp')\n payload = scraper.cpopg(sys.argv[1])\n print(json.dumps({'status': 'SUCCESS', 'payload': payload}, default=str))\nexcept ModuleNotFoundError as exc:\n print(json.dumps({'status': 'NOT_CONFIGURED', 'message': str(exc), 'missingDependency': exc.name}))\nexcept Exception as exc:\n text = str(exc); lower = text.lower()\n status = 'TIMEOUT' if 'timeout' in lower or 'timed out' in lower else 'RATE_LIMITED' if '429' in lower or 'rate limit' in lower else 'CAPTCHA_REQUIRED' if 'captcha' in lower or 'cloudflare' in lower or 'challenge' in lower else 'ERROR'\n print(json.dumps({'status': status, 'message': text}))\n`;
  try {
    const result = await execFileAsync(pythonExecutable, ["-c", pythonScript, processNumber], { timeout: input.timeoutMs, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    const runtimeDiagnostics = { command, executable: pythonExecutable, version: pythonVersion, exitCode: 0, stdout: result.stdout, stderr: result.stderr, missingDependency: null };
    return { stdout: result.stdout, stderr: result.stderr, code: 0, requestAttempted: true, runtimeDiagnostics };
  } catch (error) {
    const result = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string; signal?: string };
    const runtimeDiagnostics = { command, executable: pythonExecutable, version: pythonVersion, exitCode: result.code ?? null, signal: result.signal ?? null, stdout: result.stdout ?? "", stderr: result.stderr ?? result.message ?? "", missingDependency: null };
    return {
      stdout: result.stdout || JSON.stringify({ status: "ERROR", message: result.message, runtimeDiagnostics }),
      stderr: result.stderr ?? "",
      code: typeof result.code === "number" ? result.code : null,
      signal: result.signal,
      requestAttempted: true,
    };
  }
}

const routes = createResearchOfficialProcessRoutes();
routes[0] = new TjspJuscraperAdapter({ runner: runJuscraper });

const timings: Array<{ route: string; startedAt: string; finishedAt?: string; startOffsetMs: number; durationMs?: number }> = [];
const wallStartedAt = new Date();
const monotonicStartedAt = performance.now();
const instrumentedRoutes = routes.map((route) => ({
  source: route.source,
  supports: (request: Parameters<typeof route.supports>[0]) => route.supports(request),
  async search(request: Parameters<typeof route.search>[0]) {
    const routeStarted = performance.now();
    const timing: { route: string; startedAt: string; finishedAt?: string; startOffsetMs: number; durationMs?: number } = {
      route: route.source,
      startedAt: new Date().toISOString(),
      startOffsetMs: Number((routeStarted - monotonicStartedAt).toFixed(3)),
    };
    timings.push(timing);
    try {
      return await route.search(request);
    } finally {
      timing.finishedAt = new Date().toISOString();
      timing.durationMs = Number((performance.now() - routeStarted).toFixed(3));
    }
  },
}));

const results = await new OfficialProcessSourceCollector(instrumentedRoutes).search({ processNumber });
const wallFinishedAt = new Date();
const output = {
  benchmark: "CP-JUDICIAL-SOURCES-BENCHMARK-003",
  processNumber,
  fanOut: {
    startedAt: wallStartedAt.toISOString(),
    finishedAt: wallFinishedAt.toISOString(),
    durationMs: Number((performance.now() - monotonicStartedAt).toFixed(3)),
    routeCount: routes.length,
    timings,
  },
  results,
  runtimeDiagnostics: commandDiagnostics,
};
console.log(JSON.stringify(output, null, 2));