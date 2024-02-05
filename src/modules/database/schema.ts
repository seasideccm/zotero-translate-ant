/*
adapted from Zotero
*/

//import { schemaConfig } from '../../utils/constant';
import { version as addonVersion, config } from "../../../package.json";
import { compareObj, fileNameNoExt, resourceFilesRecursive, showInfo } from "../../utils/tools";
import { DB, compareSQLUpdateDB } from "./database";
import { OS } from "../../utils/tools";
import { migrate } from "./migrateSchemas";

export class Schema {
  [key: string]: any;
  initialized: boolean;
  _schemaUpdateDeferred: any;
  schemaUpdatePromise: any;
  minorUpdateFrom: number;
  //数据库结构兼容插件（软件）的最大版本号
  _maxCompatibility: number;
  _localUpdateInProgress: boolean;
  isCompatible: boolean | null;
  versionsFromBD: { [key: string]: number; };
  versionsFromFile: { [key: string]: number; };
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
    this.versionsFromBD = {};
    this.versionsFromFile = {};
  }



  async checkInitialized() {
    if (this.initialized) return true;
    try {
      if (await this.isEmptyDB()) await this.initializeSchema();
      if (await this.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='schema' AND key='initialized'")) {
        this.initialized = true;
      } else {
        await this.initializeSchema();
      }
    } catch (e: any) {
      ztoolkit.log(e);
      showInfo(e);
      return false;
    }
    return this.initialized;
  }

  async checkCompat() {
    const compatibility = await this.getSchemaVersionFromDB("compatibility");
    if (!compatibility) {
      //初始化成功，最后返回兼容性为true
      try {
        await this.initializeSchema();
      } catch (e) {
        return (this.isCompatible = false);
      }
    }
    //如果安装不兼容的旧版插件，将导致
    //当前数据库兼容版本号大于现有的插件数据库兼容版本号。
    //考虑数据库降级或使用之前备份的数据库。
    if (compatibility > this._maxCompatibility) {
      const dbAddonVersion = await this.DB.valueQueryAsync(
        "SELECT value FROM settings " +
        "WHERE setting='addon' AND key='lastCompatibleVersion'",
      );
      const msg =
        "Database is incompatible with this addon " +
        dbAddonVersion +
        " version. 考虑数据库降级或使用之前备份的数据库。" +
        `(${compatibility} > ${this._maxCompatibility})`;
      addon.mountPoint.popupWin
        .createLine({
          text: msg,
          type: "default",
        })
        .show();
      ztoolkit.log(msg);
      return (this.isCompatible = false);
    }
    return (this.isCompatible = true);
  }


  /**
   * 读取所有 SQL 文件中 schema 表结构的版本号
   * @param isExcuteSQL 是否批量执行 SQL 文件
   * @returns 
   */
  async getAllSchemasVersionFromFile(isExcuteSQL: boolean = false) {
    if (!isExcuteSQL && Object.keys(this.versionsFromFile).length) return this.versionsFromFile;
    const files = await resourceFilesRecursive(undefined, undefined, "sql");
    for (const file of files) {
      const schema = fileNameNoExt(file.name);
      const sql = await this.getSchemaSQL(schema);
      if (!sql) continue;
      const match = sql.match(/^-- ([0-9]+)/);
      if (!match || !match[1]) continue;
      this.versionsFromFile[schema] = parseInt(match[1]);
      if (isExcuteSQL) {
        await this.DB.executeSQLFile(sql);
      }
    }
    return this.versionsFromFile;
  }

  /**
   * 查询数据库中所有表结构的版本号，与 SQL 文件相对应
   * @returns 
   */
  async getAllSchemasVersionFromDB() {
    if (Object.keys(this.versionsFromBD).length) return this.versionsFromBD;
    const sql = "SELECT schema,version FROM version WHERE schema <> 'compatibility'";
    const rows = await this.DB.queryAsync(sql);
    if (!rows.length) return;
    rows.forEach((row: any) => {
      this.versionsFromBD[row.schema] = row.version;
    });
    return this.versionsFromBD;
  }

  /**
   * 查询数据库中表结构的版本号，与 SQL 文件相对应
   * @param schema 
   * @returns 
   */
  async getSchemaVersionFromDB(schema: string) {
    if (this.versionsFromBD[schema]) {
      return this.versionsFromBD[schema];
    }
    const sql = "SELECT version FROM version WHERE schema='" + schema + "'";
    return this.DB.valueQueryAsync(sql)
      .then((dbSchemaVersion: any) => {
        if (dbSchemaVersion) {
          dbSchemaVersion = parseInt(dbSchemaVersion);
          this.versionsFromBD[schema] = dbSchemaVersion;
          return dbSchemaVersion;
        } else {
          return false;
        }
      })
      .catch((e: any) => {
        return this.DB.tableExists("version")
          .then((exists: any) => {
            if (exists) {
              throw e;
            }
            return false;
          });
      });
  }

  /**
   * 读取 SQL 文件中 schema 表结构的版本号
   * @param schema
   * @returns
   */
  async getSchemaVersionFromFile(schema: string) {
    if (this.versionsFromFile[schema]) {
      return this.versionsFromFile[schema];
    }
    const sql = await this.getSchemaSQL(schema);
    if (!sql) return;
    const match = sql.match(/^-- ([0-9]+)/);
    if (!match || !match[1]) return;
    return parseInt(match[1]);
  }

  //
  /**
   * 检查表并更新，返回 false 无需更新
   * @returns 
   */
  async checkSchemasUpdate() {
    await this.getAllSchemasVersionFromDB();
    await this.getAllSchemasVersionFromFile();
    const compareResult = compareObj(this.versionsFromBD, this.versionsFromFile);
    if (compareResult == true) {
      return false;
    }
    showInfo("schema has changed");
    for (const schema of compareResult) {
      if (!await this.updateSchema(schema)) {
        const msg = "Failure Update Schema: " + schema;
        showInfo(msg);
        throw msg;
      };
    }
    //成功后无需更新
    return false;

  }


  /**
   * 比较sql文件与数据库存储的版本信息
   * @param schema
   * @returns
   */
  async checkUpdate(schema: string) {
    await this.getAllSchemasVersionFromDB();
    await this.getAllSchemasVersionFromFile();
    if (!this.versionsFromBD[schema]) return true;
    if (this.versionsFromBD[schema] == this.versionsFromFile[schema]) {
      return false;
    }
    if (this.versionsFromBD[schema] > this.versionsFromFile[schema]) {
      const dbAddonVersion = await this.DB.valueQueryAsync(
        "SELECT value FROM settings WHERE setting='addon' AND key='lastCompatibleVersion'",
      );
      throw new Error(
        `Addon ${schema} DB version (${this.versionsFromBD[schema]}) is newer than SQL file (${this.versionsFromFile[schema]}). 不兼容：数据库 ${schema} 表的版本大于 SQL 文件的版本号。`,
      );
    }
    return true;
  }
  async isEmptyDB() {
    const tableNames = await this.DB.queryAsync(
      "SELECT name FROM sqlite_master",
    );
    return !tableNames.length;
  }

  async updateSchema(schema: string, options: any = {}) {

    if (this.isCompatible == null) await this.checkCompat();
    if (!this.isCompatible) {
      const msg =
        "Database is incompatible with " +
        config.addonName +
        " " +
        addonVersion +
        " version.";
      ztoolkit.log(msg);
      showInfo(msg);
      return false;
    }
    const schemaVersion = await this.getSchemaVersionFromDB(schema);
    if (!schemaVersion) {
      if (await this.isEmptyDB()) {
        //如果数据库为空则初始化
        const msg = "database does not exist any schema -- creating\n";
        ztoolkit.log(msg);
        showInfo(msg);
        try {
          await this.initializeSchema();
        } catch (e) {
          return false;
        }
      } else {
        const msg = schema + " schema does not exist -- creating\n";
        ztoolkit.log(msg);
        showInfo(msg);
        try {
          await this.DB.executeTransaction(
            async function (this: any) {
              await this.doUpdateSchema(schema);
            }.bind(this),
          );
        } catch (e) {
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
    const schemaSqlFileVersion = await this.getSchemaVersionFromFile(schema);
    options.minor =
      this.minorUpdateFrom && schemaVersion >= this.minorUpdateFrom;

    // If non-minor userdata upgrade, make backup of database first
    if (schemaSqlFileVersion && schemaVersion < schemaSqlFileVersion && !options.minor) {
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

    let updated: boolean | undefined;
    await this.DB.queryAsync("PRAGMA foreign_keys = false");
    try {
      let integrityCheckDone = false;
      const toVersion = schemaSqlFileVersion;
      if (toVersion && integrityCheckRequired && schemaVersion >= toVersion) {
        await this.integrityCheck(true);
        integrityCheckDone = true;
      }
      updated = await this.DB.executeTransaction(
        async function (this: any, conn: any) {
          //如果数据表存在动态写入的数据则需要数据迁移
          //如果表建立以后数据不再变动，则执行sql文件重建表
          let updated;
          if (["triggers"].includes(schema)) {
            updated = await this.doUpdateSchema(schema);
          } else {
            updated = await this.migrateSchema(
              schema,
              schemaVersion,
              toVersion,
              options,
            );
          }
          return updated;
        }.bind(this)
      );

      // If we updated the DB, also do an integrity check for good measure
      if (updated && !integrityCheckDone) {
        await this.integrityCheck(true);
      }
    } catch (e) {
      this._schemaUpdateDeferred.reject(e);
      return false;
    } finally {
      await this.DB.queryAsync("PRAGMA foreign_keys = true");
      Zotero.Debug.removeListener(listener);
      // 日志
      if (updated || updated === undefined) {
        Zotero.getSystemInfo().then(async function (sysInfo) {
          const logDir = OS.Path.join(Zotero.DataDirectory.dir, "logs");
          Zotero.File.createDirectoryIfMissing(logDir);
          await OS.Path;
          const output =
            Zotero.getErrors(true).join("\n\n") +
            "\n\n" +
            sysInfo +
            "\n\n" +
            "=========================================================\n\n" +
            logLines.join("\n\n");
          return Zotero.File.putContentsAsync(
            OS.Path.join(logDir, "upgrade.log"),
            output,
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
          const matches = file.leafName.match(
            /zotero\.sqlite\.([0-9]{2,})\.bak/,
          );
          if (!matches) {
            continue;
          }
          if (matches[1] >= 28 && matches[1] <= maxPrevious) {
            toDelete.push(file);
          }
        }
        for (const file of toDelete) {
          ztoolkit.log("Removing previous backup file " + file.leafName);
          file.remove(false);
        }
      } catch (e) {
        ztoolkit.log(e);
      }
    }

    // Reset sync queue tries if new version
    await this.checkAddonVersionChange();
    this._schemaUpdateDeferred.resolve(true);
    return !!updated;
  }

  migrate = migrate;

  async migrateSchema(
    schema: string,
    fromVersion: number,
    toVersion: number,
    options: any = {},
  ) {
    //const toVersion = await this.getSchemaVersionFromFile(schema);

    if (fromVersion >= toVersion) {
      showInfo("check why version downgrade");
      const downgrade = () => { showInfo("请完善降级函数"); };
      downgrade();
      return false;
    }

    ztoolkit.log(
      "Updating" +
      schema +
      "data tables from version " +
      fromVersion +
      " to " +
      toVersion,
    );

    if (options.onBeforeUpdate) {
      const maybePromise = options.onBeforeUpdate({ minor: options.minor });
      if (maybePromise && maybePromise.then) {
        await maybePromise;
      }
    }
    this.DB.requireTransaction();
    if (this.migrate[schema]) {
      try {
        this.migrate[schema].apply(this, [fromVersion, toVersion]);
        await this.updateSchemaVersion(schema, toVersion);
      }
      catch (e) {
        ztoolkit.log(e);
        return false;
      }

    }

    return true;
  }

  /**
   * 执行 sql 文件，创建数据表
   * Requires a transaction
   * @param schema
   * @returns
   */
  async doUpdateSchema(schema: string) {
    this.DB.requireTransaction();
    if (!(await this.checkUpdate(schema))) return false;
    const schemaVersion: string = String(
      await this.getSchemaVersionFromFile(schema),
    );
    const sql = await this.getSchemaSQL(schema);
    await this.DB.executeSQLFile(sql);
    await this.updateSchemaVersion(schema, schemaVersion);
    return true;
  }

  async integrityCheckRequired() {
    return !!(await this.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"));
  }


  /**
   * 检查表是否缺失，删除无用表，检查外键约束，可选自动修复
   *
   * @param {Boolean} [fix=true] default true
   * @param {Object} [options]
   * @param {Boolean} [options.skipReconcile=false] - Don't reconcile the schema to create tables
   *     and indexes that should have been created and drop existing ones that should have been
   *     deleted
   */
  // Create any tables or indexes that are missing and delete any tables or triggers
  // that still exist but should have been deleted
  //
  // This is skipped for automatic checks, because it can cause problems with schema
  // update steps that don't expect tables to exist.
  fun1 = async function (this: any) {
    const statementsToRun = [];
    // Get all existing tables, indexes, and triggers
    const sql =
      "SELECT " +
      "CASE type " +
      "WHEN 'table' THEN 'table:' || tbl_name " +
      "WHEN 'index' THEN 'index:' || name " +
      "WHEN 'trigger' THEN 'trigger:' || name " +
      "END " +
      "FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')";
    const schema = new Set(await this.DB.columnQueryAsync(sql));

    // Check for deleted tables and triggers that still exist
    // 事务相关
    const deletedTables = [
      "transactionSets",
      "transactions",
      "transactionLog",
    ];
    // 操作相关
    const deletedTriggers = ["insert_date_field", "update_date_field"];
    for (const table of deletedTables) {
      if (schema.has("table:" + table)) {
        statementsToRun.push("DROP TABLE " + table);
      }
    }
    for (const trigger of deletedTriggers) {
      if (schema.has("trigger:" + trigger)) {
        statementsToRun.push("DROP TRIGGER " + trigger);
      }
    }

    // Check for missing tables and indexes
    let statements: any[] = [];
    await this.getAllSchemasVersionFromFile();
    for (const schemaName of Object.keys(this.versionsFromFile)) {
      const sqls = await this.DB.parseSQLFile(
        await this.getSchemaSQL(schemaName),
      );
      statements = statements.concat(sqls);
    }
    for (const statement of statements) {
      let matches = statement.match(/^CREATE.+?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([^\s]+)/);
      if (matches) {
        const table = matches.slice(-1)[0];
        if (!schema.has("table:" + table)) {
          ztoolkit.log(`Table ${table} is missing`, 2);
          statementsToRun.push(statement);
        }
        continue;
      }

      matches = statement.match(/^CREATE INDEX\s+([^\s]+)/);
      if (matches) {
        const index = matches[1];
        if (!schema.has("index:" + index)) {
          ztoolkit.log(`Index ${index} is missing`, 2);
          statementsToRun.push(statement);
        }
        continue;
      }
    }

    return statementsToRun.length ? statementsToRun : false;
  }.bind(this);
  func2 = async function (this: any, statements: any) {
    for (const statement of statements) {
      await this.DB.queryAsync(statement);
    }
  }.bind(this);
  async integrityCheck(fix: boolean = true, options: any = {}) {
    ztoolkit.log(`Checking ${config.addonRef} database schema integrity`);
    let checks: any[] = [
      [
        // Create any tables or indexes that are missing and delete any tables or triggers
        // that still exist but should have been deleted
        //
        // This is skipped for automatic checks, because it can cause problems with schema
        // update steps that don't expect tables to exist.
        this.func1,
        this.func2,
        {
          //用于指示数据库模式完整性检查函数是否应该执行对数据库模式的调和操作。这意味着在执行完整性检查时，如果设置了 reconcile: true，函数将尝试创建缺失的表或索引，并删除应该被删除的现有表或触发器。这有助于确保数据库模式的一致性和完整性。
          reconcile: true,
        },
      ],

      // Foreign key checks
      [
        async function (this: any) {
          const rows = await this.DB.queryAsync("PRAGMA foreign_key_check");
          if (!rows.length) return false;
          const suffix1 = rows.length == 1 ? "" : "s";
          const suffix2 = rows.length == 1 ? "s" : "";
          ztoolkit.log(
            `Found ${rows.length} row${suffix1} that violate${suffix2} foreign key constraints`,
            1,
          );
          return rows;
        }.bind(this),
        // If fixing, delete rows that violate FK constraints
        async function (this: any, rows: any) {
          for (const row of rows) {
            await this.DB.queryAsync(
              `DELETE FROM ${row.table} WHERE ROWID=?`,
              row.rowid,
            );
          }
        }.bind(this),
      ],
    ];

    // Remove reconcile steps
    if (options && options.skipReconcile) {
      checks = checks.filter((x) => !x[2] || !x[2].reconcile);
    }

    for (const check of checks) {
      let errorsFound = false;
      // SQL statement
      if (typeof check[0] == "string") {
        errorsFound = await this.DB.valueQueryAsync(check[0]);
      }
      // Function
      else {
        errorsFound = await check[0]();
      }
      if (!errorsFound) {
        continue;
      }

      ztoolkit.log("Test failed!", 1);

      if (fix) {
        try {
          // Single query
          if (typeof check[1] == "string") {
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
            const checkData =
              typeof errorsFound != "boolean" ? errorsFound : null;
            await check[1](checkData);
          }
          //成功
          continue;
        } catch (e) {
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
  }

  async setIntegrityCheckRequired(required: boolean) {
    let sql;
    if (required) {
      sql = "REPLACE INTO settings VALUES ('db', 'integrityCheck', 1)";
    } else {
      sql = "DELETE FROM settings WHERE setting='db' AND key='integrityCheck'";
    }
    await Zotero.DB.queryAsync(sql);
  }

  /**
   *
   * @param schema
   * @param dir option default:chrome://${config.addonRef}/content/schema/
   * @returns Promise<string>
   */
  getSchemaSQL(schema: string, dir?: string) {
    if (!schema) {
      throw "Schema type not provided to this.getSchemaSQL()";
    }
    dir = dir || `chrome://${config.addonRef}/content/schema/`;
    schema = fileNameNoExt(schema);
    const path = dir + `${schema}.sql`;

    return Zotero.File.getResourceAsync(path);
  }
  //doInitSchema()
  async initializeSchema() {
    await this.DB.executeTransaction(
      async function (this: any) {
        try {
          //避免循环
          await this.DB.queryAsync("PRAGMA page_size = 4096");
          await this.DB.queryAsync("PRAGMA encoding = 'UTF-8'");
          await this.DB.queryAsync("PRAGMA auto_vacuum = 1");
          //执行sql文件
          await this.getAllSchemasVersionFromFile(true);
          /* const files = await resourceFilesRecursive(undefined, undefined, "sql");
          for (const file of files) {
            const schema = fileNameNoExt(file.name);
            const sql = await this.getSchemaSQL(schema);
            if (!sql) continue;
            const match = sql.match(/^-- ([0-9]+)/);
            if (!match || !match[1]) continue;
            this.versionsFromFile.push({
              schema: schema,
              version: parseInt(match[1])
            });
            //所有表都创建完成后才能写入数据
            await this.DB.executeSQLFile(sql);
          } */

          /* sql = await this.getSchemaSQL("addonSystem");
          await this.DB.executeSQLFile(sql);
          sql = await this.getSchemaSQL("apiAccount");
          await this.DB.executeSQLFile(sql);
          sql = await this.getSchemaSQL("translation");
          await this.DB.executeSQLFile(sql);
          sql = await this.getSchemaSQL("triggers");
          await this.DB.executeSQLFile(sql); */
          for (const schema of Object.keys(this.versionsFromFile)) {
            await this.updateSchemaVersion(schema, this.versionsFromFile[schema]);
          }
          /* let version;
          version = schemaConfig["addonSystem"]["version"];
          await this.updateSchemaVersion("addonSystem", version);
          version = schemaConfig["apiAccount"]["version"];
          await this.updateSchemaVersion("apiAccount", version);
          version = schemaConfig["translation"]["version"];
          await this.updateSchemaVersion("translation", version);
          version = schemaConfig["triggers"]["version"];
          await this.updateSchemaVersion("triggers", version); */
          //await this.updateLastAddonVersion();
          const sql = "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastVersion', ?)";
          await this.DB.queryAsync(sql, addonVersion);
          await this.updateCompatibility(this._maxCompatibility);
          this.isCompatible = true;
          await this.DB.queryAsync(
            "INSERT INTO settings (setting, key, value) VALUES ('schema', 'initialized', ?)",
            1,
          );
          this.initialized = true;
        } catch (e) {
          ztoolkit.log(e);
          reportError(e);
          throw e;
        }
      }.bind(this),
    );

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
  }


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
      "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastCompatibleVersion', ?)",
      [addonVersion],
    );
    await this.updateSchemaVersion("compatibility", version);
  }

  async checkAddonVersion() {
    const lastVersion = await this.getLastAddonVersion();
    if (addonVersion != lastVersion) {
      await this.updateLastAddonVersion();
    }
    return true;
  }

  getLastAddonVersion() {
    const sql =
      "SELECT value FROM settings WHERE setting='addon' AND key='lastVersion'";
    return this.DB.valueQueryAsync(sql);
  }

  /**
   * 更新插件版本号
   * @returns
   */
  async updateLastAddonVersion() {
    await this.DB.executeTransaction(
      async function (this: any) {
        const sql =
          "REPLACE INTO settings (setting, key, value) VALUES ('addon', 'lastVersion', ?)";
        try {
          await this.DB.queryAsync(sql, addonVersion);
        }
        catch (e) {
          ztoolkit.log(e);
          throw e;
        }
      }.bind(this));
  }

  //todo reverse update
  //rollBack() {    }
}

function reportError(e: any) {
  Components.utils.reportError(e);
  const ps = Components.classes[
    "@mozilla.org/embedcomp/prompt-service;1"
  ].getService(Components.interfaces.nsIPromptService);
  ps.alert(
    null,
    Zotero.getString("general.error"),
    Zotero.getString("startupError", Zotero.appName),
  );
}
