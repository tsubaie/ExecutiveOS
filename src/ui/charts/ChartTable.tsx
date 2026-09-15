// docs/05 § Accessibility: every chart ships the same data as a table. It is visually hidden rather
// than absent, so the figures are reachable by a screen reader and by find-in-page without the
// chart having to encode them in colour.
//
// The hiding is on a wrapper, not on the table: a table treats `width: 1px` as a suggestion and
// still lays itself out at its content's width, so a long unbroken word in a caption — an entity
// named after a UUID, say — pushed the document wider than the screen and, in RTL, slid the page
// out from under the reader's thumb.
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
    <div className="sr-only">
      <table>
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
    </div>
  );
}
