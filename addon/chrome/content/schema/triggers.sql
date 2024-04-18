-- 1
-- When making a standalone note a child, remove from any collections
-- 这是一个 SQLite 触发器，名为 fku_itemNotes_parentItemID_collectionItems_itemID。它在每次更新 itemNotes 表的 parentItemID 列之前触发。当满足条件 OLD.parentItemID 为空且 NEW.parentItemID 不为空时，触发器会执行 DELETE FROM collectionItems WHERE itemID = NEW.itemID。这个触发器的作用是在满足特定条件时从 collectionItems 表中删除行。
-- SQLite 教程 https://www.runoob.com/sqlite/sqlite-tutorial.html
-- SQLite 运算符 https://www.runoob.com/sqlite/sqlite-operators.html
DROP TRIGGER IF EXISTS translation_targetTextID_targetText_targetTextID;

CREATE TRIGGER translation_targetTextID_targetText_targetTextID
  AFTER DELETE ON translation
  FOR EACH ROW WHEN ( CT COUNT(*) FROM translation WHERE targetTextID = OLD.targetTextID) ISNULL BEGIN
  DELETE FROM targetText WHERE
  targetTextID = OLD.targetTextID;---
  END;