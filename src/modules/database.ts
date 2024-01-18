import { config } from "../../package.json";
import { getDir, fileNameNoExt, resourceFilesName } from "../utils/tools";
import { Schema } from "./database/schema";
import { schemaConfig } from "../utils/constant";
import { ProgressWindowHelper } from "zotero-plugin-toolkit/dist/helpers/progressWindow";


//通过as Zotero.DBConnection 类型断言，避免修改 node_modules\zotero-types\types\zotero.d.ts
export class DB extends (Zotero.DBConnection as Zotero.DBConnection) {
    schemaVersions: any;
    schema?: Schema;
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
        this.schemaVersions = {};
        this.initPromise = this.init();
    }

    async init() {

        const integrityDB = await this.integrityCheck();
        if (!integrityDB) {
            throw ("addon database needs to be repaired");
        }
        const integritySchema = await this.checkSchema();
        if (!integritySchema) {
            throw ("addon database schema needs to be repaired");
        };
        const accessibility = await this.accessibilityTest();
        if (!accessibility) {
            throw ("addon database can't access");
        }
        if (await this.schema!.checkSchemasUpdate()) {
            throw ("addon database needs update");
        }

    };

    async checkSchema() {
        if (!this.schema) {
            this.schema = new Schema();
            await this.schema.checkInitialized();
        }
        if (!this.schema.initialized) {
            await this.schema.initializeSchema();
            if (!this.schema.initialized) {
                return false;
            } else {
                return true;
            }
        }
        if (!await this.accessibilityTest()) return false;
        if (!await this.schema.integrityCheck()) return false;
        if (await this.schema.checkSchemasUpdate()) {
            await this.schema.updateSchema;
        }

        return false;


    }

    async accessibilityTest() {
        try {
            let msg;
            // Test read access, if failure throw error
            await this.test();
            // Test write access on path
            const dir = PathUtils.parent(this._dbPath)!;
            if (!Zotero.File.pathToFile(dir).isWritable()) {
                msg = 'Cannot write to ' + dir + '/';
            }
            // Test write access on database
            else if (!Zotero.File.pathToFile(this._dbPath).isWritable()) {
                msg = 'Cannot write to ' + this._dbPath;
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
            return this.accessibility = false;
        }

        return this.accessibility = true;

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
    async saveDate(tableName: string, dataValues: any[] | any[][], sqlColumns: string[] = []
    ) {
        this.requireTransaction();
        if (sqlColumns.length == 0) {
            const tableColumns = await this.getColumns(tableName);
            if (!tableColumns || tableColumns.length == 0) {
                throw ("Query failed: table colums not found");
            }
            sqlColumns = tableColumns;
        }


        if (!Array.isArray(dataValues[0])) {
            dataValues = [dataValues];
        }
        if (dataValues[0].length != sqlColumns.length) {
            throw ("Colums and Values mismatch");
        }
        for (const sqlValues of dataValues) {
            const sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") "
                + "VALUES (" + sqlValues.map(() => "?").join() + ")";
            await this.queryAsync(sql, sqlValues);
        }


        //const sqlColumns = Object.keys(data);
        //const sqlValues = sqlColumns.map((key) => data[key]);


    }

    async updateDate(tableName: string,
        data: { [columsField: string]: any; },
        record: { [columsField: string]: any; }) {
        const sqlColumns = Object.keys(data);
        const sqlValues = sqlColumns.map((key) => data[key]);
        const condition = Object.keys(record).map(e => e + "=?").join(" AND ");
        const sql = "UPDATE " + tableName + " SET " + sqlColumns.join("=?, ") + "=? WHERE " + condition;
        sqlValues.push(...Object.values(record));
        await this.queryAsync(sql, sqlValues);

    }


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

    while (!addonDB.accessibility) {
        await addonDB.initPromise;
    }
    return addonDB;

}

async function makeDBPath(dbName?: string) {
    //dir.replace(/\/|\\$/gm, '')
    let dir = dbName ? getDir(dbName) : PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
    if (!await IOUtils.exists(dir)) {
        try {
            await IOUtils.makeDirectory(dir);
        }
        catch (e) {
            (addon.mountPoint.popupWin as ProgressWindowHelper).createLine({
                text: e as string,
                type: "default",
            }).show();
            throw (e);
        }
    }
    dir == "." ? dir = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef) : () => { };
    dbName = dbName ? fileNameNoExt(dbName) + ".sqlite" : `${config.addonRef}DB.sqlite`;
    const path = PathUtils.join(dir, dbName!);
    return path;
}

function _checkDataDirAccessError(e: any) {

    if (e.name != 'NS_ERROR_FILE_ACCESS_DENIED' && !e.message.includes('2152857621')) {
        return false;
    }

    let msg = Zotero.getString('dataDir.databaseCannotBeOpened', Zotero.clientName)
        + "\n\n"
        + Zotero.getString('dataDir.checkPermissions', Zotero.clientName);
    if (Zotero.DataDirectory.dir == Zotero.DataDirectory.defaultDir) {
        msg += "\n\n" + Zotero.getString('dataDir.location', Zotero.DataDirectory.dir);
    }

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



/* async function getSchemaSQL(schemaName: string, dir?: string) {
    if (!schemaName) {
        throw ('Schema type not provided to _getSchemaSQL()');
    }
    dir = dir || `chrome://${config.addonRef}/content/schema/`;
    const path = dir + `${schemaName}.sql`;
    return await Zotero.File.getResourceAsync(path);
} */

/* async function bakeupDatebase(addonDB: any) {
    addonDB._externalDB = false;
    return await addonDB.backupDatabase();
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

/* async function integrityCheck(DB: any, fix: boolean, options: any = {}) {
    ztoolkit.log("Checking database schema integrity");
    let checks = [
        [
            // Create any tables or indexes that are missing and delete any tables or triggers
            // that still exist but should have been deleted
            //
            // This is skipped for automatic checks, because it can cause problems with schema
            // update steps that don't expect tables to exist.
            async function () {
                const statementsToRun = [];
                // Get all existing tables, indexes, and triggers
                const sql = "SELECT "
                    + "CASE type "
                    + "WHEN 'table' THEN 'table:' || tbl_name "
                    + "WHEN 'index' THEN 'index:' || name "
                    + "WHEN 'trigger' THEN 'trigger:' || name "
                    + "END "
                    + "FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')";
                const schema = new Set(await DB.columnQueryAsync(sql));

                // Check for deleted tables and triggers that still exist
                const deletedTables = [
                    "transactionSets",
                    "transactions",
                    "transactionLog",
                ];
                const deletedTriggers = [
                    "insert_date_field",
                    "update_date_field",
                ];
                for (const table of deletedTables) {
                    if (schema.has('table:' + table)) {
                        statementsToRun.push("DROP TABLE " + table);
                    }
                }
                for (const trigger of deletedTriggers) {
                    if (schema.has('trigger:' + trigger)) {
                        statementsToRun.push("DROP TRIGGER " + trigger);
                    }
                }

                // Check for missing tables and indexes
                const statements = await DB.parseSQLFile(await getSchemaSQL('translation'));
                for (const statement of statements) {
                    let matches = statement.match(/^CREATE TABLE\s+([^\s]+)/);
                    if (matches) {
                        const table = matches[1];
                        if (!schema.has('table:' + table)) {
                            ztoolkit.log(`Table ${table} is missing`, 2);
                            statementsToRun.push(statement);
                        }
                        continue;
                    }

                    matches = statement.match(/^CREATE INDEX\s+([^\s]+)/);
                    if (matches) {
                        const index = matches[1];
                        if (!schema.has('index:' + index)) {
                            ztoolkit.log(`Index ${index} is missing`, 2);
                            statementsToRun.push(statement);
                        }
                        continue;
                    }
                }

                return statementsToRun.length ? statementsToRun : false;
            },
            async function (statements: any[]) {
                for (const statement of statements) {
                    await DB.queryAsync(statement);
                }
            },
            {
                reconcile: true
            }
        ],

        // Foreign key checks
        [
            async function () {
                const rows = await DB.queryAsync("PRAGMA foreign_key_check");
                if (!rows.length) return false;
                const suffix1 = rows.length == 1 ? '' : 's';
                const suffix2 = rows.length == 1 ? 's' : '';
                ztoolkit.log(`Found ${rows.length} row${suffix1} that violate${suffix2} foreign key constraints`, 1);
                return rows;
            },
            // If fixing, delete rows that violate FK constraints
            async function (rows: any[]) {
                for (const row of rows) {
                    await DB.queryAsync(`DELETE FROM ${row.table} WHERE ROWID=?`, row.rowid);
                }
            }
        ],

        // Can't be a FK with itemTypesCombined
        [
            "SELECT COUNT(*) > 0 FROM items WHERE itemTypeID IS NULL",
            "DELETE FROM items WHERE itemTypeID IS NULL",
        ],

        // Fields not in type
        [
            "SELECT COUNT(*) > 0 FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFieldsCombined WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
            "DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFieldsCombined WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
        ],

        // TEXT userID
        [
            "SELECT COUNT(*) > 0 FROM settings WHERE setting='account' AND key='userID' AND TYPEOF(value)='text'",
            async function () {
                const userID = await DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
                await DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID.trim()));
            }
        ],

    ];

    // Remove reconcile steps
    if (options && options.skipReconcile) {
        //@ts-ignore has
        checks = checks.filter(x => !x[2] || !x[2].reconcile);
    }

    for (const check of checks) {
        let errorsFound = false;
        // SQL statement
        if (typeof check[0] == 'string') {
            errorsFound = await DB.valueQueryAsync(check[0]);
        }
        // Function
        else {
            //@ts-ignore has
            errorsFound = await check[0]();
        }
        if (!errorsFound) {
            continue;
        }

        ztoolkit.log("Test failed!", 1);

        if (fix) {
            try {
                // Single query
                if (typeof check[1] == 'string') {
                    await DB.queryAsync(check[1]);
                }
                // Multiple queries
                else if (Array.isArray(check[1])) {
                    for (const s of check[1]) {
                        await DB.queryAsync(s);
                    }
                }
                // Function
                else {
                    // If data was provided by the check function, pass that to the fix function
                    const checkData = typeof errorsFound != 'boolean' ? errorsFound : null;
                    //@ts-ignore has
                    await check[1](checkData);
                }
                continue;
            }
            catch (e: any) {
                Zotero.logError(e);
                // Clear flag on failure, to avoid showing an error on every startup if someone
                // doesn't know how to deal with it
                await setIntegrityCheckRequired(false, DB);
            }
        }

        return false;
    }

    // Clear flag on success
    if (fix) {
        await setIntegrityCheckRequired(false, DB);
    }

    return true;
}; */


/* async function integrityCheckRequired(DB: any) {
    return !!await DB.valueQueryAsync(
        "SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
    );
}; */

/* async function setIntegrityCheckRequired(required: boolean, DB: any) {
    let sql;
    if (required) {
        sql = "REPLACE INTO settings VALUES ('db', 'integrityCheck', 1)";
    }
    else {
        sql = "DELETE FROM settings WHERE setting='db' AND key='integrityCheck'";
    }
    await DB.queryAsync(sql);
}; */


