import { config } from "../../../package.json";
import { getDir, fileNameNoExt, showInfo, getFilesRecursive, resourceFilesRecursive } from "../../utils/tools";
import { Schema } from "./schema";
import { ProgressWindowHelper } from "zotero-plugin-toolkit/dist/helpers/progressWindow";
import { langCodeDatabaseArr } from './insertLangCode';
import { msg } from "../../utils/constant";

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
      throw "Addon Database Integrity Check Found Error";
    }
    // 检查表结构
    if (!(await checkSchema())) {
      throw "Addon Database Schema Needs To Be Repaired";
    }
    //检查数据库读写
    if (!(await this.accessibilityTest())) {
      throw "Addon Database Can't Access";
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

  async renameTable(tableName: string, tableNameNew: string) {
    await this.executeTransaction(async () => {
      //let sqlOld = this.valueQueryAsync(`SELECT sql FROM sqlite_master WHERE name = 'itemTypes'`)
      const sql = `ALTER TABLE ${tableName} RENAME TO ${tableNameNew}`;
      await this.queryAsync(sql);
    });
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
      }
      await this.DB.queryAsync("PRAGMA foreign_keys = false");
      sql = `DROP TABLE ${tableName}_tempTable`;
      await this.queryAsync(sql);
      await this.DB.queryAsync("PRAGMA foreign_keys = true");
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


  async getNextID(table: string, field: string) {
    //这个 SQL 语句从表中选择特定字段的最大值，并使用 COALESCE 函数将其加1。如果最大值为 null，则返回默认值1。
    const sql = 'SELECT COALESCE(MAX(' + field + ') + 1, 1) FROM ' + table;
    return await this.valueQueryAsync(sql);
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
  let n = 0;
  while (addon == void 0) {
    Zotero.Promise.delay(50);
    ztoolkit.log("waiting for addon: " + n);
    n++;
  }
  let addonDB: DB | undefined = addon.mountPoint.database;
  // 若 addonDB 尚未定义则创建实例然后初始化
  if (!addonDB) {
    const DBPath = await makeDBPath();
    addonDB = new DB(DBPath);
  }
  // 若 addonDB 存在则检查
  try {
    await addonDB.initPromise;
  }
  catch (e: any) {
    ztoolkit.log(e);
    showInfo(e);
    /* if (typeof e == "string" && e == msg.SCHEMA_NEED_REPAIR) {
      if (!await compareSQLUpdateDB()) {
        throw e;
      }
      showInfo(msg.SCHEMA_SUCCESS_REPAIRED);
    } */
  }

  if (!addonDB.accessibility) {
    await addonDB.init();
  }

  return addonDB;
}
export async function clearTable(tableNames: string[]) {
  const DB = await getDB();
  for (const tableName of tableNames) {
    const sql = `DELETE FROM ${tableName}`;
    await DB.queryAsync(sql);
  }
}

export async function clearAllTable() {
  const tableNames = ["translateServiceSN", "translateServices", "accounts", "accessTokens", "freeLoginServices", "charConsum", "totalCharConsum", "serviceLimits", "serviceTypes"];
  await clearTable(tableNames);
}

export function getDBSync() {
  return addon.mountPoint.database as DB;
};

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

/**
 * false 为故障，true 为检查通过
 * @returns 
 */
async function checkSchema() {
  const schema = new Schema();
  if (!await schema.checkInitialized()) return false;
  if (!await schema.checkAddonVersion()) return false;
  if (await schema.integrityCheckRequired()) {
    if (!(await schema.integrityCheck())) return false;
  }
  return !(await schema.checkSchemasUpdate());

}


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
export async function compareSQLUpdateDB() {
  const DB = addon.mountPoint.database;
  const sqlsFromDB: string[] = [];
  const tableFromDB: string[] = [];
  const rows = await DB.queryAsync("SELECT name,sql FROM sqlite_master");
  for (const row of rows) {
    tableFromDB.push(row.name);
    if (!row.sql || !row.sql.length || row.sql == " ") continue;
    sqlsFromDB.push(row.sql.replace(/ +/g, " ").replace(/(\() +/g, "$1").replace(/ +(\))/g, "$1"));
  }

  const sqlsFromResourceFiles = await getSQLFromResourceFiles(DB);
  const allTextSqlsFromFiles = sqlsFromResourceFiles.join(';');
  //sqls 存在差异表示出现在数据库中，但文件中没有或修改了，需要删除数据库中的表
  //sqls 存在差异表示出现在数据库中，但文件中没有或修改了，需要删除数据库中的表
  const diffsDB = Zotero.Utilities.arrayDiff(sqlsFromDB, sqlsFromResourceFiles);
  const diffsFiles = Zotero.Utilities.arrayDiff(sqlsFromResourceFiles, sqlsFromDB);
  const diffs = diffsFiles.concat(diffsDB).filter((e: string) => !e.startsWith("DROP "));

  if (!diffs.length) {
    ztoolkit.log("schema in database and files no diffs "); return;
  };

  await DB.executeTransaction(async () => {
    const cache: string[] = [];
    for (const diff of diffs) {
      const matches = diff.match(/^CREATE\s((TABLE)|(INDEX)|(TRIGGER))\s(\w+)/i);
      if (!matches) continue;
      const tableName = matches.slice(-1)[0];
      if (cache.includes(tableName)) continue;
      const tableType = matches[1];
      const reg = new RegExp("CREATE\\s" + tableType + "\\s" + tableName, "i");
      if (allTextSqlsFromFiles.match(reg) && tableFromDB.includes(tableName)) {
        const oldColumns = await DB.getColumns(tableName);
        let sql = `SELECT COUNT(*) FROM ${tableName}`;
        const rowsNumberOld = await DB.queryAsync(sql);
        //如果旧表没有列或没有数据，则删除旧表建新表
        if (!oldColumns || oldColumns.length === 0 || !rowsNumberOld || rowsNumberOld === 0) {

          const sql = `DROP ${tableType} ${tableName}`;
          await DB.queryAsync("PRAGMA foreign_keys = false");
          await DB.queryAsync(sql);
          await DB.queryAsync("PRAGMA foreign_keys = true");
          await DB.queryAsync(diff);
          cache.push(tableName);
          ztoolkit.log(tableName + " table Created");
          continue;
        }
        //旧表重命名，建新表，导入数据，删除旧表      
        sql = `ALTER TABLE ${tableName} RENAME TO ${tableName}_tempTable`;
        await DB.queryAsync(sql);
        await DB.queryAsync(diff);
        const newColumns = await DB.getColumns(tableName);
        if (!newColumns || newColumns.length === 0) {
          cache.push(tableName);
          ztoolkit.log(tableName + " table Create Failure");
          continue;
        };
        const oldFields: any[] = [];
        for (const col of newColumns) {
          if (!oldColumns.includes(col)) {
            oldFields.push(getDefaltValue(col, diff));
          } else {
            oldFields.push(col);
          }
        }

        if (tableName == "serviceTypes") {
          sql = `INSERT INTO ${tableName} (serviceType) SELECT serviceType FROM ${tableName}_tempTable`;
        } else {
          sql = `INSERT INTO ${tableName} SELECT ${oldFields.join(",")} FROM ${tableName}_tempTable`;
        }


        await DB.queryAsync(sql);
        sql = `DROP TABLE ${tableName}_tempTable`;
        await DB.queryAsync(sql);
      }
      if (allTextSqlsFromFiles.match(reg) && !tableFromDB.includes(tableName)) {
        await DB.queryAsync(diff);
      }
      if (!allTextSqlsFromFiles.match(reg) && tableFromDB.includes(tableName)) {
        const sql = `DROP ${tableType} ${tableName}`;
        await DB.queryAsync(sql);
      }
      cache.push(tableName);
    }
  });
  return true;
}
function getDefaltValue(col: string, sql: string) {
  const reg = new RegExp("\\(.*?" + `(${col}` + ".+?)[,)]");
  const match = sql.match(reg);

  if (!match) return "NULL";
  const tempArr = match[1].split(/ +/);
  const index = tempArr.indexOf("DEFAULT");
  if (index > -1) {
    ztoolkit.log("found colum DEFAULT value: " + tempArr[index + 1]);
    return tempArr[index + 1];
  }
  if (tempArr.indexOf("INT") > -1) {
    return 0;
  }
}



export async function getSQLFromResourceFiles(DB: DB, filterFilename?: string) {
  const sqlsFromResourceFiles = [];
  const files = await resourceFilesRecursive(undefined, undefined, "sql");
  for (const file of files) {
    if (!file.name) {
      ztoolkit.log(file + " without name");
      continue;
    }
    if (filterFilename && file.name != filterFilename) {
      continue;
    }
    const path = file.path + file.name;
    const sqlFromFile = await Zotero.File.getResourceAsync(path);
    const sqls = DB.parseSQLFile(sqlFromFile);
    //sqlite 表结构中的建表语句没有 " IF NOT EXISTS"
    const sqlsTemp = sqls.map(sql => sql.replace(" IF NOT EXISTS", '').replace(/ +/g, " ").replace(/(\() +/g, "$1").replace(/ +(\))/g, "$1"));
    sqlsFromResourceFiles.push(...sqlsTemp);
  }
  return sqlsFromResourceFiles;
}

export async function getSQLFilesContent() {
  const sqlsFromResourceFiles = [];
  const files = await resourceFilesRecursive(undefined, undefined, "sql");
  for (const file of files) {
    if (!file.name) {
      ztoolkit.log(file + " without name");
      continue;
    }
    const path = file.path + file.name;
    const sqlFromFile = await Zotero.File.getResourceAsync(path);
    sqlsFromResourceFiles.push(sqlFromFile);
  }
  return sqlsFromResourceFiles;
}

export async function fillServiceTypes() {
  const DB = await getDB();
  const serviceTypes = ["translate", "ocr", "ocrTranslate", "languageIdentification"];
  const tableName = "serviceTypes";
  await DB.executeTransaction(async () => {
    for (const serviceType of serviceTypes) {
      const index = serviceTypes.indexOf(serviceType);
      const sql = `INSERT INTO ${tableName} (serviceTypeID,serviceType) VALUES (${index},'${serviceType}')`;
      await DB.queryAsync(sql);
    }
  });
}



export async function getTableNamesFromSqlFile(fileName: string) {
  const DB = await getDB();
  const sqlsFromResourceFiles = await getSQLFromResourceFiles(DB, fileName);
  const diffs = sqlsFromResourceFiles.join(';');
  const tableNames = [];
  for (const diff of diffs) {
    const matches = diff.match(/^CREATE\s((TABLE)|(INDEX)|(TRIGGER))\s(\w+)/i);
    if (!matches) continue;
    const tableName = matches.slice(-1)[0];
    tableNames.push(tableName);
  }
  return tableNames;
}