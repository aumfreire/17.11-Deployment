import { getDb } from "@/lib/db";

export default function DebugSchemaPage() {
  const db = getDb();
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all() as { name: string }[];

  return (
    <div>
      <h1>SQLite schema</h1>
      <p className="badge">Read-only PRAGMA inspector</p>
      {tables.map(({ name }) => {
        const cols = db.prepare(`PRAGMA table_info('${name.replace(/'/g, "''")}')`).all() as {
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: unknown;
          pk: number;
        }[];
        return (
          <section key={name} className="card">
            <h2>{name}</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Column</th>
                  <th>Type</th>
                  <th>PK</th>
                  <th>NOT NULL</th>
                </tr>
              </thead>
              <tbody>
                {cols.map((c) => (
                  <tr key={c.name}>
                    <td>{c.cid}</td>
                    <td>{c.name}</td>
                    <td>{c.type}</td>
                    <td>{c.pk ? "yes" : ""}</td>
                    <td>{c.notnull ? "yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
