-- 1

-- 翻山蚁 sqlite 表

-- Valid language ("english," "chines," etc.)
CREATE TABLE
    IF NOT EXISTS language (
        langID INTEGER PRIMARY KEY,
        langName TEXT,
        langCode TEXT,
        display INT DEFAULT 1 -- 0 == hide, 1 == display, 2 == primary
    );

CREATE TABLE
    IF NOT EXISTS fields (
        fieldID INTEGER PRIMARY KEY,
        fieldName TEXT
    );

-- sourceText
CREATE TABLE
    IF NOT EXISTS sourceText (
        sourceTextID INTEGER PRIMARY KEY AUTOINCREMENT,
        langCode TEXT NOT NULL,
        sourceText TEXT NOT NULL UNIQUE
    );

-- targetText
CREATE TABLE
    IF NOT EXISTS targetText (
        targetTextID INTEGER PRIMARY KEY AUTOINCREMENT,
        langCode TEXT NOT NULL,
        targetText TEXT NOT NULL UNIQUE
    );

-- score
CREATE TABLE
    IF NOT EXISTS score (
        translateID INTEGER NOT NULL,
        score INTEGER NOT NULL DEFAULT 0 -- 翻译质量得分，数字升序 1-10
    );

-- translateMode
CREATE TABLE
    IF NOT EXISTS translateMode (
        translateID INTEGER NOT NULL,
        translateMode TEXT NOT NULL -- 翻译方式：手工，词典，翻译引擎，人工智能
    );

CREATE TABLE
    IF NOT EXISTS translation (
        translateID INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceTextID INTEGER NOT NULL,
        targetTextID INTEGER NOT NULL,
        dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        originID INTEGER,
        originKey TEXT,
        originLibraryID INTEGER
    );