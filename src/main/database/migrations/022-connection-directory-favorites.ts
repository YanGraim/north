import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Remote directory favorites for one connection. Not a column of `connections`,
 * so export, duplicate and workspace copy do not carry the list.
 * No foreign key: an organization connection lives on the server, not in this
 * file. The trigger still drops rows when a local connection is deleted.
 */
export const migration022ConnectionDirectoryFavorites: Migration = {
  version: 22,
  name: '022-connection-directory-favorites',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE connection_directory_favorites (
        id TEXT PRIMARY KEY NOT NULL,
        connection_id TEXT NOT NULL,
        path TEXT NOT NULL,
        position INTEGER NOT NULL,
        UNIQUE (connection_id, path)
      );

      CREATE INDEX idx_connection_directory_favorites_connection
        ON connection_directory_favorites(connection_id, position);

      CREATE TRIGGER connection_directory_favorites_ad
      AFTER DELETE ON connections
      FOR EACH ROW
      BEGIN
        DELETE FROM connection_directory_favorites WHERE connection_id = OLD.id;
      END;
    `)
  }
}
