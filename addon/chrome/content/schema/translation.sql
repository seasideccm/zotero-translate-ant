-- 1

-- 翻山蚁 译文
-- sqlite 表

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
DROP TABLE IF EXISTS qualityScore;

CREATE TABLE
    qualityScore (
        translateID INTEGER NOT NULL,
        score INTEGER DEFAULT 0 -- 翻译质量得分，数字升序 0-10
    );

-- translateMode
DROP TABLE IF EXISTS translateMode;

CREATE TABLE
    translateMode (
        translateID INTEGER NOT NULL,
        translateMode TEXT NOT NULL -- 翻译方式：手工，词典，翻译引擎，人工智能
    );

DROP TABLE IF EXISTS translation;

-- 要确保外键约束生效，需要确保以下几点：
-- 1. "sourceTextID"列和"sourceText"表中的"sourceTextID"列具有相同的数据类型和长度。
-- 2. "sourceTextID"列中的值必须在"sourceText"表的"sourceTextID"列中存在。
-- 3. "sourceText"表的"sourceTextID"列应该是一个主键或者有唯一约束。
-- 4. 数据库引擎必须支持外键约束，且外键约束没有被禁用
CREATE TABLE
    translation (
        -- 译文关系表
        translateID INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceTextID INTEGER NOT NULL,
        targetTextID INTEGER NOT NULL,
        dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (sourceTextID, targetTextID),
        -- 多列唯一性约束
        FOREIGN KEY (sourceTextID) REFERENCES sourceText(sourceTextID) ON DELETE CASCADE,
        FOREIGN KEY (targetTextID) REFERENCES targetText(targetTextID) ON DELETE CASCADE
    );
-- CREATE UNIQUE INDEX translation_s_t ON translation(sourceTextID,targetTextID);

DROP TABLE IF EXISTS translationOrigin;

CREATE TABLE
    translationOrigin (
        translateID INTEGER NOT NULL,
        originID INTEGER NOT NULL DEFAULT 0,
        originKey TEXT NOT NULL DEFAULT "",
        originLibraryID INTEGER NOT NULL DEFAULT 1,
        UNIQUE (
            translateID,
            originID,
            originKey,
            originLibraryID
        )
    );

CREATE TABLE
    version (
        schema TEXT PRIMARY KEY,
        version INT NOT NULL
    );

CREATE INDEX schema ON version(schema);