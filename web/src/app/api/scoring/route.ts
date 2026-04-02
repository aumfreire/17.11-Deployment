import { spawnSync } from "child_process";
import path from "path";
import { getPythonPath, getRepoRoot } from "@/lib/paths";

export async function POST() {
  const root = getRepoRoot();
  const py = getPythonPath();
  const script = path.join(root, "jobs", "run_inference.py");
  const r = spawnSync(py, [script], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env },
  });
  if (r.error) {
    return Response.json({ ok: false, error: String(r.error) }, { status: 500 });
  }
  if (r.status !== 0) {
    return Response.json(
      { ok: false, stderr: r.stderr, stdout: r.stdout },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, stdout: r.stdout?.trim() ?? "" });
}
