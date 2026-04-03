import { spawnSync } from "child_process";
import path from "path";
import { getPythonPath, getRepoRoot } from "@/lib/paths";

export async function POST() {
  const externalScoringUrl = process.env.SCORING_URL;
  if (externalScoringUrl) {
    const sharedSecret = process.env.SCORING_SHARED_SECRET;
    let response: Response;
    try {
      response = await fetch(externalScoringUrl, {
        method: "POST",
        headers: sharedSecret ? { "x-scoring-secret": sharedSecret } : undefined,
      });
    } catch (err) {
      return Response.json(
        { ok: false, error: `Cannot reach scoring service at ${externalScoringUrl}: ${err}` },
        { status: 502 },
      );
    }
    const bodyText = await response.text();
    let parsed: { ok?: boolean; message?: string; error?: string } | null = null;
    try {
      parsed = JSON.parse(bodyText) as { ok?: boolean; message?: string; error?: string };
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error:
            parsed?.error ||
            parsed?.message ||
            bodyText ||
            `Scoring endpoint failed with ${response.status}`,
        },
        { status: response.status },
      );
    }
    return Response.json({ ok: true, stdout: parsed?.message || bodyText.trim() });
  }

  if (process.env.VERCEL) {
    return Response.json(
      {
        ok: false,
        error:
          "Scoring is not configured for Vercel. Set SCORING_URL to an external job endpoint that can run ml/jobs/run_inference.py.",
      },
      { status: 501 },
    );
  }

  const root = getRepoRoot();
  const py = getPythonPath();
  const script = path.join(root, "ml", "jobs", "run_inference.py");
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
