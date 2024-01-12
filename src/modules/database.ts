import { config } from "../../package.json";
import { insertLangCode } from "./database/insertLangCode";
import { getDir, getNameNoExt } from "../utils/tools";

export class DB extends Zotero.DBConnection {

    constructor(dbNameOrPath: string) {
        super(dbNameOrPath);
        this.init().then(() => { addon.mountPoing.database = this; });
    }
    async init() {
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
            if (this._checkDataDirAccessError(e)) {
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
        if (!this.dbInitialized) {
            //查表
            const tablesName = await this.queryAsync("select name from sqlite_master where type='table' order by name");
            //const addonDBVersion = await DB.valueQueryAsync("SELECT version FROM version WHERE schema='translation'");
            if (tablesName.length === 0) {
                await this.initializeSchema('translation');
                await insertLangCode(this);
                this.dbInitialized = true;
            } else {
                // 检查数据库是否完整
                const integrityCheck = await this.queryAsync("PRAGMA integrity_check");
                if (integrityCheck[0].integrity_check != 'ok') {
                    ztoolkit.log(Zotero.getString('startupError.databaseIntegrityCheckFailed'));
                }
                this.dbInitialized = true;
            }

        };
    }
    async initializeSchema(schemaName: string) {
        await this.executeTransaction(async () => {
            try {
                await this.queryAsync("PRAGMA page_size = 4096");
                await this.queryAsync("PRAGMA encoding = 'UTF-8'");
                await this.queryAsync("PRAGMA auto_vacuum = 1");
                const sql = await getSchemaSQL(schemaName);
                await this.executeSQLFile(sql);
            }
            catch (e) {
                ztoolkit.log(e, 1);
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

    _checkDataDirAccessError(e: any) {
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

    /**
     * 
     * @param schema 
     * @param dir option default:chrome://${config.addonRef}/content/
     * @returns 
     */
    async getSchemaSQL(schemaName: string, dir?: string) {
        if (!schemaName) {
            throw ('Schema type not provided to _getSchemaSQL()');
        }
        dir = dir || `chrome://${config.addonRef}/content/schema/`;
        const path = dir + `${schemaName}.sql`;
        return await Zotero.File.getResourceAsync(path);
    }

    async bakeupDB() {
        this._externalDB = false;
        const result = await this.backupDatabase();
        this._externalDB = true;
        return result;
    }


    /**
     * 创建临时表，新建表，导入数据，删除旧表
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

    async saveDate(tableName: string,
        data: {
            [columsField: string]: any;
        }) {
        const sqlColumns = Object.keys(data);
        const sqlValues = sqlColumns.map((key) => data[key]);
        const sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") "
            + "VALUES (" + sqlValues.map(() => "?").join() + ")";
        await this.queryAsync(sql, sqlValues);

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

    async integrityCheck(DB: any, fix: boolean, options: any = {}) {
        ztoolkit.log("Checking database schema integrity");

        // Just as a sanity check, make sure combined field tables are populated,
        // so that we don't try to wipe out all data
        //if (!(await DB.valueQueryAsync("SELECT COUNT(*) FROM fieldsCombined"))
        //    || !(await DB.valueQueryAsync("SELECT COUNT(*) FROM itemTypeFieldsCombined"))) {
        //    ztoolkit.log("Combined field tables are empty -- skipping integrity check");
        //    return false;
        //}



        // The first position is for testing and the second is for repairing. Can be either SQL
        // statements or promise-returning functions. For statements, the repair entry can be either
        // a string or an array with multiple statements. Check functions should return false if no
        // error, and either true or data to pass to the repair function on error. Functions should
        // avoid assuming any global state (e.g., loaded data).
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
    };


    async integrityCheckRequired(DB: any) {
        return !!await DB.valueQueryAsync(
            "SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
        );
    };

    async setIntegrityCheckRequired(required: boolean, DB: any) {
        let sql;
        if (required) {
            sql = "REPLACE INTO settings VALUES ('db', 'integrityCheck', 1)";
        }
        else {
            sql = "DELETE FROM settings WHERE setting='db' AND key='integrityCheck'";
        }
        await DB.queryAsync(sql);
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
    //dir.replace(/\/|\\$/gm, '')
    let dir = dbName ? getDir(dbName) : PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
    if (!await IOUtils.exists(dir)) {
        await IOUtils.makeDirectory(dir);
    }
    dir == "." ? dir = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef) : () => { };
    dbName = dbName ? getNameNoExt(dbName) + ".sqlite" : `${config.addonRef}DB.sqlite`;
    const path = PathUtils.join(dir, dbName!);
    // 创建数据库实例
    addonDB = new DB(path);
    if (!addonDB.dbInitialized) {
        await addonDB.init();
    }
    return addonDB;

    /*     try {
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
            //const addonDBVersion = await DB.valueQueryAsync("SELECT version FROM version WHERE schema='translation'");
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
                    const sql = await getSchemaSQL('translation');
                    await DB.executeSQLFile(sql);
                    await insertLangCode(DB);
                    DB.dbInitialized = true;
                }
                catch (e) {
                    ztoolkit.log(e, 1);
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
        } */
}

/**
 * 
 * @param schema 
 * @param dir option default:chrome://${config.addonRef}/content/
 * @returns 
 */
async function getSchemaSQL(schemaName: string, dir?: string) {
    if (!schemaName) {
        throw ('Schema type not provided to _getSchemaSQL()');
    }
    dir = dir || `chrome://${config.addonRef}/content/schema/`;
    const path = dir + `${schemaName}.sql`;
    return await Zotero.File.getResourceAsync(path);
}

async function bakeupDatebase(addonDB: any) {
    addonDB._externalDB = false;
    return await addonDB.backupDatabase();
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
        await DB.queryAsync(sql, env.sqlValues);
    }
}

async function integrityCheck(DB: any, fix: boolean, options: any = {}) {
    ztoolkit.log("Checking database schema integrity");

    // Just as a sanity check, make sure combined field tables are populated,
    // so that we don't try to wipe out all data
    //if (!(await DB.valueQueryAsync("SELECT COUNT(*) FROM fieldsCombined"))
    //    || !(await DB.valueQueryAsync("SELECT COUNT(*) FROM itemTypeFieldsCombined"))) {
    //    ztoolkit.log("Combined field tables are empty -- skipping integrity check");
    //    return false;
    //}



    // The first position is for testing and the second is for repairing. Can be either SQL
    // statements or promise-returning functions. For statements, the repair entry can be either
    // a string or an array with multiple statements. Check functions should return false if no
    // error, and either true or data to pass to the repair function on error. Functions should
    // avoid assuming any global state (e.g., loaded data).
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
};


async function integrityCheckRequired(DB: any) {
    return !!await DB.valueQueryAsync(
        "SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
    );
};

async function setIntegrityCheckRequired(required: boolean, DB: any) {
    let sql;
    if (required) {
        sql = "REPLACE INTO settings VALUES ('db', 'integrityCheck', 1)";
    }
    else {
        sql = "DELETE FROM settings WHERE setting='db' AND key='integrityCheck'";
    }
    await DB.queryAsync(sql);
};


