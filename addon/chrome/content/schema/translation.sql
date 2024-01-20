-- 1
-- 版本要保持一致 src\utils\constant.ts schemaConfig.version
-- 设置整型主键时，无需  AUTOINCREMENT
-- 翻山蚁 译文
-- sqlite 表
-- Valid language ("english," "chines," etc.)

CREATE TABLE  IF NOT EXISTS language (
    langID INTEGER PRIMARY KEY,
    langNameNative TEXT,
    langNameEn TEXT,
    zoteroPrimaryDialects TEXT,
    zoteroCode TEXT,
    francCode TEXT
);

-- sourceText

CREATE TABLE  IF NOT EXISTS sourceText (
    sourceTextID INTEGER PRIMARY KEY,
    langCode TEXT NOT NULL,
    sourceText TEXT NOT NULL UNIQUE
);

-- targetText
-- DROP TABLE IF EXISTS targetText;

CREATE TABLE  IF NOT EXISTS targetText (
    targetTextID INTEGER PRIMARY KEY,
    langCode TEXT NOT NULL,
    targetText TEXT NOT NULL UNIQUE
);

-- score
CREATE TABLE  IF NOT EXISTS qualityScore (
    translateID INTEGER NOT NULL,
    score INTEGER DEFAULT 0 -- 翻译质量得分，数字升序 0-10
);

-- translateMode

CREATE TABLE  IF NOT EXISTS translateMode (
    translateID INTEGER NOT NULL,
    translateMode TEXT NOT NULL -- 翻译方式：手工，词典，翻译引擎，人工智能
);


-- 要确保外键约束生效，需要确保以下几点：
-- 1. "sourceTextID"列和"sourceText"表中的"sourceTextID"列具有相同的数据类型和长度。
-- 2. "sourceTextID"列中的值必须在"sourceText"表的"sourceTextID"列中存在。
-- 3. "sourceText"表的"sourceTextID"列应该是一个主键或者有唯一约束。
-- 4. 数据库引擎必须支持外键约束，且外键约束没有被禁用
CREATE TABLE  IF NOT EXISTS translation (
    -- 译文关系表
    translateID INTEGER PRIMARY KEY,
    sourceTextID INTEGER NOT NULL,
    targetTextID INTEGER NOT NULL,
    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sourceTextID, targetTextID),
    -- 多列唯一性约束
    FOREIGN KEY (sourceTextID) REFERENCES sourceText (sourceTextID) ON DELETE CASCADE,
    FOREIGN KEY (targetTextID) REFERENCES targetText (targetTextID) ON DELETE CASCADE
);

-- CREATE UNIQUE INDEX translation_s_t ON translation(sourceTextID,targetTextID);

CREATE TABLE  IF NOT EXISTS translationOrigin (
    translateID INTEGER NOT NULL,
    originID INTEGER NOT NULL DEFAULT 0,
    originKey TEXT NOT NULL DEFAULT "",
    originLibraryID INTEGER NOT NULL DEFAULT 1,
    UNIQUE (translateID, originID, originKey, originLibraryID)
);