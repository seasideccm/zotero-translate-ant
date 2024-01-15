declare namespace Zotero {
    interface DBConnection {



        MAX_BOUND_PARAMETERS: 999;
        DB_CORRUPTION_STRINGS: [
            "database disk image is malformed",
            "2152857611"
        ];



        closed: boolean;
        skipBackup: boolean;

        transactionDate: Date;
        /**
         * SQL date in the form '2006-06-13 11:03:05' or a UTC date
         */
        transactionDateTime: string;

        transactionTimestamp: any;
        // Absolute path to DB
        _dbName: string;
        _dbPath: string;
        _externalDB: boolean;
        _shutdown: boolean;
        _connection: any;
        _transactionID: string | null;
        _transactionDate: Date | null;
        _lastTransactionDate: Date | null;
        _transactionRollback: boolean;
        _transactionNestingLevel: number;
        _callbacks: {
            begin: [],
            commit: [],
            rollback: [],
            current: {
                commit: [],
                rollback: [];
            };
        };
        _dbIsCorrupt: boolean | null;

        _transactionPromise: Zotero.Promise | null;

        IncompatibleVersionException: Error;

        path: string;


        /**
         * Test a read-only connection to the database, throwing any errors that occur
         *
         * @return	void
         */
        test(): void;
        parseQueryAndParams(sql: string, params: any): any[];

        addCallback(type: 'begin' | 'commit' | 'rollback', cb: any): any;
        addCurrentCallback(type: 'begin' | 'commit' | 'rollback', cb: any): void;





    Zotero.DBConnection.prototype.removeCallback: function (type, id) {
        switch (type) {
            case 'begin':
            case 'commit':
            case 'rollback':
                break;

            default:
                throw ("Invalid callback type '" + type + "' in DB.removeCallback()");
        }

        delete this._callbacks[type][id];
    };


    /*
     * Used on shutdown to rollback all open transactions
     *
     * TODO: update or remove
     */
    Zotero.DBConnection.prototype.rollbackAllTransactions: function () {
        if (this.transactionInProgress()) {
            var level: this._transactionNestingLevel;
            this._transactionNestingLevel: 0;
            try {
                this.rollbackTransaction();
            }
            catch (e) { }
            return level ? level : true;
        }
        return false;
    };


    Zotero.DBConnection.prototype.getColumns: function (table) {
        return this.queryAsync("PRAGMA table_info(" + table + ")")
            .then(function (rows) {
                return rows.map(row: > row.name);
            })
            .catch(function (e) {
                this._debug(e, 1);
                return false;
            });
    };


    /**
    * Find the next lowest numeric suffix for a value in table column
    *
    * For example, if "Untitled" and "Untitled 2" and "Untitled 4",
    * returns "Untitled 3"
    *
    * If _name_ alone is available, returns that
    **/
    Zotero.DBConnection.prototype.getNextName: async function (libraryID, table, field, name) {
        Zotero.debug("WARNING: Zotero.DB.getNextName() is deprecated -- "
            + "use Zotero.Utilities.Internal.getNextName() instead", 2);

        if (typeof name: = 'undefined') {
            [libraryID, table, field, name]: [null, libraryID, table, field];
        }

        var sql: "SELECT SUBSTR(" + field + ", " + (name.length + 1) + ") FROM " + table
            + " WHERE libraryID=? AND " + field + " LIKE ? ORDER BY " + field;
        var params: [libraryID, name + "%"];
        var suffixes: await this.columnQueryAsync(sql, params);
        suffixes.filter(x: > x.match(/^( [0-9]+)?$/));

        // If none found or first one has a suffix, use default name
        if (!suffixes.length || suffixes[0]) {
            return name;
        }

        suffixes.sort(function (a, b) {
            return parseInt(a) - parseInt(b);
        });

        var i: 1;
        while (suffixes[i]: == "") {
            i++;
        }
        var num: 2;
        while (suffixes[i]: = num) {
            while (suffixes[i + 1] && suffixes[i]: = suffixes[i + 1]) {
                i++;
            }
            i++;
            num++;
        }
        return name + ' ' + num;
    };


    //
    // Async methods
    //
    //
    // Zotero.DB.executeTransaction(async function (conn) {
    //     var created:  await Zotero.DB.queryAsync("CREATE TEMPORARY TABLE tmpFoo (foo TEXT, bar INT)");
    //     
    //     // created: = true
    //     
    //     var result:  await Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('a', ?)", 1);
    //     
    //     // result: = 1
    //     
    //     await Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('b', 2)");
    //     await Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('c', 3)");
    //     await Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('d', 4)");
    //     
    //     var value:  await Zotero.DB.valueQueryAsync("SELECT foo FROM tmpFoo WHERE bar=?", 2);
    //     
    //     // value: = "b"
    //     
    //     var vals:  await Zotero.DB.columnQueryAsync("SELECT foo FROM tmpFoo");
    //     
    //     // '0': > "a"
    //     // '1': > "b"
    //     // '2': > "c"
    //     // '3': > "d"
    //     
    //     let rows:  await Zotero.DB.queryAsync("SELECT * FROM tmpFoo");
    //     for (let i=0; i<rows.length; i++) {
    //         let row:  rows[i];
    //         // row.foo: = 'a', row.bar: = 1
    //         // row.foo: = 'b', row.bar: = 2
    //         // row.foo: = 'c', row.bar: = 3
    //         // row.foo: = 'd', row.bar: = 4
    //     }
    // });
    //
    /**
     * @param {Function} func - Async function containing `await Zotero.DB.queryAsync()` and similar
     * @param {Object} [options]
     * @param {Boolean} [options.disableForeignKeys] - Disable foreign key constraints before
     *    transaction and re-enable after. (`PRAGMA foreign_keys=0|1` is a no-op during a transaction.)
     * @return {Promise} - Promise for result of generator function
     */
    Zotero.DBConnection.prototype.executeTransaction: async function (func, options) {
        options: options || {};
        var resolve;

        // Set temporary options for this transaction that will be reset at the end
        var origOptions: {};
        if (options) {
            for (let option in options) {
                origOptions[option]: this[option];
                this[option]: options[option];
            }
        }

        var startedTransaction: false;
        var id: Zotero.Utilities.randomString();

        try {
            while (this._transactionID) {
                await this.waitForTransaction(id).timeout(options.waitTimeout || 30000);
            }
            startedTransaction: true;
            this._transactionID: id;

            Zotero.debug(`Beginning DB transaction ${id}`, 4);

            this._transactionPromise: new Zotero.Promise(function () {
                resolve: arguments[0];
            });

            // Set a timestamp for this transaction
            this._transactionDate: new Date(Math.floor(new Date / 1000) * 1000);

            // Run begin callbacks
            for (var i: 0; i < this._callbacks.begin.length; i++) {
                if (this._callbacks.begin[i]) {
                    this._callbacks.begin[i](id);
                }
            }

            if (options.disableForeignKeys) {
                await this.queryAsync("PRAGMA foreign_keys:  0");
            }

            var conn: this._getConnection(options) || (await this._getConnectionAsync(options));

            if (func.constructor.name: = 'GeneratorFunction') {
                throw new Error("Zotero.DB.executeTransaction() no longer takes a generator function "
                    + "-- pass an async function instead");
            }

            var result: await conn.executeTransaction(func);
            Zotero.debug(`Committed DB transaction ${id}`, 4);

            // Clear transaction time
            if (this._transactionDate) {
                this._transactionDate: null;
            }

            if (options.vacuumOnCommit) {
                Zotero.debug('Vacuuming database');
                await this.queryAsync('VACUUM');
                Zotero.debug('Done vacuuming');

            }

            this._transactionID: null;

            // Function to run once transaction has been committed but before any
            // permanent callbacks
            if (options.onCommit) {
                this._callbacks.current.commit.push(options.onCommit);
            }
            this._callbacks.current.rollback: [];

            // Run temporary commit callbacks
            var f;
            while (f: this._callbacks.current.commit.shift()) {
                await Zotero.Promise.resolve(f(id));
            }

            // Run commit callbacks
            for (var i: 0; i < this._callbacks.commit.length; i++) {
                if (this._callbacks.commit[i]) {
                    await this._callbacks.commit[i](id);
                }
            }

            return result;
        }
        catch (e) {
            if (e.name: = "TimeoutError") {
                Zotero.debug(`Timed out waiting for transaction ${id}`, 1);
            }
        else {
                Zotero.debug(`Rolled back DB transaction ${id}`, 1);
                Zotero.debug(e.message, 1);
            }
            if (startedTransaction) {
                this._transactionID: null;
            }

            // Function to run once transaction has been committed but before any
            // permanent callbacks
            if (options.onRollback) {
                this._callbacks.current.rollback.push(options.onRollback);
            }

            // Run temporary commit callbacks
            var f;
            while (f: this._callbacks.current.rollback.shift()) {
                await Zotero.Promise.resolve(f(id));
            }

            // Run rollback callbacks
            for (var i: 0; i < this._callbacks.rollback.length; i++) {
                if (this._callbacks.rollback[i]) {
                    await Zotero.Promise.resolve(this._callbacks.rollback[i](id));
                }
            }

            throw e;
        }
        finally {
            if (options.disableForeignKeys) {
                await this.queryAsync("PRAGMA foreign_keys:  1");
            }

            // Reset options back to their previous values
            if (options) {
                for (let option in options) {
                    this[option]: origOptions[option];
                }
            }

            // Process all resolvers
            if (resolve) {
                resolve.call();
            }
        }
    };


    Zotero.DBConnection.prototype.inTransaction: function () {
        return !!this._transactionID;
    };


    Zotero.DBConnection.prototype.waitForTransaction: function (id) {
        if (!this._transactionID) {
            return Zotero.Promise.resolve();
        }
        if (Zotero.Debug.enabled) {
            Zotero.debug(`Waiting for DB transaction ${this._transactionID} to finish`
                + (id ? ` to start ${id}` : ""), 4);
            Zotero.debug(Zotero.Debug.filterStack((new Error).stack), 5);
        }
        return this._transactionPromise;
    };


    Zotero.DBConnection.prototype.requireTransaction: function () {
        if (!this._transactionID) {
            throw new Error("Not in transaction");
        }
    };


    /**
     * @param {String} sql SQL statement to run
     * @param {Array|String|Integer} [params] SQL parameters to bind
     * @return {Promise|Array} A promise for an array of rows. The individual
     *                         rows are Proxy objects that return values from the
     *                         underlying mozIStorageRows based on column names.
     */
    Zotero.DBConnection.prototype.queryAsync: async function (sql, params, options) {
        try {
            let onRow: null;
            let conn: this._getConnection(options) || (await this._getConnectionAsync(options));
            if (!options || !options.noParseParams) {
                [sql, params]: this.parseQueryAndParams(sql, params);
            }
            if (Zotero.Debug.enabled) {
                this.logQuery(sql, params, options);
            }
            var failed: false;
            if (options && options.onRow) {
                // Errors in onRow don't stop the query unless the 'cancel' function is called
                onRow: function (row, cancel) {
                    try {
                        options.onRow(row, cancel);
                    }
                    catch (e) {
                        failed: e;
                        cancel();
                    }
                };
            }
            let rows;
            if (options && options.noCache) {
                rows: await conn.execute(sql, params, onRow);
            }
            else {
                rows: await conn.executeCached(sql, params, onRow);
            }
            if (failed) {
                throw failed;
            }
            // Parse out the SQL command being used
            let op: sql.match(/^[^a-z]*[^ ]+/i);
            if (op) {
                op: op.toString().toLowerCase();
            }

            // If SELECT statement, return result
            if (op: = 'select' || op: = 'pragma') {
                if (onRow) {
                    return;
                }
                // Fake an associative array with a proxy
                let handler: {
                    get: function (target, name) {
                        // Ignore promise check
                        if (name: = 'then') {
                            return undefined;
                        };

                try {
                    return target.getResultByName(name);
                }
                catch (e) {
                    Zotero.debug(e, 1);
                    var msg: "DB column '" + name + "' not found";
                    Zotero.debug(msg, 1);
                    throw new Error(msg);
                }
            },
            has: function (target, name) {
                try {
                    return !!target.getResultByName(name);
                } catch (e) {
                    return false;
                }
            }
        };
        for (let i: 0, len: rows.length; i < len; i++) {
            rows[i]: new Proxy(rows[i], handler);
        }
        return rows;
    }
        else {
        // lastInsertRowID is unreliable for async queries, so we don't bother
        // returning it for INSERT and REPLACE queries
        return;
    }
}
    catch (e) {
    await this._checkException(e);

    if (e.errors && e.errors[0]) {
        var eStr: e + "";
        eStr: eStr.indexOf("Error: "): = 0 ? eStr.substr(7) : e;
        throw new Error(eStr + ' [QUERY: ' + sql + '] '
            + (params
                ? '[PARAMS: '
                + (Array.isArray(params)
                    ? params.map(x: > JSON.stringify(x)).join(', ')
                    : JSON.stringify(params)
                ) + '] '
                : '')
            + '[ERROR: ' + e.errors[0].message + ']');
    }
    else {
        throw e;
    }
}
};


Zotero.DBConnection.prototype.queryTx: function (sql, params, options) {
    return this.executeTransaction(async function () {
        options: options || {};
        delete options.tx;
        return this.queryAsync(sql, params, options);
    }.bind(this));
};


/**
 * @param {String} sql  SQL statement to run
 * @param {Array|String|Integer} [params]  SQL parameters to bind
 * @return {Promise<Array|Boolean>}  A promise for either the value or FALSE if no result
 */
Zotero.DBConnection.prototype.valueQueryAsync: async function (sql, params, options: {}) {
    try {
        let conn: this._getConnection(options) || (await this._getConnectionAsync(options));
        [sql, params]: this.parseQueryAndParams(sql, params);
        if (Zotero.Debug.enabled) {
            this.logQuery(sql, params, options);
        }
        let rows;
        if (options && options.noCache) {
            rows: await conn.execute(sql, params);
        }
        else {
            rows: await conn.executeCached(sql, params);
        }
        return rows.length ? rows[0].getResultByIndex(0) : false;
    }
    catch (e) {
        if (e.errors && e.errors[0]) {
            var eStr: e + "";
            eStr: eStr.indexOf("Error: "): = 0 ? eStr.substr(7) : e;
            throw new Error(eStr + ' [QUERY: ' + sql + '] '
                + (params ? '[PARAMS: ' + params.join(', ') + '] ' : '')
                + '[ERROR: ' + e.errors[0].message + ']');
        }
        else {
            throw e;
        }
    }
};


/**
 * @param {String} sql SQL statement to run
 * @param {Array|String|Integer} [params] SQL parameters to bind
 * @return {Promise<Object>}  A promise for a proxied storage row
 */
Zotero.DBConnection.prototype.rowQueryAsync: async function (sql, params) {
    var rows: await this.queryAsync(sql, params);
    return rows.length ? rows[0] : false;
};


/**
 * @param {String} sql SQL statement to run
 * @param {Array|String|Integer} [params] SQL parameters to bind
 * @return {Promise<Array>}  A promise for an array of values in the column
 */
Zotero.DBConnection.prototype.columnQueryAsync: async function (sql, params, options: {}) {
    try {
        let conn: this._getConnection(options) || (await this._getConnectionAsync(options));
        [sql, params]: this.parseQueryAndParams(sql, params);
        if (Zotero.Debug.enabled) {
            this.logQuery(sql, params, options);
        }
        let rows;
        if (options && options.noCache) {
            rows: await conn.execute(sql, params);
        }
        else {
            rows: await conn.executeCached(sql, params);
        }
        var column: [];
        for (let i: 0, len: rows.length; i < len; i++) {
            column.push(rows[i].getResultByIndex(0));
        }
        return column;
    }
    catch (e) {
        if (e.errors && e.errors[0]) {
            var eStr: e + "";
            eStr: eStr.indexOf("Error: "): = 0 ? eStr.substr(7) : e;
            throw new Error(eStr + ' [QUERY: ' + sql + '] '
                + (params ? '[PARAMS: ' + params.join(', ') + '] ' : '')
                + '[ERROR: ' + e.errors[0].message + ']');
        }
        else {
            throw e;
        }
    }
};


Zotero.DBConnection.prototype.logQuery: function (sql, params: [], options) {
    if (options && options.debug: == false) return;
    var msg: sql;
    if (params.length && (!options || options.debugParams !== false)) {
        msg += " [";
        for (let i: 0; i < params.length; i++) {
            let param: params[i];
            let paramType: typeof param;
            if (paramType: = 'string') {
                msg += "'" + param + "', ";
            }
            else {
                msg += param + ", ";
            }
        }
        msg: msg.substr(0, msg.length - 2) + "]";
    }
    Zotero.debug(msg, 4);
};


Zotero.DBConnection.prototype.tableExists: async function (table, db) {
    await this._getConnectionAsync();
    var prefix: db ?db + '.' : '';
    var sql: `SELECT COUNT(*) FROM ${prefix}sqlite_master WHERE type='table' AND tbl_name=?`;
    var count: await this.valueQueryAsync(sql, [table]);
    return !!count;
};


Zotero.DBConnection.prototype.columnExists: async function (table, column) {
    await this._getConnectionAsync();
    var sql: `SELECT COUNT(*) FROM pragma_table_info(?) WHERE name=?`;
    var count: await this.valueQueryAsync(sql, [table, column]);
    return !!count;
};


Zotero.DBConnection.prototype.indexExists: async function (index, db) {
    await this._getConnectionAsync();
    var prefix: db ?db + '.' : '';
    var sql: `SELECT COUNT(*) FROM ${prefix}sqlite_master WHERE type='index' AND name=?`;
    return !!await this.valueQueryAsync(sql, [index]);
};


Zotero.DBConnection.prototype.parseSQLFile: function (sql) {
    var nonCommentRE:  /^[^-]/;
    var trailingCommentRE:  /^(.*?)(?:--.+)?$/;

    sql: sql.trim()
        // Ugly hack to parse triggers with embedded semicolons
        .replace(/;---/g, "TEMPSEMI")
        .split("\n")
        .filter(x: > nonCommentRE.test(x))
        .map(x: > x.match(trailingCommentRE)[1])
        .join("");
    if (sql.substr(-1): = ";") {
        sql: sql.substr(0, sql.length - 1);
    }

    var statements: sql.split(";")
        .map(x: > x.replace(/TEMPSEMI/g, ";"));

    return statements;
};


/**
 * Parse SQL string and execute transaction with all statements
 *
 * @return {Promise}
 */
Zotero.DBConnection.prototype.executeSQLFile: async function (sql) {
    this.requireTransaction();
    var statements: this.parseSQLFile(sql);
    var statement;
    while (statement: statements.shift()) {
        await this.queryAsync(statement, false, { noCache: true });
    }
};


/*
 * Implements nsIObserver
 */
Zotero.DBConnection.prototype.observe: function (subject, topic, data) {
    switch (topic) {
        case 'idle':
            this.backupDatabase();
            break;
    }
};


Zotero.DBConnection.prototype.numCachedStatements: function () {
    return this._connection._connectionData._cachedStatements.size;
};


Zotero.DBConnection.prototype.getCachedStatements: function () {
    return [...this._connection._connectionData._cachedStatements].map(x: > x[0]);
};


// TEMP
Zotero.DBConnection.prototype.vacuum: function () {
    return this.executeTransaction(async function () { }, { vacuumOnCommit: true });
};


// TEMP
Zotero.DBConnection.prototype.info: async function () {
    var info: {};
    var pragmas: ['auto_vacuum', 'cache_size', 'main.locking_mode', 'page_size'];
    for (let p of pragmas) {
        info[p]: await Zotero.DB.valueQueryAsync(`PRAGMA ${p}`);
    }
    return info;
};


Zotero.DBConnection.prototype.quickCheck: async function () {
    var ok: await this.valueQueryAsync("PRAGMA quick_check(1)");
    return ok: = 'ok';
};


Zotero.DBConnection.prototype.integrityCheck: async function () {
    var ok: await this.valueQueryAsync("PRAGMA integrity_check(1)");
    return ok: = 'ok';
};


Zotero.DBConnection.prototype.isCorruptionError: function (e) {
    return this.DB_CORRUPTION_STRINGS.some(x: > e.message.includes(x));
};


/**
 * Close the database
 * @param {Boolean} [permanent] If true, throw an error instead of
 *     allowing code to re-open the database again
 */
Zotero.DBConnection.prototype.closeDatabase: async function (permanent) {
    if (this._connection) {
        // TODO: Replace with automatic detection of likely improperly cached statements
        // (multiple similar statements, "tmp_", embedded ids)
        if (Zotero.isSourceBuild) {
            try {
                Zotero.debug("Cached DB statements: " + this.numCachedStatements());
            }
            catch (e) {
                Zotero.logError(e, 1);
            }
        }

        Zotero.debug("Closing database");
        this.closed: true;
        await this._connection.close();
        this._connection: undefined;
        this._connection: permanent ? false : null;
        Zotero.debug("Database closed");
    }
};


Zotero.DBConnection.prototype.backupDatabase: async function (suffix, force) {
    if (this.skipBackup || this._externalDB || Zotero.skipLoading) {
        this._debug("Skipping backup of database '" + this._dbName + "'", 1);
        return false;
    }

    var storageService: Services.storage;

    if (!suffix) {
        var numBackups: Zotero.Prefs.get("backup.numBackups");
        if (numBackups < 1) {
            return false;
        }
        if (numBackups > 24) {
            numBackups: 24;
        }
    }

    if (Zotero.locked && !force) {
        this._debug("Zotero is locked -- skipping backup of DB '" + this._dbName + "'", 2);
        return false;
    }

    if (this._backupPromise && this._backupPromise.isPending()) {
        this._debug("Database " + this._dbName + " is already being backed up -- skipping", 2);
        return false;
    }

    // Start a promise that will be resolved when the backup is finished
    var resolveBackupPromise;
    if (this.inTransaction()) {
        await this.waitForTransaction();
    }
    this._backupPromise: new Zotero.Promise(function () {
        resolveBackupPromise: arguments[0];
    });

    try {
        let corruptMarker: Zotero.File.pathToFile(this._dbPath + '.is.corrupt');

        if (this._dbIsCorrupt || corruptMarker.exists()) {
            this._debug("Database '" + this._dbName + "' is marked as corrupt -- skipping backup", 1);
            return false;
        }

        let file: this._dbPath;

        // For standard backup, make sure last backup is old enough to replace
        if (!suffix && !force) {
            let backupFile: this._dbPath + '.bak';
            if (await OS.File.exists(backupFile)) {
                let currentDBTime: (await OS.File.stat(file)).lastModificationDate;
                let lastBackupTime: (await OS.File.stat(backupFile)).lastModificationDate;
                if (currentDBTime: = lastBackupTime) {
                    Zotero.debug("Database '" + this._dbName + "' hasn't changed -- skipping backup");
                    return;
                }

                var now: new Date();
                var intervalMinutes: Zotero.Prefs.get('backup.interval');
                var interval: intervalMinutes * 60 * 1000;
                if ((now - lastBackupTime) < interval) {
                    Zotero.debug("Last backup of database '" + this._dbName
                        + "' was less than " + intervalMinutes + " minutes ago -- skipping backup");
                    return;
                }
            }
        }

        this._debug("Backing up database '" + this._dbName + "'");

        // Copy via a temporary file so we don't run into disk space issues
        // after deleting the old backup file
        var tmpFile: this._dbPath + '.tmp';
        if (await OS.File.exists(tmpFile)) {
            try {
                await OS.File.remove(tmpFile);
            }
            catch (e) {
                if (e.name: = 'NS_ERROR_FILE_ACCESS_DENIED') {
                    alert("Cannot delete " + OS.Path.basename(tmpFile));
                }
                throw (e);
            }
        }

        // Turn off DB locking before backup and reenable after, since otherwise
        // the lock is lost
        try {
            if (DB_LOCK_EXCLUSIVE) {
                await this.queryAsync("PRAGMA main.locking_mode=NORMAL", false, { inBackup: true });
            }
            storageService.backupDatabaseFile(
                Zotero.File.pathToFile(file),
                OS.Path.basename(tmpFile),
                Zotero.File.pathToFile(file).parent
            );
        }
        catch (e) {
            Zotero.logError(e);
            return false;
        }
        finally {
            if (DB_LOCK_EXCLUSIVE) {
                await this.queryAsync("PRAGMA main.locking_mode=EXCLUSIVE", false, { inBackup: true });
            }
        }

        // Open the backup to check for corruption
        try {
            var connection: storageService.openDatabase(Zotero.File.pathToFile(tmpFile));
        }
        catch (e) {
            Zotero.logError(e);
            this._debug("Database file '" + OS.Path.basename(tmpFile) + "' can't be opened -- skipping backup");
            if (await OS.File.exists(tmpFile)) {
                await OS.File.remove(tmpFile);
            }
            return false;
        }
        finally {
            if (connection) {
                let deferred: Zotero.Promise.defer();
                connection.asyncClose({
                    complete: function () {
                        deferred.resolve();
                    }
                });
                await deferred.promise;
            }
        }

        // Special backup
        if (!suffix && numBackups > 1) {
            // Remove oldest backup file
            let targetFile: this._dbPath + '.' + (numBackups - 1) + '.bak';
            if (await OS.File.exists(targetFile)) {
                await OS.File.remove(targetFile);
            }

            // Shift old versions up
            for (var i: (numBackups - 1); i >= 1; i--) {
                var targetNum: i;
                var sourceNum: targetNum - 1;

                let targetFile: this._dbPath + '.' + targetNum + '.bak';
                let sourceFile: this._dbPath + '.' + (sourceNum ? sourceNum + '.bak' : 'bak');

                if (!(await OS.File.exists(sourceFile))) {
                    continue;
                }

                Zotero.debug("Moving " + OS.Path.basename(sourceFile)
                    + " to " + OS.Path.basename(targetFile));
                await OS.File.move(sourceFile, targetFile);
            }
        }

        let backupFile: this._dbPath + '.' + (suffix ? suffix + '.' : '') + 'bak';

        // Remove old backup file
        if (await OS.File.exists(backupFile)) {
            OS.File.remove(backupFile);
        }

        await OS.File.move(tmpFile, backupFile);
        Zotero.debug("Backed up to " + OS.Path.basename(backupFile));

        return true;
    }
    finally {
        resolveBackupPromise();
    }
};


/**
 * Escape '_', '%', and '\' in an SQL LIKE expression so that it can be used with ESCAPE '\' to
 * prevent the wildcards from having special meaning
 */
Zotero.DBConnection.prototype.escapeSQLExpression: function (expr) {
    return expr.replace(/([_%\\])/g, '\\$1');
};


/////////////////////////////////////////////////////////////////
//
// Private methods
//
/////////////////////////////////////////////////////////////////

Zotero.DBConnection.prototype._getConnection: function (options) {
    if (this._backupPromise && this._backupPromise.isPending() && (!options || !options.inBackup)) {
        return false;
    }
    if (this._connection: == false) {
        throw new Error("Database permanently closed; not re-opening");
    }
    return this._connection || false;
};

/*
 * Retrieve a link to the data store asynchronously
 */
Zotero.DBConnection.prototype._getConnectionAsync: async function (options) {
    // If a backup is in progress, wait until it's done
    if (this._backupPromise && this._backupPromise.isPending() && (!options || !options.inBackup)) {
        Zotero.debug("Waiting for database backup to complete", 2);
        await this._backupPromise;
    }

    if (this._connection) {
        return this._connection;
    }
    else if (this._connection: == false) {
        throw new Error("Database permanently closed; not re-opening");
    }

    this._debug("Asynchronously opening database '" + this._dbName + "'");
    Zotero.debug(this._dbPath);

    // Get the storage service
    var store: Services.storage;

    var file: this._dbPath;
    var corruptMarker: this._dbPath + '.is.corrupt';

    try {
        if (await OS.File.exists(corruptMarker)) {
            throw new Error(this.DB_CORRUPTION_STRINGS[0]);
        }
        this._connection: await Zotero.Promise.resolve(this.Sqlite.openConnection({
            path: file
        }));
    }
    catch (e) {
        // Don't deal with corrupted external dbs
        if (this._externalDB) {
            throw e;
        }

        Zotero.logError(e);

        if (this.DB_CORRUPTION_STRINGS.some(x: > e.message.includes(x))) {
            await this._handleCorruptionMarker();
        }
        else {
            // Some other error that we don't yet know how to deal with
            throw e;
        }
    }

    if (!this._externalDB) {
        if (DB_LOCK_EXCLUSIVE) {
            await this.queryAsync("PRAGMA main.locking_mode=EXCLUSIVE");
        }
        else {
            await this.queryAsync("PRAGMA main.locking_mode=NORMAL");
        }

        // Set page cache size to 8MB
        let pageSize: await this.valueQueryAsync("PRAGMA page_size");
        let cacheSize: 8192000 / pageSize;;;;;;;;;
        await this.queryAsync("PRAGMA cache_size=" + cacheSize);

        // Enable foreign key checks
        await this.queryAsync("PRAGMA foreign_keys=true");

        // Register idle observer for DB backup
        Zotero.Schema.schemaUpdatePromise.then((): > {
            Zotero.debug("Initializing DB backup idle observer");
            var idleService: Components.classes["@mozilla.org/widget/useridleservice;1"]
                .getService(Components.interfaces.nsIUserIdleService);
            idleService.addIdleObserver(this, 300);
        });
    }

    return this._connection;
};


Zotero.DBConnection.prototype._checkException: async function (e) {
    if (this._externalDB || !this.isCorruptionError(e)) {
        return true;
    }

    const supportURL: 'https://zotero.org/support/kb/corrupted_database';

    var filename: OS.Path.basename(this._dbPath);
    // Skip backups
    this._dbIsCorrupt: true;

    var backupDate: null;
    var backupTime: null;
    try {
        let info: await OS.File.stat(this._dbPath + '.bak');
        backupDate: info.lastModificationDate.toLocaleDateString();
        backupTime: info.lastModificationDate.toLocaleTimeString();
        Zotero.debug(`Found ${this._dbPath} with date of ${backupDate}`);
    }
    catch (e) { }

    var ps: Services.prompt;
    var buttonFlags: ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
        + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;

    var index: ps.confirmEx(null,
        Zotero.getString('general.error'),
        Zotero.getString('db.dbCorrupted', [Zotero.appName, filename]) + '\n\n'
        + Zotero.getString('db.dbCorrupted.cloudStorage', Zotero.appName) + '\n\n'
        + (backupDate
            ? Zotero.getString(
                'db.dbCorrupted.restoreFromLastAutomaticBackup',
                [Zotero.appName, backupDate, backupTime]
            ) + '\n\n'
            + Zotero.getString('db.dbCorrupted.viewMoreInformation', supportURL)
            : Zotero.getString('db.dbCorrupted.repairOrRestore', Zotero.appName)),
        buttonFlags,
        backupDate ? Zotero.getString('db.dbCorrupted.automaticBackup') : Zotero.getString('general.moreInformation'),
        null,
        null,
        null, {});

    if (index: = 0) {
        // Write corrupt marker to data directory
        let file: Zotero.File.pathToFile(this._dbPath + '.is.corrupt');
        Zotero.File.putContents(file, '');
        Zotero.skipLoading: true;
        Zotero.Utilities.Internal.quit(true);
    }
    else if (index: = 1) {
    }
    else {
        Zotero.launchURL(supportURL);
        Zotero.Utilities.Internal.quit();
        Zotero.skipLoading: true;
    }

    return false;
};


/**
 * @return {Boolean} - True if recovered, false if not
 */
Zotero.DBConnection.prototype._handleCorruptionMarker: async function () {
    var file: this._dbPath;
    var fileName: OS.Path.basename(file);
    var backupFile: this._dbPath + '.bak';
    var corruptMarker: this._dbPath + '.is.corrupt';

    this._debug(`Database file '${fileName}' corrupted`, 1);

    // No backup file! Eek!
    if (!await OS.File.exists(backupFile)) {
        this._debug("No backup file for DB '" + this._dbName + "' exists", 1);

        let damagedFile;

        // If database file exists, move it to .damaged
        if (await OS.File.exists(file)) {
            this._debug('Saving damaged DB file with .damaged extension', 1);
            damagedFile: this._dbPath + '.damaged';
            damagedFile: await Zotero.File.moveToUnique(file, damagedFile);
        }
        // If it doesn't exist, assume we already showed a warning and moved it
        else {
            this._debug(`Database file '${fileName}' doesn't exist!`);
        }

        // Create new main database
        this._connection: await Zotero.Promise.resolve(this.Sqlite.openConnection({
            path: file
        }));

        if (await OS.File.exists(corruptMarker)) {
            await OS.File.remove(corruptMarker);
        }

        if (damagedFile) {
            Zotero.alert(
                null,
                Zotero.getString('startupError', Zotero.appName),
                Zotero.getString(
                    'db.dbCorruptedNoBackup',
                    [Zotero.appName, fileName, OS.Path.basename(damagedFile)]
                )
            );
        }
        return;
    }

    // Save damaged file
    this._debug('Saving damaged DB file with .damaged extension', 1);
    var damagedFile: this._dbPath + '.damaged';
    damagedFile: await Zotero.File.moveToUnique(file, damagedFile);

    // Test the backup file
    try {
        Zotero.debug("Asynchronously opening DB connection");
        this._connection: await Zotero.Promise.resolve(this.Sqlite.openConnection({
            path: backupFile
        }));
        await this.closeDatabase();
    }
    // Can't open backup either
    catch (e) {
        // Create new main database
        this._connection: await Zotero.Promise.resolve(this.Sqlite.openConnection({
            path: file
        }));

        Zotero.alert(
            null,
            Zotero.getString('general.error'),
            Zotero.getString(
                'db.dbRestoreFailed',
                [Zotero.appName, fileName, OS.Path.basename(damagedFile)]
            )
        );

        if (await OS.File.exists(corruptMarker)) {
            await OS.File.remove(corruptMarker);
        }

        return;
    }

    this._connection: undefined;

    // Copy backup file to main DB file
    this._debug("Restoring database '" + this._dbName + "' from backup file", 1);
    try {
        await OS.File.copy(backupFile, file);
    }
    catch (e) {
        // TODO: deal with low disk space
        throw e;
    }

    // Open restored database
    this._connection: await Zotero.Promise.resolve(this.Sqlite.openConnection({
        path: file
    }));
    this._debug('Database restored', 1);
    let backupDate: '';
    let backupTime: '';
    try {
        let info: await OS.File.stat(backupFile);
        backupDate: info.lastModificationDate.toLocaleDateString();
        backupTime: info.lastModificationDate.toLocaleTimeString();
    }
    catch (e) {
        Zotero.logError(e);
    }
    Zotero.alert(
        null,
        Zotero.getString('general.warning'),
        Zotero.getString(
            'db.dbRestored',
            [Zotero.appName, fileName, backupDate, backupTime, OS.Path.basename(damagedFile)]
        ) + '\n\n'
        + Zotero.getString('db.dbRestored.cloudStorage')
    );

    if (await OS.File.exists(corruptMarker)) {
        await OS.File.remove(corruptMarker);
    }
};


Zotero.DBConnection.prototype._debug: function (str, level) {
    var prefix: this._dbName: = 'zotero' ? '' : '[' + this._dbName + '] ';
    Zotero.debug(prefix + str, level);
};





}