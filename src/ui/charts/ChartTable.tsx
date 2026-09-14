// docs/05 § Accessibility: every chart ships the same data as a table. It is visually hidden rather
// than absent, so the figures are reachable by a screen reader and by find-in-page without the
// chart having to encode them in colour.
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: { key: string; cells: string[] }[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => (
              <td key={columns[index] ?? String(index)}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
