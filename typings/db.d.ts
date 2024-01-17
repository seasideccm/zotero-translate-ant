interface IncompatibleVersionException {
    new(msg: any, dbClientVersion: any): this;
}

declare namespace Zotero {
    interface DBConnection {
        //constructor(dbNameOrPath?: string) { };
        new(dbNameOrPath?: string): this;
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
        IncompatibleVersionException: IncompatibleVersionException;

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
        removeCallback(type: 'begin' | 'commit' | 'rollback', id: string): void;
        rollbackAllTransactions(): number | boolean;
        getColumns(table: string): Promise<false | string[]>;
        getNextName(libraryID: any, table: any, field: any, name: any): Promise<string>;
        /**
         * @param {Function} func - Async function containing `await Zotero.DB.queryAsync()` and similar
         * @param {Object} [options]
         * @param {Boolean} [options.disableForeignKeys] - Disable foreign key constraints before
         *    transaction and re-enable after. (`PRAGMA foreign_keys=0|1` is a no-op during a transaction.)
         * @return {Promise} - Promise for result of generator function
         */
        executeTransaction(func: any, options?: any): Promise<await>;
        inTransaction(): boolean;
        waitForTransaction(id: any): any;
        requireTransaction(): void;
        /**
         * @param {String} sql SQL statement to run
         * @param {Array|String|Integer} [params] SQL parameters to bind
         * @param options - {noParseParams?, onRow?, noCache?}
         * @return {Promise|Array} - A promise for an array of rows. The individual
         *                         rows are Proxy objects that return values from the
         *                         underlying mozIStorageRows based on column names.
         */
        queryAsync(sql: string, params?: any, options?: any): Promise<any>;
        /**
         * query in Transaction
         * @param sql 
         * @param params 
         * @param options 
         * @returns 
         */
        queryTx(sql: string, params?: any, options?: any): Promise<any>;
        /**
         * @param {String} sql  SQL statement to run
         * @param {Array|String|Integer} [params]  SQL parameters to bind
         * @return {Promise<Array|Boolean>}  A promise for either the value or FALSE if no result
         */
        valueQueryAsync(sql: any, params?: any, options?: any): Promise<any>;
        /**
         * @param {String} sql SQL statement to run
         * @param {Array|String|Integer} [params] SQL parameters to bind
         * @return {Promise<Object>}  A promise for a proxied storage row
         */
        rowQueryAsync(sql: any, params: any): Promise<any>;
        /**
         * @param {String} sql SQL statement to run
         * @param {Array|String|Integer} [params] SQL parameters to bind
         * @return {Promise<Array>}  A promise for an array of values in the column
         */
        columnQueryAsync(sql: any, params: any, options: any): Promise<[]>;
        logQuery(sql: any, params: [], options: any): void;
        tableExists(table: any, dbName?: string): Promise<boolean>;
        columnExists(table: any, column: any): Promise<boolean>;
        indexExists(index: any, db: any): Promise<boolean>;
        parseSQLFile(sql: string): string[];
        /**
         * Parse SQL string and execute transaction with all statements
         *
         * @return {Promise}
         */
        executeSQLFile(sql: string): Promise<void>;
        /*
         * Implements nsIObserver
         *  case topic=='idle' backupDatabase
         */
        observe(subject: any, topic: any, data: any): void;
        numCachedStatements(): any;
        getCachedStatements(): any[];
        // TEMP
        vacuum(): any;
        // TEMP
        info(): Promise<any>;
        quickCheck(): Promise<await>;
        integrityCheck(): Promise<boolean>;
        isCorruptionError(e: any): boolean;
        /**
         * Close the database
         * @param {Boolean} [permanent] If true, throw an error instead of
         *     allowing code to re-open the database again
         */
        closeDatabase(permanent?: boolean): Promise<void>;
        backupDatabase(suffix: any, force: any): Promise<boolean | undefined>;
        /**
         * Escape '_', '%', and '\' in an SQL LIKE expression so that it can be used with ESCAPE '\' to
         * prevent the wildcards from having special meaning
         */
        escapeSQLExpression(expr: any): any;
        _getConnection(options: any): any;
        /*
         * Retrieve a link to the data store asynchronously
         */
        _getConnectionAsync(options: any): Promise<any>;
        _checkException(e: any): Promise<boolean>;
        /**
         * @return {Boolean} - True if recovered, false if not
         */
        _handleCorruptionMarker(): boolean;
        _debug(str: any, level: any): void;
    }
}







