import { config } from "../../../package.json";
export async function getDB(dbName?: string) {
    dbName = dbName || "addonDB.sqlite";
    const dir = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
    if (!await IOUtils.exists(dir)) {
        await IOUtils.makeDirectory(dir);
    }
    let path = PathUtils.join(dir, dbName);
    // 创建数据库实例
    const addonDB = new Zotero.DBConnection(path);
    path = addonDB._dbPath;
    try {
        let msg;
        // Test read access, if failure throw error
        await addonDB.test();
        // Test write access on path
        if (!Zotero.File.pathToFile(OS.Path.dirname(path)).isWritable()) {
            msg = 'Cannot write to ' + OS.Path.dirname(path) + '/';
        }
        // Test write access on Zotero database
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
    if (!addonDB.dbInitialized) await initializeSchema(addonDB);
    return addonDB;

    async function initializeSchema(DB: any) {
        await DB.executeTransaction(async function () {
            try {
                await DB.queryAsync("PRAGMA page_size = 4096");
                await DB.queryAsync("PRAGMA encoding = 'UTF-8'");
                await DB.queryAsync("PRAGMA auto_vacuum = 1");
                const sql = await getSchemaSQL('addonSchema');
                await DB.executeSQLFile(sql);
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

const schemaData = {
    sentence: {
        id: "INTEGER PRIMARY KEY",
        sourceText: "TEXT NOT NULL",
        targetText: "TEXT NOT NULL",
        score: "INTEGER"
    }
};

/**
 * 
 * @param schema 
 * @param dir option default:chrome://${config.addonRef}/content/
 * @returns 
 */
function getSchemaSQL(schema: string, dir?: string) {
    if (!schema) {
        throw ('Schema type not provided to _getSchemaSQL()');
    }
    dir = dir || `chrome://${config.addonRef}/content/schema/`;
    const path = dir + `${schema}.sql`;
    return Zotero.File.getResourceAsync(path);
}





