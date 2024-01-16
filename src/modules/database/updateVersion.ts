/* export  function initDBVersion (DB:any) {
    if (DB._dbVersions[schema]) {
        return Zotero.Promise.resolve(_dbVersions[schema]);
    }
    let dbSystemVersion = yield Zotero.Schema.initDBVersion('system')
    var sql = "SELECT version FROM version WHERE schema='" + schema + "'";
    return Zotero.DB.valueQueryAsync(sql)
        .then(function (dbVersion) {
            if (dbVersion) {
                dbVersion = parseInt(dbVersion);
                _dbVersions[schema] = dbVersion;
            }
            return dbVersion;
        })
        .catch(function (e) {
            return Zotero.DB.tableExists('version')
                .then(function (exists) {
                    if (exists) {
                        throw e;
                    }
                    return false;
                });
        });
}; */


/* export async function updateDBVersion(schema, version) {
    _dbVersions[schema] = version;
    var sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
    return Zotero.DB.queryAsync(sql, [schema, parseInt(version)]);
} */

/*
 * Checks if the DB schema exists and is up-to-date, updating if necessary
 */
/* export async function updateDBTable (options = {}) {
    // TODO: Check database integrity first with Zotero.DB.integrityCheck()

    // 'userdata' is the last upgrade step run in _migrateUserDataSchema() based on the
    // version in the schema file. Upgrade steps may or may not break DB compatibility.
    //
    // 'compatibility' is incremented manually by upgrade steps in order to break DB
    // compatibility with older versions.
    var versions = await Zotero.Promise.all([
        this.initDBVersion('userdata'), this.initDBVersion('compatibility')
    ]);
    var [userdata, compatibility] = versions;
    if (!userdata) {
        Zotero.debug('Database does not exist -- creating\n');
        return _initializeSchema()
            .then(function () {
                // Don't load bundled files until after UI is ready, unless this is a test run,
                // in which case tests can run without a window open
                (!Zotero.test ? Zotero.uiReadyPromise : Zotero.initializationPromise)
                    .delay(1000)
                    .then(async function () {
                        await this.updateBundledFiles();
                        if (Zotero.Prefs.get('automaticScraperUpdates')) {
                            try {
                                await this.updateFromRepository(this.REPO_UPDATE_INITIAL);
                            }
                            catch (e) {
                                Zotero.logError(e);
                            }
                        }
                        _schemaUpdateDeferred.resolve(true);
                    }.bind(this));
            }.bind(this));
    }

    // We don't handle upgrades from pre-Zotero 2.1 databases
    if (userdata < 76) {
        let msg = Zotero.getString('upgrade.nonupgradeableDB1')
            + "\n\n" + Zotero.getString('upgrade.nonupgradeableDB2', "4.0");
        throw new Error(msg);
    }

    if (compatibility > _maxCompatibility) {
        let dbClientVersion = await Zotero.DB.valueQueryAsync(
            "SELECT value FROM settings "
            + "WHERE setting='client' AND key='lastCompatibleVersion'"
        );
        let msg = "Database is incompatible with this Zotero version "
            + `(${compatibility} > ${_maxCompatibility})`;
        throw new Zotero.DB.IncompatibleVersionException(msg, dbClientVersion);
    }

    // Check if DB is coming from the DB Repair Tool and should be checked
    var integrityCheckRequired = await this.integrityCheckRequired();

    // Check whether bundled global schema file is newer than DB
    var bundledGlobalSchema = await _readGlobalSchemaFromFile();
    var bundledGlobalSchemaVersionCompare = await _globalSchemaVersionCompare(
        bundledGlobalSchema.version
    );

    // Check whether bundled userdata schema has been updated
    var userdataVersion = await _getSchemaSQLVersion('userdata');
    options.minor = minorUpdateFrom && userdata >= minorUpdateFrom;

    // If non-minor userdata upgrade, make backup of database first
    if (userdata < userdataVersion && !options.minor) {
        await Zotero.DB.backupDatabase(userdata, true);
    }
    // Automatic backup
    else if (integrityCheckRequired || bundledGlobalSchemaVersionCompare === 1) {
        await Zotero.DB.backupDatabase(false, true);
    }

    var logLines = [];
    var listener = function (line) {
        logLines.push(line);
    };
    Zotero.Debug.addListener(listener);

    var updated;
    await Zotero.DB.queryAsync("PRAGMA foreign_keys = false");
    try {
        // Auto-repair databases flagged for repair or coming from the DB Repair Tool
        //
        // If we need to run migration steps, skip the check until after the update, since
        // the integrity check is expecting to run on the current data model.
        let integrityCheckDone = false;
        let toVersion = await _getSchemaSQLVersion('userdata');
        if (integrityCheckRequired && userdata >= toVersion) {
            await this.integrityCheck(true);
            integrityCheckDone = true;
        }

        // TEMP
        try {
            await _fixSciteValues();
        }
        catch (e) {
            Zotero.logError(e);
        }

        updated = await Zotero.DB.executeTransaction(async function (conn) {
            var updated = await _updateSchema('system');

            // Update custom tables if they exist so that changes are in
            // place before user data migration
            if (Zotero.DB.tableExists('customItemTypes')) {
                await _updateCustomTables();
            }

            updated = await _migrateUserDataSchema(userdata, options);
            await _updateSchema('triggers');

            // Populate combined tables for custom types and fields -- this is likely temporary
            //
            // We do this again in case custom fields were changed during user data migration
            await _updateCustomTables();

            return updated;
        }.bind(this));

        // If we updated the DB, also do an integrity check for good measure
        if (updated && !integrityCheckDone) {
            await this.integrityCheck(true);
        }

        // If bundled global schema file is newer than DB, apply it
        if (bundledGlobalSchemaVersionCompare === 1) {
            await Zotero.DB.executeTransaction(async function () {
                await _updateGlobalSchema(bundledGlobalSchema);
            });
        }
        else {
            let data;
            // If bundled global schema is up to date, use it
            if (bundledGlobalSchemaVersionCompare === 0) {
                data = bundledGlobalSchema;
            }
            // If bundled global schema is older than the DB (because of a downgrade), use the
            // DB version, which will match the mapping tables
            else if (bundledGlobalSchemaVersionCompare === -1) {
                data = await _readGlobalSchemaFromDB();
            }
            await _loadGlobalSchema(data, bundledGlobalSchema.version);
        }
    }
    finally {
        await Zotero.DB.queryAsync("PRAGMA foreign_keys = true");

        Zotero.Debug.removeListener(listener);

        // If upgrade succeeded or failed (but not if there was nothing to do), save a log file
        // in logs/upgrade.log in the data directory
        if (updated || updated === undefined) {
            Zotero.getSystemInfo()
                .then(async function (sysInfo) {
                    var logDir = OS.Path.join(Zotero.DataDirectory.dir, 'logs');
                    Zotero.File.createDirectoryIfMissing(logDir);

                    await OS.Path;
                    var output = Zotero.getErrors(true).join('\n\n')
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
        var maxPrevious = userdata - 1;
        var file = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
        var toDelete = [];
        try {
            var files = file.directoryEntries;
            while (files.hasMoreElements()) {
                var file = files.getNext();
                file.QueryInterface(Components.interfaces.nsIFile);
                if (file.isDirectory()) {
                    continue;
                }
                var matches = file.leafName.match(/zotero\.sqlite\.([0-9]{2,})\.bak/);
                if (!matches) {
                    continue;
                }
                if (matches[1] >= 28 && matches[1] <= maxPrevious) {
                    toDelete.push(file);
                }
            }
            for (let file of toDelete) {
                Zotero.debug('Removing previous backup file ' + file.leafName);
                file.remove(false);
            }
        }
        catch (e) {
            Zotero.debug(e);
        }
    }

    // Reset sync queue tries if new version
    await _checkClientVersion();

    // See above
    (!Zotero.test ? Zotero.uiReadyPromise : Zotero.initializationPromise)
        .then(() => {
            setTimeout(async function () {
                try {
                    await this.updateBundledFiles();
                    if (Zotero.Prefs.get('automaticScraperUpdates')) {
                        try {
                            await this.updateFromRepository(this.REPO_UPDATE_STARTUP);
                        }
                        catch (e) {
                            Zotero.logError(e);
                        }
                    }
                    _schemaUpdateDeferred.resolve(true);
                }
                catch (e) {
                    // DB corruption already shows an alert
                    if (Zotero.DB.isCorruptionError(e)) {
                        _schemaUpdateDeferred.reject(e);
                        return;
                    }

                    let kbURL = 'https://www.zotero.org/support/kb/unable_to_load_translators_and_styles';
                    let msg = Zotero.getString('startupError.bundledFileUpdateError', Zotero.clientName);

                    let ps = Services.prompt;
                    let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
                        + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
                        + ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
                    let index = ps.confirmEx(
                        null,
                        Zotero.getString('general.error'),
                        msg,
                        buttonFlags,
                        Zotero.getString('general.moreInformation'),
                        "",
                        Zotero.getString('errorReport.reportError'),
                        null, {}
                    );

                    _schemaUpdateDeferred.reject(e);

                    if (index == 0) {
                        Zotero.launchURL(kbURL);
                    }
                    else if (index == 2) {
                        setTimeout(function () {
                            Zotero.getActiveZoteroPane().reportErrors();
                        }, 250);
                    }
                }
            }.bind(this), 1000);
        });

    return updated;
}; */