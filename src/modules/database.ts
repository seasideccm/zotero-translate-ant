import { config } from "../../package.json";
import { insertLangCode } from "./database/insertLangCode";

/* export class DB extends Zotero.DBConnection {
    constructor(dbNameOrPath: string) {
        super(dbNameOrPath);        
        addon.mountPoing.database= this;

    }
} */

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
 * 5. "F:\\download\\zotero\\zotero7DataDirectory\\batchTranslate"
 * 6. 留空则连接默认数据库（可在插件选项中指定）
 */
export async function getDB(dbName?: string) {

    //todo pref set dbname
    dbName = dbName || `${config.addonRef}`;
    let addonDB = addon.mountPoing.database;
    if (addonDB) {
        try {
            await addonDB.test();
            return addonDB;
        }
        catch (e) {
            ztoolkit.log(e);
        }
    }

    const dir = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
    if (!await IOUtils.exists(dir)) {
        await IOUtils.makeDirectory(dir);
    }
    const path = PathUtils.join(dir, dbName + ".sqlite");
    // 创建数据库实例
    addonDB = new Zotero.DBConnection(path);


    try {
        let msg;
        // Test read access, if failure throw error
        await addonDB.test();
        // Test write access on path
        if (!Zotero.File.pathToFile(dir).isWritable()) {
            msg = 'Cannot write to ' + dir + '/';
        }
        // Test write access on database
        else if (!Zotero.File.pathToFile(path).isWritable()) {
            msg = 'Cannot write to ' + path;
        }
        else {
            msg = false;
        }
        if (msg) {
            const e = {
                name: 'NS_ERROR_FILE_ACCESS_DENIED',
                message: msg,
                toString: function () { return this.message; }
            };
            throw (e);
        }
    }
    catch (e: any) {
        if (_checkDataDirAccessError(e)) {
            ztoolkit.log(e);
        }
        // Storage busy
        else if (e.message.includes('2153971713')) {
            ztoolkit.log(Zotero.getString('startupError.databaseInUse'));
        }
        else {
            const stack = e.stack ? Zotero.Utilities.Internal.filterStack(e.stack) : null;
            ztoolkit.log(
                Zotero.getString('startupError', Zotero.appName) + "\n\n"
                + Zotero.getString('db.integrityCheck.reportInForums') + "\n\n"
                + (stack || e)
            );
        }
        ztoolkit.log(e);
    }
    //确保数据库已经初始化
    //初始化执行一系列 queryAsync 命令。即 sqlite 语句。
    // queryAsync 连接数据库，不存在则会创建
    if (!addonDB.dbInitialized) {
        //查表
        const tablesName = await addonDB.queryAsync("select name from sqlite_master where type='table' order by name");
        //const addonDBVersion = await Zotero.DB.valueQueryAsync("SELECT version FROM version WHERE schema='translation'");
        if (tablesName.length === 0) {
            await initializeSchema(addonDB);
        } else {
            // 检查数据库是否完整
            const integrityCheck = await addonDB.queryAsync("PRAGMA integrity_check");
            if (integrityCheck[0].integrity_check != 'ok') {
                ztoolkit.log(Zotero.getString('startupError.databaseIntegrityCheckFailed'));
            }
            addonDB.dbInitialized = true;
        }

    };
    //addon.mountPoing.database ? addon.mountPoing.database[dbName] = addonDB : addon.mountPoing.database = { [dbName]: addonDB };
    addon.mountPoing.database = addonDB;
    return addonDB;

    async function initializeSchema(DB: any) {
        await DB.executeTransaction(async function () {
            try {
                await DB.queryAsync("PRAGMA page_size = 4096");
                await DB.queryAsync("PRAGMA encoding = 'UTF-8'");
                await DB.queryAsync("PRAGMA auto_vacuum = 1");
                const sql = await getSchemaSQL('initSchema');
                await DB.executeSQLFile(sql);
                await insertLangCode(DB);
                DB.dbInitialized = true;
            }
            catch (e) {
                Zotero.debug(e, 1);
                Components.utils.reportError(e);
                const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Components.interfaces.nsIPromptService);
                ps.alert(
                    null,
                    Zotero.getString('general.error'),
                    Zotero.getString('startupError', Zotero.appName)
                );
                throw e;
            }
        });
    }
    /**
     * 
     * @param schema 
     * @param dir option default:chrome://${config.addonRef}/content/
     * @returns 
     */
    async function getSchemaSQL(schema: string, dir?: string) {
        if (!schema) {
            throw ('Schema type not provided to _getSchemaSQL()');
        }
        dir = dir || `chrome://${config.addonRef}/content/schema/`;
        const path = dir + `${schema}.sql`;
        return await Zotero.File.getResourceAsync(path);
    }

    function _checkDataDirAccessError(e: any) {
        if (e.name != 'NS_ERROR_FILE_ACCESS_DENIED' && !e.message.includes('2152857621')) {
            return false;
        }

        let msg = Zotero.getString('dataDir.databaseCannotBeOpened', Zotero.clientName)
            + "\n\n"
            + Zotero.getString('dataDir.checkPermissions', Zotero.clientName);
        // If already using default directory, just show it
        if (Zotero.DataDirectory.dir == Zotero.DataDirectory.defaultDir) {
            msg += "\n\n" + Zotero.getString('dataDir.location', Zotero.DataDirectory.dir);
        }
        // Otherwise suggest moving to default, since there's a good chance this is due to security
        // software preventing Zotero from accessing the selected directory (particularly if it's
        // a Firefox profile)
        else {
            msg += "\n\n"
                + Zotero.getString('dataDir.moveToDefaultLocation', Zotero.clientName)
                + "\n\n"
                + Zotero.getString(
                    'dataDir.migration.failure.full.current', Zotero.DataDirectory.dir
                )
                + "\n"
                + Zotero.getString(
                    'dataDir.migration.failure.full.recommended', Zotero.DataDirectory.defaultDir
                );
        }
        Zotero.startupError = msg;
        return true;
    }
}

async function bakeupDatebase(addonDB: any) {
    addonDB._externalDB = false;
    return await addonDB.backupDatabase();
}
class Tanslation {
    sourceText: string;
    targetText: string;
    translateMode: string;
    originID: number;
    originKey: string;
    originLibraryID: number;
    score: number;
    constructor(option: any) {
        this.sourceText = option.sourceText;
        this.targetText = option.targetText;
        this.translateMode = option.translateMode;
        this.originID = option.originID;
        this.originKey = option.originKey;
        this.originLibraryID = option.originLibraryID;
        this.score = option.score || 0;
    }
}
async function tanslationData(option: any) {

    const tables = ["translation", "translateMode", "score", "sourceText", "targetText"];
    ["langCode", "sourceText"];


}

/**
 * 创建临时表，新建表，导入数据，删除旧表
 * @param tableName 
 * @param allColumnsDefine 
 */
export async function modifyColumn(tableName: string, allColumnsDefine: string) {
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

}

async function saveDateToDB(data: any, op?: string, record?: { filed: string; value: any; }) {
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
        await Zotero.DB.queryAsync(sql, env.sqlValues);
    }
}




