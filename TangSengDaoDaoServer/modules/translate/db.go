package translate

import (
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/gocraft/dbr/v2"
)

type db struct {
	session *dbr.Session
	ctx     *config.Context
}

func newDB(ctx *config.Context) *db {
	return &db{
		session: ctx.DB(),
		ctx:     ctx,
	}
}

func (d *db) queryCache(contentHash string, sourceLang string, targetLang string, model string) (*translationCacheModel, error) {
	var cache *translationCacheModel
	_, err := d.session.Select("*").From("translation_cache").
		Where("content_hash=? and source_lang=? and target_lang=? and model=?", contentHash, sourceLang, targetLang, model).
		Load(&cache)
	if err == dbr.ErrNotFound {
		return nil, nil
	}
	return cache, err
}

func (d *db) upsertCache(cache *translationCacheModel) error {
	_, err := d.session.InsertBySql(`
insert into translation_cache(message_id,content_hash,source_lang,target_lang,model,translated_text)
values(?,?,?,?,?,?)
on duplicate key update message_id=values(message_id), translated_text=values(translated_text), updated_at=NOW()
`, cache.MessageID, cache.ContentHash, cache.SourceLang, cache.TargetLang, cache.Model, cache.TranslatedText).Exec()
	return err
}

type translationCacheModel struct {
	ID             int64
	MessageID      string
	ContentHash    string
	SourceLang     string
	TargetLang     string
	Model          string
	TranslatedText string
}
