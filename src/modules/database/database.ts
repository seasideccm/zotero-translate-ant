import { config } from "../../../package.json";
import { getDir, fileNameNoExt, showInfo, getFilesRecursive, resourceFilesRecursive } from "../../utils/tools";
import { Schema } from "./schema";
import { ProgressWindowHelper } from "zotero-plugin-toolkit/dist/helpers/progressWindow";

//通过as Zotero.DBConnection 类型断言，避免修改 node_modules\zotero-types\types\zotero.d.ts
export class DB extends (Zotero.DBConnection as Zotero.DBConnection) {
  [key: string]: any;
  accessibility: boolean | null;
  initPromise: Promise<void>;

  /**
   * - 参数为完整路径时，Zotero 将创建的数据库标记为外部，
   * - 仅传入名称时，标为内部数据库
   * @param dbNameOrPath
   * @example
   * Zotero.DB = new Zotero.DBConnection('zotero')
   */
  constructor(dbNameOrPath: string) {
    super(dbNameOrPath);
    this.accessibility = null;
    addon.mountPoint.database = this;
    this.initPromise = this.init();
  }

  async init() {
    // 检查数据库完整性
    const integrityDB = await this.integrityCheck();
    if (!integrityDB) {
      throw "addon database integrityCheck found error";
    }
    // 检查表结构
    if (!(await checkSchema())) {
      throw "addon database schema needs to be repaired";
    }
    //检查数据库读写
    if (!(await this.accessibilityTest())) {
      throw "addon database can't access";
    }
  }

  async accessibilityTest() {
    try {
      let msg;
      // Test read access, if failure throw error
      await this.test();
      // Test write access on path
      const dir = PathUtils.parent(this._dbPath)!;
      if (!Zotero.File.pathToFile(dir).isWritable()) {
        msg = "Cannot write to " + dir + "/";
      }
      // Test write access on database
      else if (!Zotero.File.pathToFile(this._dbPath).isWritable()) {
        msg = "Cannot write to " + this._dbPath;
      } else {
        msg = false;
      }
      if (msg) {
        const e = {
          name: "NS_ERROR_FILE_ACCESS_DENIED",
          message: msg,
          toString: function () {
            return this.message;
          },
        };
        throw e;
      }
    } catch (e: any) {
      if (_checkDataDirAccessError(e)) {
        ztoolkit.log(e);
      }
      // Storage busy
      else if (e.message.includes("2153971713")) {
        ztoolkit.log(Zotero.getString("startupError.databaseInUse"));
      } else {
        const stack = e.stack
          ? Zotero.Utilities.Internal.filterStack(e.stack)
          : null;
        ztoolkit.log(
          Zotero.getString("startupError", Zotero.appName) +
          "\n\n" +
          Zotero.getString("db.integrityCheck.reportInForums") +
          "\n\n" +
          (stack || e),
        );
      }
      ztoolkit.log(e);
      return (this.accessibility = false);
    }

    return (this.accessibility = true);
  }

  /**
   * 将插件数据库先设置为内部数据库，备份后恢复为外部数据库
   * @param suffix
   * @param force
   * @returns
   */
  async bakeupDB(suffix: any = false, force: boolean = false) {
    this._externalDB = false;
    const result = await this.backupDatabase(suffix, force);
    this._externalDB = true;
    return result;
  }

  getFieldID(field: string) {
    const sql = `SELECT fieldID FROM fields WHERE fieldName = ${field}`;
    return this.valueQueryAsync(sql);

  }

  /**
   * 重新定义表的字段（列）
   * - 创建临时表，新建表，导入数据，删除旧表
   * @param tableName
   * @param allColumnsDefine
   */
  async modifyColumn(tableName: string, allColumnsDefine: string) {
    await this.executeTransaction(async () => {
      const oldColumns = await this.getColumns(tableName);
      let sql = `ALTER TABLE ${tableName} RENAME TO ${tableName}_tempTable`;
      await this.queryAsync(sql);
      sql = `CREATE TABLE ${tableName} (${allColumnsDefine})`;
      await this.queryAsync(sql);
      const newColumns = await this.getColumns(tableName);
      if (oldColumns && newColumns && oldColumns.length === newColumns.length) {
        sql = `INSERT INTO ${tableName} SELECT * FROM ${tableName}_tempTable`;
        await this.queryAsync(sql);
        /* try{
                    await this.queryAsync(sql);
                }
                catch(e:any){
                    ztoolkit.log(e)
                    throw e
                } */
      }
      sql = `DROP TABLE ${tableName}_tempTable`;
      await this.queryAsync(sql);
    });
  }

  //data: { [columsField: string]: any; } | { [columsField: string]: any; }[] | any[] | any[][]
  async saveDate(
    tableName: string,
    dataValues: any[] | any[][],
    sqlColumns: string[] = [],
  ) {
    this.requireTransaction();
    if (sqlColumns.length == 0) {
      const tableColumns = await this.getColumns(tableName);
      if (!tableColumns || tableColumns.length == 0) {
        throw "Query failed: table colums not found";
      }
      sqlColumns = tableColumns;
    }

    if (!Array.isArray(dataValues[0])) {
      dataValues = [dataValues];
    }
    if (dataValues[0].length != sqlColumns.length) {
      throw "Colums and Values mismatch";
    }
    for (const sqlValues of dataValues) {
      const sql =
        "INSERT INTO " +
        tableName +
        " (" +
        sqlColumns.join(", ") +
        ") " +
        "VALUES (" +
        sqlValues.map(() => "?").join() +
        ")";
      await this.queryAsync(sql, sqlValues);
    }

    //const sqlColumns = Object.keys(data);
    //const sqlValues = sqlColumns.map((key) => data[key]);
  }

  async updateDate(
    tableName: string,
    data: { [columsField: string]: any; },
    record: { [columsField: string]: any; },
  ) {
    const sqlColumns = Object.keys(data);
    const sqlValues = sqlColumns.map((key) => data[key]);
    const condition = Object.keys(record)
      .map((e) => e + "=?")
      .join(" AND ");
    const sql =
      "UPDATE " +
      tableName +
      " SET " +
      sqlColumns.join("=?, ") +
      "=? WHERE " +
      condition;
    sqlValues.push(...Object.values(record));
    await this.queryAsync(sql, sqlValues);
  }


  getNextID(table: string, field: string) {
    const sql = 'SELECT COALESCE(MAX(' + field + ') + 1, 1) FROM ' + table;
    return this.valueQueryAsync(sql);
  };
}

/**
 * 连接数据库
 * @param dbName 可选，数据库名称或完整路径
 * @returns
 * @example
 * 参数形式示例
 * 1. "F:\\download\\zotero\\zotero7DataDirectory\\batchTranslate\\addonDB.sqlite"
 *    注意单个反斜杠 "\" 是转义标识，故而请使用双反斜杠
 * 2. addonDB
 * 3. addonDB.sqlite
 * 4. "F:\\download\\zotero\\zotero7DataDirectory\\batchTranslate\\"
 * 5. "F:\\download\\zotero\\zotero7DataDirectory\\batchTranslate\\addonDB"
 * 6. 留空则连接默认数据库（可在插件选项中指定）
 */
export async function getDB(dbName?: string) {
  let addonDB: DB | undefined = addon.mountPoint.database;
  if (!addonDB) {
    const DBPath = await makeDBPath();
    addonDB = new DB(DBPath);
  }
  try {
    await addonDB.initPromise;
  } catch (e: any) {
    ztoolkit.log(e);
    showInfo(e);
    //await checkSchema();
    throw e;
  }
  if (!addonDB.accessibility) {
    await addonDB.init();
  }
  return addonDB;
}

async function makeDBPath(dbName?: string) {
  //dir.replace(/\/|\\$/gm, '')
  let dir = dbName
    ? getDir(dbName)
    : PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
  if (!(await IOUtils.exists(dir))) {
    try {
      await IOUtils.makeDirectory(dir);
    } catch (e) {
      (addon.mountPoint.popupWin as ProgressWindowHelper)
        .createLine({
          text: e as string,
          type: "default",
        })
        .show();
      throw e;
    }
  }
  dir == "."
    ? (dir = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef))
    : () => { };
  dbName = dbName
    ? fileNameNoExt(dbName) + ".sqlite"
    : `${config.addonRef}DB.sqlite`;
  const path = PathUtils.join(dir, dbName!);
  return path;
}

function _checkDataDirAccessError(e: any) {
  if (
    e.name != "NS_ERROR_FILE_ACCESS_DENIED" &&
    !e.message.includes("2152857621")
  ) {
    return false;
  }

  let msg =
    Zotero.getString("dataDir.databaseCannotBeOpened", Zotero.clientName) +
    "\n\n" +
    Zotero.getString("dataDir.checkPermissions", Zotero.clientName);
  if (Zotero.DataDirectory.dir == Zotero.DataDirectory.defaultDir) {
    msg +=
      "\n\n" + Zotero.getString("dataDir.location", Zotero.DataDirectory.dir);
  } else {
    msg +=
      "\n\n" +
      Zotero.getString("dataDir.moveToDefaultLocation", Zotero.clientName) +
      "\n\n" +
      Zotero.getString(
        "dataDir.migration.failure.full.current",
        Zotero.DataDirectory.dir,
      ) +
      "\n" +
      Zotero.getString(
        "dataDir.migration.failure.full.recommended",
        Zotero.DataDirectory.defaultDir,
      );
  }
  Zotero.startupError = msg;
  return true;
}

async function checkSchema() {
  const schema = new Schema();
  await schema.checkInitialized();
  if (!schema.initialized) {
    //初始化表结构，无需检查完整性和更新
    await schema.initializeSchema();
    if (!schema.initialized) {
      return false;
    } else {
      return true;
    }
  }
  if (await schema.checkAddonVersionChange()) {
    await schema.updateLastAddonVersion;
  }
  if (await schema.integrityCheckRequired()) {
    //失败则中止
    if (!(await schema.integrityCheck())) return false;
  }
  await schema.checkSchemasUpdate();
  return true;
}

/* async function bakeupDatebase(addonDB: any) {
    addonDB._externalDB = false;
    return addonDB.backupDatabase();
} */

/**
 * 创建临时表，新建表，导入数据，删除旧表
 * @param tableName
 * @param allColumnsDefine
 */
/* export async function modifyColumn(tableName: string, allColumnsDefine: string) {
    const DB = await getDB();
    await DB.executeTransaction(async function () {
        const oldColumns = await DB.getColumns(tableName);
        let sql = `ALTER TABLE ${tableName} RENAME TO ${tableName}_tempTable`;
        await DB.queryAsync(sql);
        sql = `CREATE TABLE ${tableName} (${allColumnsDefine})`;
        await DB.queryAsync(sql);
        const newColumns = await DB.getColumns(tableName);
        if (oldColumns && newColumns && oldColumns.length === newColumns.length) {
            sql = `INSERT INTO ${tableName} SELECT * FROM ${tableName}_tempTable`;
            await DB.queryAsync(sql);
        }
        sql = `DROP TABLE ${tableName}_tempTable`;
        await DB.queryAsync(sql);
    });

} */

/* async function saveDateToDB(data: any, op?: string, record?: { filed: string; value: any; }) {
    const DB = await getDB();
    const sqlColumns = Object.keys(data);
    sqlColumns.unshift(data.tableName);
    const sqlValues = sqlColumns.map((key) => data[key]);
    const env = {
        sqlColumns: sqlColumns,
        sqlValues: sqlValues
    };

    if (!op || op == "insert") {
        const sql = "INSERT INTO " + data.tableName + " (" + env.sqlColumns.join(", ") + ") "
            + "VALUES (" + env.sqlValues.map(() => "?").join() + ")";
        await DB.queryAsync(sql, env.sqlValues);
    }
    if (op && op == "update" && record) {
        const sql = "UPDATE " + data.tableName + " SET " + env.sqlColumns.join("=?, ") + "=? WHERE " + record.filed + "=?";
        env.sqlValues.push(parseInt(record.value));
        await DB.queryAsync(sql, env.sqlValues);
    }
} */


//读取数据库建表 sql 语句，逐个表和 sql 文件拆分的见表语句比对，若有差异，备份表，重建表，导入旧数据，删除备份表
export async function getSQLFromDB(schema: string) {
  const sqlsFromDB = [];
  const sql = "SELECT name,sql FROM sqlite_master WHERE SQL NOT NULL";
  const DB = await getDB();
  const rows = await DB.queryAsync(sql);
  for (const row of rows) {
    sqlsFromDB.push(row.sql.replace(/ +/g, " "));
  }

  const sqlsFromResourceFiles = [];
  /* const path = "F:\\zotero-batch-translate\\addon\\chrome\\content\\schema";
  const files = await getFilesRecursive(path, "sql"); */
  const files = await resourceFilesRecursive(undefined, undefined, "sql");
  for (const file of files) {
    if (!file.name) {
      throw "Schema type not provided to this.getSchemaSQL()";
    }
    const path = file.path + file.name;
    const sqlFromFile = await Zotero.File.getResourceAsync(path);
    const sqls = DB.parseSQLFile(sqlFromFile);
    //sqlite 表结构中的建表语句没有 " IF NOT EXISTS"
    const sqlsTemp = sqls.map(sql => sql.replace(" IF NOT EXISTS", '').replace(/ +/g, " "));
    sqlsFromResourceFiles.push(...sqlsTemp);
  }
  let diffs;
  if (sqlsFromDB.length >= sqlsFromResourceFiles.length) {
    diffs = Zotero.Utilities.arrayDiff(sqlsFromDB, sqlsFromResourceFiles);
  } else {
    diffs = Zotero.Utilities.arrayDiff(sqlsFromResourceFiles, sqlsFromDB);
  }
  diffs = diffs.filter((e: string) => !e.startsWith("DROP "));
  for (const diff of diffs) {
    ztoolkit.log(diff);
  }
}
