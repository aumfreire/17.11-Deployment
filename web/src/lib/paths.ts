import path from "path";

/** Repo root (parent of `web/`). Override with SHOP_REPO_ROOT when cwd is not `web/`. */
export function getRepoRoot(): string {
  if (process.env.SHOP_REPO_ROOT) {
    return path.resolve(process.env.SHOP_REPO_ROOT);
  }
  return path.resolve(process.cwd(), "..");
}

export function getDbPath(): string {
  if (process.env.SHOP_DB_PATH) {
    return path.resolve(process.env.SHOP_DB_PATH);
  }
  return path.join(getRepoRoot(), "db", "shop.db");
}

export function getPythonPath(): string {
  return process.env.PYTHON_PATH || "python3";
}
