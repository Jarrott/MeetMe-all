package translate

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"unicode"

	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"go.uber.org/zap"
)

const maxTranslateTextLength = 4000

type Translate struct {
	ctx           *config.Context
	db            *db
	commonService common.IService
	log.Log
}

func New(ctx *config.Context) *Translate {
	return &Translate{
		ctx:           ctx,
		db:            newDB(ctx),
		commonService: common.NewService(ctx),
		Log:           log.NewTLog("Translate"),
	}
}

func (t *Translate) Route(r *wkhttp.WKHttp) {
	auth := r.Group("/v1/translate", t.ctx.AuthMiddleware(r))
	{
		auth.GET("/config", t.config)
		auth.POST("/message", t.message)
	}
}

func (t *Translate) config(c *wkhttp.Context) {
	enabled, err := t.enabled()
	if err != nil {
		t.Error("查询翻译配置失败", zap.Error(err))
		c.ResponseError(errors.New("查询翻译配置失败"))
		return
	}
	c.Response(map[string]interface{}{
		"enabled": enabled,
		"model":   translateModelName(),
	})
}

func (t *Translate) message(c *wkhttp.Context) {
	enabled, err := t.enabled()
	if err != nil {
		t.Error("查询翻译配置失败", zap.Error(err))
		c.ResponseError(errors.New("查询翻译配置失败"))
		return
	}
	if !enabled {
		c.ResponseError(errors.New("自动翻译功能未开启"))
		return
	}

	var req translateMessageReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误"))
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	req.MessageID = strings.TrimSpace(req.MessageID)
	req.SourceLang = normalizeLang(req.SourceLang, "auto")
	req.TargetLang = normalizeLang(req.TargetLang, "")
	if req.Text == "" {
		c.ResponseError(errors.New("翻译内容不能为空"))
		return
	}
	if req.TargetLang == "" {
		c.ResponseError(errors.New("目标语言不能为空"))
		return
	}
	if len([]rune(req.Text)) > maxTranslateTextLength {
		c.ResponseError(errors.New("翻译内容不能超过4000字"))
		return
	}
	if !hasTranslatableText(req.Text) {
		c.ResponseError(errors.New("翻译内容不包含可翻译文字"))
		return
	}

	model := translateModelName()
	contentHash := hashText(req.Text)
	cache, err := t.db.queryCache(contentHash, req.SourceLang, req.TargetLang, model)
	if err != nil {
		t.Error("查询翻译缓存失败", zap.Error(err))
		c.ResponseError(errors.New("查询翻译缓存失败"))
		return
	}
	if cache != nil && cache.TranslatedText != "" {
		c.Response(&translateMessageResp{
			MessageID:       req.MessageID,
			SourceLang:      req.SourceLang,
			TargetLang:      req.TargetLang,
			TranslatedText:  cache.TranslatedText,
			Model:           model,
			Cached:          true,
			OriginalHash:    contentHash,
			OriginalTextLen: len([]rune(req.Text)),
		})
		return
	}

	client, err := newOpenAIClient()
	if err != nil {
		c.ResponseError(err)
		return
	}
	translated, err := client.translate(req.Text, req.SourceLang, req.TargetLang)
	if err != nil {
		t.Error("OpenAI翻译失败", zap.Error(err), zap.String("uid", c.GetLoginUID()))
		c.ResponseError(errors.New("OpenAI翻译失败：" + err.Error()))
		return
	}
	err = t.db.upsertCache(&translationCacheModel{
		MessageID:      req.MessageID,
		ContentHash:    contentHash,
		SourceLang:     req.SourceLang,
		TargetLang:     req.TargetLang,
		Model:          model,
		TranslatedText: translated,
	})
	if err != nil {
		t.Error("保存翻译缓存失败", zap.Error(err))
		c.ResponseError(errors.New("保存翻译缓存失败"))
		return
	}
	c.Response(&translateMessageResp{
		MessageID:       req.MessageID,
		SourceLang:      req.SourceLang,
		TargetLang:      req.TargetLang,
		TranslatedText:  translated,
		Model:           model,
		Cached:          false,
		OriginalHash:    contentHash,
		OriginalTextLen: len([]rune(req.Text)),
	})
}

func (t *Translate) enabled() (bool, error) {
	appConfig, err := t.commonService.GetAppConfig()
	if err != nil {
		return false, err
	}
	return appConfig.AutoTranslateOn == 1, nil
}

func normalizeLang(lang string, defaultLang string) string {
	lang = strings.TrimSpace(lang)
	if lang == "" {
		return defaultLang
	}
	return lang
}

func hashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

func hasTranslatableText(text string) bool {
	for _, r := range text {
		if unicode.IsLetter(r) {
			return true
		}
	}
	return false
}

type translateMessageReq struct {
	MessageID  string `json:"message_id"`
	Text       string `json:"text"`
	SourceLang string `json:"source_lang"`
	TargetLang string `json:"target_lang"`
}

type translateMessageResp struct {
	MessageID       string `json:"message_id"`
	SourceLang      string `json:"source_lang"`
	TargetLang      string `json:"target_lang"`
	TranslatedText  string `json:"translated_text"`
	Model           string `json:"model"`
	Cached          bool   `json:"cached"`
	OriginalHash    string `json:"original_hash"`
	OriginalTextLen int    `json:"original_text_len"`
}
