-- 1
-- 版本要保持一致 src\utils\constant.ts schemaConfig.version
-- 翻山蚁
-- 有用户数据，更新时应当迁移数据

CREATE TABLE IF NOT EXISTS fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT);

CREATE TABLE settings (
    setting TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (setting, key)
);

-- Settings that get synced between Zotero installations
CREATE TABLE  IF NOT EXISTS syncedSettings (
    setting TEXT NOT NULL,
    libraryID INT NOT NULL,
    value NOT NULL,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    PRIMARY KEY (setting, libraryID),
    FOREIGN KEY (libraryID) REFERENCES libraries (libraryID) ON DELETE CASCADE
);

-- path can belong to dir or file
CREATE TABLE encryptFilePaths (MD5 TEXT NOT NULL DEFAULT "none" PRIMARY KEY, path TEXT NOT NULL DEFAULT "none", encryptAESStringNoBuffer TEXT NOT NULL DEFAULT "none");

CREATE TABLE IF NOT EXISTS version (schema TEXT PRIMARY KEY, version INT NOT NULL);

DROP INDEX IF EXISTS schema;

CREATE INDEX schema ON version (schema);