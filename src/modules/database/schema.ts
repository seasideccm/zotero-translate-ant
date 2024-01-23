/*
adapted from Zotero
*/

import { schemaConfig } from "../../utils/constant";
import { version as addonVersion, config } from "../../../package.json";
import { fileNameNoExt, showInfo } from "../../utils/tools";
import { DB } from "../database";
import { OS } from "../../utils/tools";



export class Schema {
    initialized: boolean;
    _schemaUpdateDeferred: any;
    schemaUpdatePromise: any;
    minorUpdateFrom: number;
    //数据库结构兼容插件（软件）的最大版本号
    _maxCompatibility: number;
    _localUpdateInProgress: boolean;
    isCompatible: boolean | null;
    DB: DB;

    constructor() {

        this.initialized = false;
        this._schemaUpdateDeferred = Zotero.Promise.defer();
        this.schemaUpdatePromise = this._schemaUpdateDeferred.promise;
        // If updating from this userdata version or later, don't show "Upgrading database…" and don't make
        // DB backup first. This should be set to false when breaking compatibility or making major changes.
        this.minorUpdateFrom = 1;
        //最大兼容版本号，锚定 zotero 大版本号，代表该版本插件的数据库兼容性。
        //若大于当前 zotero 版本，代表兼容下一个新版本的 zotero 或插件所采用的数据库结构。
        //若旧数据库的兼容版本号大于该值，说明目前安装的为旧版插件，数据库需要降级。
        this._maxCompatibility = 7;
        this._localUpdateInProgress = false;
        this.isCompatible = null;
        this.DB = addon.mountPoint.database;

    }
    async checkInitialized() {
        if (this.initialized) return true;
        const sql = "SELECT value FROM settings WHERE setting='schema' AND key='initialized'";
        try {
            const queryResult = await this.DB.valueQueryAsync(sql);
            if (queryResult) {
                this.initialized = true;
            }
        }
        catch (e: any) {
            ztoolkit.log(e);
            showInfo(e);
        }
        return this.initialized;
    };


    async checkCompat() {
        const compatibility = await this.getSchemaVersion("compatibility");
        if (!compatibility) {
            //初始化成功，最后返回兼容性为true
            try {
                await this.initializeSchema();
            }
            catch (e) {
                return this.isCompatible = false;
            }
        }
        //如果安装不兼容的旧版插件，将导致
        //当前数据库兼容版本号大于现有的插件数据库兼容版本号。
        //考虑数据库降级或使用之前备份的数据库。
        if (compatibility > this._maxCompatibility) {
            const dbAddonVersion = await this.DB.valueQueryAsync(
                "SELECT value FROM settings "
                + "WHERE setting='addon' AND key='lastCompatibleVersion'"
            );
            const msg = "Database is incompatible with this addon " + dbAddonVersion + " version. 考虑数据库降级或使用之前备份的数据库。"
                + `(${compatibility} > ${this._maxCompatibility})`;
            addon.mountPoint.popupWin.createLine({
                text: msg,
                type: "default",
            }).show();
            ztoolkit.log(msg);
            return this.isCompatible = false;

        }
        return this.isCompatible = true;
    }
    /**
     * Fetch the schema version from current version table of database
     * @param schema 
     * @returns 
     */
    async getSchemaVersion(schema: string) {

        const sql = "SELECT version FROM version WHERE schema='" + schema + "'";
        return this.DB.valueQueryAsync(sql)
            .then((dbSchemaVersion: any) => {
                if (dbSchemaVersion) {
                    dbSchemaVersion = parseInt(dbSchemaVersion);
                }
                return dbSchemaVersion;
            })
            .catch((e: any) => {
                return this.DB.tableExists('version')
                    .then((exists: any) => {
                        if (exists) {
                            throw e;
                        }
                        return false;
                    });
            });
    }

    /**
    * Fetch the schema version from the first line of the file
    * @param schema 
    * @returns 
    */
    async getSchemaSQLVersion(schema: string) {
        const sql = await this.getSchemaSQL(schema);
        // @ts-ignore has
        const schemaVersion = parseInt(sql.match(/^-- ([0-9]+)/)[1]);
        return schemaVersion;
    }

    //检查表并更新
    async checkSchemasUpdate() {
        for (const schema of Object.keys(schemaConfig)) {
            if (await this.checkUpdate(schema)) {
                try {
                    if (!await this.updateSchema(schema)) {
                        throw ("fail auto Update Schema ");
                    };
                } catch (e: any) {
                    ztoolkit.log(e);
                    throw (e);
                }
            }
        };
        return true;
    }


    /**
     * 比较sql文件与数据库存储的版本信息
     * @param schema 
     * @returns 
     */
    async checkUpdate(schema: string) {
        const dbSchemaVersion = await this.getSchemaVersion(schema);
        if (!dbSchemaVersion) return true;
        const schemaVersion = schemaConfig[schema as keyof typeof schemaConfig].version;
        if (dbSchemaVersion == schemaVersion) {
            return false;
        }
        if (dbSchemaVersion > schemaVersion) {
            const dbAddonVersion = await this.DB.valueQueryAsync(
                "SELECT value FROM settings WHERE setting='addon' AND key='lastCompatibleVersion'"
            );
            throw new Error(`Addon ${schema} DB version (${dbSchemaVersion}) is newer than SQL file (${schemaVersion}). 不兼容：数据库 ${schema} 表的版本大于 SQL 文件的版本号。`);
        }
        return true;
    }
    async isEmptyDB() {
        const tableNames = await this.DB.queryAsync("SELECT name FROM sqlite_master");
        return tableNames.length == 0 ? true : false;

    }
    async updateSchema(schema: string, options: any = {}) {
        if (this.isCompatible == null) {
            await this.checkCompat();
        }
        if (!this.isCompatible) {
            const msg = "Database is incompatible with " + config.addonName + " " + addonVersion + " version.";
            Zotero.debug(msg);
            addon.mountPoint.popupWin.createLine({
                text: msg,
                type: "default",
            }).show();
            throw (msg);
        }
        const schemaVersion = await this.getSchemaVersion(schema);
        if (!schemaVersion) {
            if (await this.isEmptyDB()) {
                //如果数据库为空则初始化
                const msg = 'database does not exist any schema -- creating\n';
                Zotero.debug(msg);
                addon.mountPoint.popupWin.createLine({
                    text: msg,
                    type: "default",
                }).show();
                try {
                    await this.initializeSchema();
                }
                catch (e) {
                    return false;
                }
            } else {
                const msg = schema + ' schema does not exist -- creating\n';
                Zotero.debug(msg);
                addon.mountPoint.popupWin.createLine({
                    text: msg,
                    type: "default",
                }).show();
                try {
                    await this.DB.executeTransaction(async function (this: any) {
                        await this.doUpdateSchema(schema);
                    }.bind(this));
                }
                catch (e) {
                    return false;
                }
            }
            return true;
        }


        // Check if DB is coming from the DB Repair Tool and should be checked
        // 当数据库连接出现问题，则设置下次启动数据库执行完整性检查（todo）
        const integrityCheckRequired = await this.integrityCheckRequired();
        // Check whether bundled userdata schema has been updated
        // sql 文件开头的版本号应当和 schemaConfig的常量相同
        const schemaSqlFileVersion = await this.getSchemaSQLVersion(schema);
        options.minor = this.minorUpdateFrom && schemaVersion >= this.minorUpdateFrom;

        // If non-minor userdata upgrade, make backup of database first
        if (schemaVersion < schemaSqlFileVersion && !options.minor) {
            await this.DB.bakeupDB(schema + schemaVersion, true);
        }
        // Automatic backup
        else if (integrityCheckRequired) {
            await this.DB.bakeupDB(false, true);
        }

        const logLines: any[] = [];
        const listener = function (line: any) {
            logLines.push(line);
        };
        Zotero.Debug.addListener(listener);

        let updated;
        await this.DB.queryAsync("PRAGMA foreign_keys = false");
        try {
            // Auto-repair databases flagged for repair or coming from the DB Repair Tool
            //
            // If we need to run migration steps, skip the check until after the update, since
            // the integrity check is expecting to run on the current data model.
            let integrityCheckDone = false;
            const toVersion = schemaSqlFileVersion;
            if (integrityCheckRequired && schemaVersion >= toVersion) {
                await this.integrityCheck(true);
                integrityCheckDone = true;
            }
            updated = await this.DB.executeTransaction(async function (this: any, conn: any) {
                //如果数据表存在动态写入的数据则需要数据迁移
                //如果表建立以后数据不再变动，则执行sql文件重建表
                let updated;
                if (['triggers'].includes(schema)) {
                    updated = await this.doUpdateSchema(schema);
                } else {
                    updated = await this.migrateSchema(schema, schemaVersion, toVersion, options);
                }
                return updated;
            }.bind(this));

            // If we updated the DB, also do an integrity check for good measure
            if (updated && !integrityCheckDone) {
                await this.integrityCheck(true);
            }

        }
        catch (e) {
            this._schemaUpdateDeferred.reject(e);
        }
        finally {
            await this.DB.queryAsync("PRAGMA foreign_keys = true");
            Zotero.Debug.removeListener(listener);

            // If upgrade succeeded or failed (but not if there was nothing to do), save a log file
            // in logs/upgrade.log in the data directory
            if (updated || updated === undefined) {
                Zotero.getSystemInfo()
                    .then(async function (sysInfo) {
                        const logDir = OS.Path.join(Zotero.DataDirectory.dir, 'logs');
                        Zotero.File.createDirectoryIfMissing(logDir);

                        await OS.Path;
                        const output = Zotero.getErrors(true).join('\n\n')
                            + "\n\n" + sysInfo + "\n\n"
                            + "=========================================================\n\n"
                            + logLines.join('\n\n');
                        return Zotero.File.putContentsAsync(
                            OS.Path.join(logDir, 'upgrade.log'),
                            output
                        );
                    });
            }
        }

        if (updated) {
            // Upgrade seems to have been a success -- delete any previous backups
            const maxPrevious = schemaVersion - 1;
            const file = Zotero.File.pathToFile(PathUtils.parent(this.DB._dbPath)!);
            const toDelete = [];
            try {
                const files = file.directoryEntries;
                while (files.hasMoreElements()) {
                    const file = files.getNext();
                    file.QueryInterface(Components.interfaces.nsIFile);
                    if (file.isDirectory()) {
                        continue;
                    }
                    const matches = file.leafName.match(/zotero\.sqlite\.([0-9]{2,})\.bak/);
                    if (!matches) {
                        continue;
                    }
                    if (matches[1] >= 28 && matches[1] <= maxPrevious) {
                        toDelete.push(file);
                    }
                }
                for (const file of toDelete) {
                    Zotero.debug('Removing previous backup file ' + file.leafName);
                    file.remove(false);
                }
            }
            catch (e) {
                Zotero.debug(e);
            }
        }

        // Reset sync queue tries if new version
        await this.checkAddonVersionChange();
        this._schemaUpdateDeferred.resolve(true);
        return updated;
    };

    migrate: any = {
        addonSystem: async function (fromVersion: number, toVersion: number) {
            ztoolkit.log("is schema, this._maxCompatibility=", this._maxCompatibility, "fromVersion=", fromVersion);
            // 表结构和数据按版本逐一升级
            for (let i = fromVersion + 1; i <= toVersion; i++) {
                if (i == 2) {
                    //参数是数据库兼容的 zotero 大版本
                    await this.updateCompatibility(7);

                    //修改值

                    //await this.DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID));

                    //await this.DB.queryAsync("DELETE FROM libraries WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM groups)");

                    //修改表结构，表重名名，新建表，插入数据，保留或删除旧表
                    //await this.DB.queryAsync("ALTER TABLE libraries RENAME TO librariesOld");
                    //await this.DB.queryAsync("CREATE TABLE libraries (\n    libraryID INTEGER PRIMARY KEY,\n    type TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    lastSync INT NOT NULL DEFAULT 0,\n    lastStorageSync INT NOT NULL DEFAULT 0\n)");
                    //await this.DB.queryAsync("INSERT INTO libraries (libraryID, type, editable, filesEditable) VALUES (1, 'user', 1, 1)");                
                    //await this.DB.queryAsync("INSERT INTO libraries SELECT libraryID, libraryType, editable, filesEditable, 0, 0, 0 FROM librariesOld JOIN groups USING (libraryID)");

                    //删除触发器
                    //await this.DB.queryAsync("DROP TRIGGER IF EXISTS fki_annotations_itemID_itemAttachments_itemID");                
                    //建立索引
                    //await this.DB.queryAsync("CREATE INDEX collections_synced ON collections(synced)");
                    //更新旧表数据，新表导入数据
                    //await this.DB.queryAsync("UPDATE syncedSettingsOld SET libraryID=1 WHERE libraryID=0");
                    //await this.DB.queryAsync("INSERT OR IGNORE INTO syncedSettings SELECT * FROM syncedSettingsOld");
                    //删除索引，重建索引
                    //await this.DB.queryAsync("DROP INDEX IF EXISTS itemData_fieldID");
                    //await this.DB.queryAsync("CREATE INDEX itemData_fieldID ON itemData(fieldID)");
                    //执行函数
                    //await _migrateUserData_80_filePaths();
                    //删除旧表
                    //await this.DB.queryAsync("DROP TABLE annotationsOld");
                }


                else if (i == 122) {
                    //替换值
                    //await this.DB.queryAsync("REPLACE INTO fileTypes VALUES(8, 'ebook')");
                    //await this.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(8, 'application/epub+zip')");

                }
            }
            return true;
        },

        translation: function (fromVersion: number, toVersion: number) {
            return true;
        },
        //xx: () => {    },
    };

    async migrateSchema(schema: string, fromVersion: number, toVersion: number, options: any = {}) {
        //const toVersion = await this.getSchemaSQLVersion(schema);

        if (fromVersion >= toVersion) {
            return false;
        }

        Zotero.debug('Updating' + schema + 'data tables from version ' + fromVersion + ' to ' + toVersion);

        if (options.onBeforeUpdate) {
            const maybePromise = options.onBeforeUpdate({ minor: options.minor });
            if (maybePromise && maybePromise.then) {
                await maybePromise;
            }
        }
        this.DB.requireTransaction();
        if (!this.migrate[schema]) {
            return false;
        }
        this.migrate[schema].apply(this, [fromVersion, toVersion]);
        await this.updateSchemaVersion(schema, toVersion);
        return true;
    };

    /**
     * 执行 sql 文件，创建数据表
     * Requires a transaction
     * @param schema 
     * @returns 
     */
    async doUpdateSchema(schema: string) {
        this.DB.requireTransaction();
        if (!await this.checkUpdate(schema)) return false;
        const schemaVersion: string = String(await this.getSchemaSQLVersion(schema));
        const sql = await this.getSchemaSQL(schema);
        await this.DB.executeSQLFile(sql);
        await this.updateSchemaVersion(schema, schemaVersion);
        return true;
    };

    async integrityCheckRequired() {
        await this.DB.valueQueryAsync(
            "SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
        );
        return !!await this.DB.valueQueryAsync(
            "SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
        );
    };

    /**
     * 检查表是否缺失，删除无用表，检查外键约束，可选自动修复
     *  
     * @param {Boolean} [fix=true] default true
     * @param {Object} [options]
     * @param {Boolean} [options.skipReconcile=false] - Don't reconcile the schema to create tables
     *     and indexes that should have been created and drop existing ones that should have been
     *     deleted
     */
    async integrityCheck(fix: boolean = true, options: any = {}) {
        Zotero.debug(`Checking ${config.addonRef} database schema integrity`);
        let checks: any[] = [
            [
                // Create any tables or indexes that are missing and delete any tables or triggers
                // that still exist but should have been deleted
                //
                // This is skipped for automatic checks, because it can cause problems with schema
                // update steps that don't expect tables to exist.
                async function (this: any) {
                    const statementsToRun = [];

                    // Get all existing tables, indexes, and triggers
                    const sql = "SELECT "
                        + "CASE type "
                        + "WHEN 'table' THEN 'table:' || tbl_name "
                        + "WHEN 'index' THEN 'index:' || name "
                        + "WHEN 'trigger' THEN 'trigger:' || name "
                        + "END "
                        + "FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')";
                    const schema = new Set(await this.DB.columnQueryAsync(sql));

                    // Check for deleted tables and triggers that still exist
                    // 事务相关
                    const deletedTables = [
                        "transactionSets",
                        "transactions",
                        "transactionLog",
                    ];
                    // 操作相关
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
                    let statements: any[] = [];
                    for (const schemaName of Object.keys(schemaConfig)) {
                        const sqls = await this.DB.parseSQLFile(await this.getSchemaSQL(schemaName));
                        statements = statements.concat(sqls);
                    }
                    for (const statement of statements) {
                        let matches = statement.match(/^CREATE TABLE\s+([^\s]+)/);
                        if (matches) {
                            const table = matches[1];
                            if (!schema.has('table:' + table)) {
                                Zotero.debug(`Table ${table} is missing`, 2);
                                statementsToRun.push(statement);
                            }
                            continue;
                        }

                        matches = statement.match(/^CREATE INDEX\s+([^\s]+)/);
                        if (matches) {
                            const index = matches[1];
                            if (!schema.has('index:' + index)) {
                                Zotero.debug(`Index ${index} is missing`, 2);
                                statementsToRun.push(statement);
                            }
                            continue;
                        }
                    }

                    return statementsToRun.length ? statementsToRun : false;
                }.bind(this),
                async function (this: any, statements: any) {
                    for (const statement of statements) {
                        await this.DB.queryAsync(statement);
                    }
                }.bind(this),
                {
                    //用于指示数据库模式完整性检查函数是否应该执行对数据库模式的调和操作。这意味着在执行完整性检查时，如果设置了 reconcile: true，函数将尝试创建缺失的表或索引，并删除应该被删除的现有表或触发器。这有助于确保数据库模式的一致性和完整性。
                    reconcile: true
                }
            ],

            // Foreign key checks
            [
                async function (this: any) {
                    const rows = await this.DB.queryAsync("PRAGMA foreign_key_check");
                    if (!rows.length) return false;
                    const suffix1 = rows.length == 1 ? '' : 's';
                    const suffix2 = rows.length == 1 ? 's' : '';
                    Zotero.debug(`Found ${rows.length} row${suffix1} that violate${suffix2} foreign key constraints`, 1);
                    return rows;
                }.bind(this),
                // If fixing, delete rows that violate FK constraints
                async function (this: any, rows: any) {
                    for (const row of rows) {
                        await this.DB.queryAsync(`DELETE FROM ${row.table} WHERE ROWID=?`, row.rowid);
                    }
                }.bind(this)
            ],

        ];

        // Remove reconcile steps
        if (options && options.skipReconcile) {
            checks = checks.filter(x => !x[2] || !x[2].reconcile);
        }

        for (const check of checks) {
            let errorsFound = false;
            // SQL statement
            if (typeof check[0] == 'string') {
                errorsFound = await this.DB.valueQueryAsync(check[0]);
            }
            // Function
            else {
                errorsFound = await check[0]();
            }
            if (!errorsFound) {
                continue;
            }

            Zotero.debug("Test failed!", 1);

            if (fix) {
                try {
                    // Single query
                    if (typeof check[1] == 'string') {
                        await this.DB.queryAsync(check[1]);
                    }
                    // Multiple queries
                    else if (Array.isArray(check[1])) {
                        for (const s of check[1]) {
                            await this.DB.queryAsync(s);
                        }
                    }
                    // Function
                    else {
                        // If data was provided by the check function, pass that to the fix function
                        const checkData = typeof errorsFound != 'boolean' ? errorsFound : null;
                        await check[1](checkData);
                    }
                    //成功
                    continue;
                }
                catch (e) {
                    Zotero.logError(e as any);
                    // Clear flag on failure, to avoid showing an error on every startup if someone
                    // doesn't know how to deal with it
                    await this.setIntegrityCheckRequired(false);
                }
            }
            //失败
            return false;
        }

        // Clear flag on success
        if (fix) {
            await this.setIntegrityCheckRequired(false);
        }
        return true;
    };

    async setIntegrityCheckRequired(required: boolean) {
        let sql;
        if (required) {
            sql = "REPLACE INTO settings VALUES ('db', 'integrityCheck', 1)";
        }
        else {
            sql = "DELETE FROM settings WHERE setting='db' AND key='integrityCheck'";
        }
        await Zotero.DB.queryAsync(sql);
    };

    /**
     * 
     * @param schema 
     * @param dir option default:chrome://${config.addonRef}/content/schema/
     * @returns Promise<string>
     */
    getSchemaSQL(schema: string, dir?: string) {
        if (!schema) {
            throw ('Schema type not provided to this.getSchemaSQL()');
        }
        dir = dir || `chrome://${config.addonRef}/content/schema/`;
        schema = fileNameNoExt(schema);
        const path = dir + `${schema}.sql`;

        return Zotero.File.getResourceAsync(path);
    }
    //doInitSchema()
    async initializeSchema() {
        await this.DB.executeTransaction(async function (this: any) {
            try {
                //避免循环
                await this.DB.queryAsync("PRAGMA page_size = 4096");
                await this.DB.queryAsync("PRAGMA encoding = 'UTF-8'");
                await this.DB.queryAsync("PRAGMA auto_vacuum = 1");
                let sql: string;
                sql = await this.getSchemaSQL("addonSystem");
                await this.DB.executeSQLFile(sql);
                sql = await this.getSchemaSQL("apiAccount");
                await this.DB.executeSQLFile(sql);
                sql = await this.getSchemaSQL("translation");
                await this.DB.executeSQLFile(sql);
                sql = await this.getSchemaSQL("triggers");
                await this.DB.executeSQLFile(sql);
                let version;
                version = schemaConfig["addonSystem"]["version"];
                await this.updateSchemaVersion("addonSystem", version);
                version = schemaConfig["apiAccount"]["version"];
                await this.updateSchemaVersion("apiAccount", version);
                version = schemaConfig["translation"]["version"];
                await this.updateSchemaVersion("translation", version);
                version = schemaConfig["triggers"]["version"];
                await this.updateSchemaVersion("triggers", version);
                //await this.updateLastAddonVersion();
                sql = "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastVersion', ?)";
                await this.DB.queryAsync(sql, addonVersion);
                await this.updateCompatibility(this._maxCompatibility);
                this.isCompatible = true;
                await this.DB.queryAsync("INSERT INTO settings (setting, key, value) VALUES ('schema', 'initialized', ?)", 1);
                this.initialized = true;
            }
            catch (e) {
                ztoolkit.log(e);
                reportError(e);
                throw e;
            }

        }.bind(this));


        /* await this.DB.executeTransaction(async function (this: any) {
            try {
                await this.DB.queryAsync("PRAGMA page_size = 4096");
                await this.DB.queryAsync("PRAGMA encoding = 'UTF-8'");
                await this.DB.queryAsync("PRAGMA auto_vacuum = 1");
                const promises = [];
                const promisesFollow = [];
                for (const schema of Object.keys(schemaConfig)) {
                    const sql = await this.getSchemaSQL(schema);
                    if (schema != "triggers") {
                        promises.push(this.DB.executeSQLFile(sql));
                    }

                }
                await Promise.all(promises);               

                for (const schema of Object.keys(schemaConfig)) {
                    const version = schemaConfig[schema]["version"];
                    if (schema != "triggers") {
                    promisesFollow.push(this.updateSchemaVersion(schema, version));}
                }
                await Promise.all(promisesFollow);
                await this.updateLastAddonVersion();
                await this.updateCompatibility(this._maxCompatibility);
                this.isCompatible = true;
                await this.DB.queryAsync("INSERT INTO settings (setting, key, value) VALUES ('schema', 'initialized', ?)", 1);
                this.initialized = true;
            }
            catch (e) {
                ztoolkit.log(e);
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

        }.bind(this)); */

    };



    /*
     * Update a DB schema version tag in an existing database
     */
    async updateSchemaVersion(schema: string, version: string | number) {
        const sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
        if (typeof version == "string") {
            version = parseInt(version);
        }
        return this.DB.queryAsync(sql, [schema, version]);
    }

    async updateCompatibility(version: number) {
        if (version > this._maxCompatibility) {
            throw new Error("Can't set compatibility greater than _maxCompatibility");
        }
        await this.DB.queryAsync(
            "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastCompatibleVersion', ?)", [addonVersion]
        );
        await this.updateSchemaVersion('compatibility', version);
    };

    async checkAddonVersionChange() {
        const lastVersion = await this.getLastAddonVersion();
        const currentVersion = addonVersion;
        if (currentVersion == lastVersion) {
            return false;
        }
        return true;
    }

    getLastAddonVersion() {
        const sql = "SELECT value FROM settings WHERE setting='addon' AND key='lastVersion'";
        return this.DB.valueQueryAsync(sql);
    }

    /**
     * 检查表完整性，检查表更新，更新插件版本号
     * @returns 
     */
    async updateLastAddonVersion() {
        await this.integrityCheck();
        if (!await this.checkSchemasUpdate()) { throw ("Failed  Check Schemas Update"); };
        const result = await this.DB.executeTransaction(
            async function (this: any) {
                const sql = "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastVersion', ?)";
                const result = await this.DB.queryAsync(sql, addonVersion);
                return result;
            }.bind(this));
        return result;
    }

    //todo reverse update
    //rollBack() {    }
}



function reportError(e: any) {
    Components.utils.reportError(e);
    const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);
    ps.alert(
        null,
        Zotero.getString('general.error'),
        Zotero.getString('startupError', Zotero.appName)
    );

}
