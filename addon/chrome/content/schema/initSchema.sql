-- 1

-- 翻山蚁 sqlite 表

-- Valid language ("english," "chines," etc.)

DROP TABLE IF EXISTS language;

CREATE TABLE
    language (
        langID INTEGER PRIMARY KEY AUTOINCREMENT,
        langNameNative TEXT,
        langNameEn TEXT,
        zoteroPrimaryDialects TEXT,
        zoteroCode TEXT,
        francCode TEXT
    );

DROP TABLE IF EXISTS fields;

CREATE TABLE
    fields (
        fieldID INTEGER PRIMARY KEY,
        fieldName TEXT
    );

-- sourceText
DROP TABLE IF EXISTS sourceText;

CREATE TABLE
    sourceText (
        sourceTextID INTEGER PRIMARY KEY AUTOINCREMENT,
        langCode TEXT NOT NULL,
        sourceText TEXT NOT NULL UNIQUE
    );

-- targetText
DROP TABLE IF EXISTS targetText;

CREATE TABLE
    targetText (
        targetTextID INTEGER PRIMARY KEY AUTOINCREMENT,
        langCode TEXT NOT NULL,
        targetText TEXT NOT NULL UNIQUE
    );

-- score
DROP TABLE IF EXISTS score;

CREATE TABLE
    score (
        translateID INTEGER NOT NULL,
        score INTEGER -- 翻译质量得分，数字升序 1-10
    );

-- translateMode
DROP TABLE IF EXISTS translateMode;

CREATE TABLE
    translateMode (
        translateID INTEGER NOT NULL,
        translateMode TEXT NOT NULL -- 翻译方式：手工，词典，翻译引擎，人工智能
    );

DROP TABLE IF EXISTS translation;
CREATE TABLE
    translation (
        translateID INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceTextID INTEGER NOT NULL,
        targetTextID INTEGER NOT NULL,
        dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (sourceTextID, targetTextID) -- 多列唯一性约束
    );
-- CREATE UNIQUE INDEX translation_s_t ON translation(sourceTextID,targetTextID);

DROP TABLE IF EXISTS translationOrigin;
CREATE TABLE
    translationOrigin (
        translateID INTEGER NOT NULL,
        originID INTEGER,
        originKey TEXT,
        originLibraryID INTEGER,
        UNIQUE (translateID,originID,originKey,originLibraryID)
    );

CREATE TABLE version (
    schema TEXT PRIMARY KEY,
    version INT NOT NULL
);
CREATE INDEX schema ON version(schema);