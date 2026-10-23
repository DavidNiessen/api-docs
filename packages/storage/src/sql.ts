import type pg from 'pg';
export interface SqlClient {
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<Row>>;
}
export interface SqlDatabase extends SqlClient {
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T>;
}
