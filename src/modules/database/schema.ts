
import { MAX_COMPATIBILITY, MINOR_UPDATE_FROM, SCHEMA_NAMES } from "../../utils/const";
import { version as addonVersion, config } from "../../../package.json";
import { fileNameNoExt } from "../../utils/tools";
import { DB } from "../database";





export class Schema {
    dbInitialized: boolean;
    _schemaUpdateDeferred: any;
    schemaUpdatePromise: any;
    _schemaVersions: any;
    minorUpdateFrom: number;
    //数据库结构兼容插件（软件）的最大版本号
    _maxCompatibility: number;
    _localUpdateInProgress: boolean;
    isCompatible: boolean | null;
    DB: DB;

    constructor() {
        this.dbInitialized = false;
        this._schemaUpdateDeferred = Zotero.Promise.defer();
        this.schemaUpdatePromise = this._schemaUpdateDeferred.promise;
        this.minorUpdateFrom = MINOR_UPDATE_FROM;
        this._maxCompatibility = MAX_COMPATIBILITY;
        this._localUpdateInProgress = false;
        this._schemaVersions = {};
        this.isCompatible = null;
        this.checkCompat();
        this.DB = addon.mountPoint.database;
    }



    async checkCompat() {
        const compatibility = await this.getSchemaVersion("compatibility");
        //当前数据库兼容版本号大于插件的数据库兼容版本号。
        //可能之前安装过最新插件，现在又想使用旧版。考虑数据库降级或使用之前备份的数据库。
        if (compatibility > this._maxCompatibility) {
            const dbAddonVersion = await this.DB.valueQueryAsync(
                "SELECT value FROM settings "
                + "WHERE setting='addon' AND key='lastCompatibleVersion'"
            );
            const msg = "Database is incompatible with this addon version. 可能之前安装过最新插件，现在又想使用旧版。考虑数据库降级或使用之前备份的数据库。"
                + `(${compatibility} > ${this._maxCompatibility})`;
            ztoolkit.log(msg);
            return false;
        }
        return true;
    }
    /**
     * Fetch the schema version from current version table of database
     * @param schema 
     * @returns 
     */
    getSchemaVersion(schema: string) {
        if (this._schemaVersions && this._schemaVersions[schema]) {
            //@ts-ignore has
            return Zotero.Promise.resolve(this._schemaVersions[schema]);
        }

        const sql = "SELECT version FROM version WHERE schema='" + schema + "'";
        return this.DB.valueQueryAsync(sql)
            .then((dbSchemaVersion: any) => {
                if (dbSchemaVersion) {
                    dbSchemaVersion = parseInt(dbSchemaVersion);
                    this._schemaVersions[schema] = dbSchemaVersion;
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
        this._schemaVersions[schema] = schemaVersion;
        return schemaVersion;
    }
    updateRequired() {

    }

    async updateSchema(schema: string, options: any = {}) {
        if (typeof this.isCompatible == "undefined") {
            this.isCompatible = await this.checkCompat();
        }
        if (!this.isCompatible) throw "not Compatible";

        schema = schema || 'translation';
        const schemaVersion = await this.getSchemaVersion(schema);

        if (!schemaVersion) {
            Zotero.debug('Database does not exist -- creating\n');
            return this.initializeSchema();
        }


        // Check if DB is coming from the DB Repair Tool and should be checked
        const integrityCheckRequired = await this.integrityCheckRequired();
        // Check whether bundled userdata schema has been updated
        const schemaSqlFileVersion = await this.getSchemaSQLVersion(schema);
        options.minor = this.minorUpdateFrom && schemaVersion >= this.minorUpdateFrom;

        // If non-minor userdata upgrade, make backup of database first
        if (schemaVersion < schemaSqlFileVersion && !options.minor) {
            await this.DB.bakeupDB(schemaVersion, true);
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
            const toVersion = await this.getSchemaSQLVersion(schema);
            if (integrityCheckRequired && schemaVersion >= toVersion) {
                await this.integrityCheck(true);
                integrityCheckDone = true;
            }


            updated = await this.DB.executeTransaction(async function (this: any, conn: any) {
                let updated = await this.doUpdateSchema(schema);
                updated = await this.migrateSchema(schemaVersion, options);
                await this.doUpdateSchema('triggers');
                return updated;
            }.bind(this));

            // If we updated the DB, also do an integrity check for good measure
            if (updated && !integrityCheckDone) {
                await this.integrityCheck(true);
            }

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
            const file = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
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
        await this.checkAddonVersion();
        return updated;
    };




    async integrityCheckRequired() {
        return !!await this.DB.valueQueryAsync(
            "SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
        );
    };



    /**
     * @param {Boolean} [fix=false]
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
                    for (const schemaName of SCHEMA_NAMES) {
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
                    continue;
                }
                catch (e) {
                    Zotero.logError(e as any);
                    // Clear flag on failure, to avoid showing an error on every startup if someone
                    // doesn't know how to deal with it
                    await this.setIntegrityCheckRequired(false);
                }
            }

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


    async doInitSchema() {
        try {
            // Enable auto-vacuuming
            await this.DB.queryAsync("PRAGMA page_size = 4096");
            await this.DB.queryAsync("PRAGMA encoding = 'UTF-8'");
            await this.DB.queryAsync("PRAGMA auto_vacuum = 1");

            const sqlFiles = SCHEMA_NAMES;
            for (const schema of sqlFiles) {
                const sql = await this.getSchemaSQL(schema);
                await this.DB.executeSQLFile(sql);
                //@ts-ignore has
                const version = parseInt(sql.match(/^-- ([0-9]+)/)[1]);
                this._schemaVersions[schema] = version;
                await this.updateSchemaVersion(schema, version);
            }
            await this.updateLastAddonVersion();
            await this.updateCompatibility(this._maxCompatibility);
            this.dbInitialized = true;
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
    };

    async initializeSchema() {
        await this.DB.executeTransaction(this.doInitSchema.bind(this));
    }


    /*
     * Update a DB schema version tag in an existing database
     */
    async updateSchemaVersion(schema: string, version: string | number) {
        this._schemaVersions[schema] = version;
        const sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
        version = String(version);
        return this.DB.queryAsync(sql, [schema, parseInt(version)]);
    }


    /**
     * Requires a transaction
     */
    async doUpdateSchema(schema: string) {
        const dbSchemaVersion = await this.getSchemaVersion(schema);
        const schemaVersion: string = String(await this.getSchemaSQLVersion(schema));
        if (dbSchemaVersion == schemaVersion) {
            return false;
        }
        if (dbSchemaVersion > schemaVersion) {
            const dbAddonVersion = await this.DB.valueQueryAsync(
                "SELECT value FROM settings WHERE setting='addon' AND key='lastCompatibleVersion'"
            );
            throw new this.DB.IncompatibleVersionException(
                `Addon '${schema}' DB version (${dbSchemaVersion}) is newer than SQL file (${schemaVersion})`,
                dbAddonVersion
            );
        }
        const sql = await this.getSchemaSQL(schema);
        await this.DB.executeSQLFile(sql);
        return this.updateSchemaVersion(schema, schemaVersion);
    };


    async updateCompatibility(version: number) {
        if (version > this._maxCompatibility) {
            throw new Error("Can't set compatibility greater than _maxCompatibility");
        }

        await this.DB.queryAsync(
            "REPLACE INTO settings VALUES ('addon', 'lastCompatibleVersion', ?)", [addonVersion]
        );
        await this.updateSchemaVersion('compatibility', version);
    };


    checkAddonVersion() {
        return this.DB.executeTransaction(async () => {
            const lastVersion = await this.getLastAddonVersion();
            const currentVersion = addonVersion;
            if (currentVersion == lastVersion) {
                return false;
            }
            Zotero.debug(`Addon version has changed from ${lastVersion} to ${currentVersion}`);

            // Retry all queued objects immediately on upgrade
            //await Zotero.Sync.Data.Local.resetSyncQueueTries();

            // Update version
            await this.updateLastAddonVersion();

            return true;
        });
    }


    getLastAddonVersion() {
        const sql = "SELECT value FROM settings WHERE setting='addon' AND key='lastVersion'";
        return this.DB.valueQueryAsync(sql);
    }


    updateLastAddonVersion() {
        const sql = "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastVersion', ?)";
        return this.DB.queryAsync(sql, addonVersion);
    }


    async migrateSchema(schema: string, fromVersion: number, options: any = {}) {
        const toVersion = await this.getSchemaSQLVersion(schema);

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



        // Step through version changes until we reach the current version
        //
        // Each block performs the changes necessary to move from the
        // previous revision to that one.
        for (let i = fromVersion + 1; i <= toVersion; i++) {
            if (i == 80) {
                //await this.updateCompatibility(1);
                //修改值
                //let userID = await this.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
                //if (userID && typeof userID == 'string') {
                //userID = userID.trim();
                //if (userID) {
                //await this.DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID));
                //}
                //}

                // Delete 'libraries' rows not in 'groups', which shouldn't exist
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
                await this.DB.queryAsync("REPLACE INTO fileTypes VALUES(8, 'ebook')");
                await this.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(8, 'application/epub+zip')");
                // Incorrect, for compatibility
                await this.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(8, 'application/epub')");
            }

            // TEMP: When adding 123, check whether IA.authorName fix in items.js::_loadAnnotations()
            // can be updated due to update steps being indempodent

            // If breaking compatibility or doing anything dangerous, clear minorUpdateFrom
        }

        await this.updateSchemaVersion(schema, toVersion);
        return true;
    };
}
