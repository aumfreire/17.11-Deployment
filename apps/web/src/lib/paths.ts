import path from "path";

/** Repo root (parent of `apps/`). Override with SHOP_REPO_ROOT when cwd is not `apps/web/`. */
export function getRepoRoot(): string {
  if (process.env.SHOP_REPO_ROOT) {
    return path.resolve(process.env.SHOP_REPO_ROOT);
  }
  return path.resolve(process.cwd(), "../..");
}

export function getDbPath(): string {
  if (process.env.SHOP_DB_PATH) {
    return path.resolve(process.env.SHOP_DB_PATH);
  }
  return path.join(getRepoRoot(), "data", "sqlite", "shop.db");
}

export function getPythonPath(): string {
  return process.env.PYTHON_PATH || "python3";
}
