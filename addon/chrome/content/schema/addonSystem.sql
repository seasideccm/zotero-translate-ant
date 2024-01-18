-- 1
-- 翻山蚁
DROP TABLE IF EXISTS fields;

CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT);

DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
    setting TEXT,
    key TEXT,
    value,
    PRIMARY KEY (setting, key)
);

DROP TABLE IF EXISTS syncedSettings;

-- Settings that get synced between Zotero installations
CREATE TABLE syncedSettings (
    setting TEXT NOT NULL,
    libraryID INT NOT NULL,
    value NOT NULL,
    version INT NOT NULL DEFAULT 0,
    synced INT NOT NULL DEFAULT 0,
    PRIMARY KEY (setting, libraryID),
    FOREIGN KEY (libraryID) REFERENCES libraries (libraryID) ON DELETE CASCADE
);

DROP TABLE IF EXISTS version;

CREATE TABLE version (schema TEXT PRIMARY KEY, version INT NOT NULL);

DROP INDEX IF EXISTS schema;

CREATE INDEX schema ON version (schema);