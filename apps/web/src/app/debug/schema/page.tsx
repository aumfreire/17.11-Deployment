import { getDb } from "@/lib/db";

export default async function DebugSchemaPage() {
  const db = getDb();
  const tables = await db.listTables();
  const schema = await Promise.all(
    tables.map(async ({ name }) => ({
      name,
      cols: await db.tableInfo(name),
    })),
  );

  return (
    <div>
      <h1>Database schema</h1>
      <p className="badge">Read-only schema inspector</p>
      {schema.map(({ name, cols }) => {
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
