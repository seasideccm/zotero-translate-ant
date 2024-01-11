-- 1

-- 翻山蚁
DROP TABLE IF EXISTS fields;

CREATE TABLE
    fields (
        fieldID INTEGER PRIMARY KEY,
        fieldName TEXT
    );

DROP TABLE IF EXISTS settings;

CREATE TABLE
    settings (
        setting TEXT,
        key TEXT,
        value,
        PRIMARY KEY (setting, key)
    );