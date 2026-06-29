package rtc

import (
	"errors"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"go.uber.org/zap"
)

type RTC struct {
	ctx *config.Context
	log.Log
}

func New(ctx *config.Context) *RTC {
	return &RTC{
		ctx: ctx,
		Log: log.NewTLog("RTC"),
	}
}

func (r *RTC) Route(route *wkhttp.WKHttp) {
	auth := route.Group("/v1/rtc", r.ctx.AuthMiddleware(route))
	{
		auth.GET("/config", r.config)
		auth.POST("/token", r.token)
	}
}

func (r *RTC) config(c *wkhttp.Context) {
	cfg := loadLiveKitConfig()
	c.Response(map[string]interface{}{
		"enabled":        cfg.enabled(),
		"ws_url":         cfg.WSURL,
		"token_ttl":      int(cfg.TokenTTL.Seconds()),
		"api_key_config": cfg.APIKey != "",
	})
}

func (r *RTC) token(c *wkhttp.Context) {
	cfg := loadLiveKitConfig()
	if !cfg.enabled() {
		c.ResponseError(errors.New("LiveKit未配置"))
		return
	}

	var req tokenReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误"))
		return
	}

	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		c.ResponseError(errors.New("房间不能为空"))
		return
	}
	if len([]rune(req.Room)) > maxRoomNameLength {
		c.ResponseError(errors.New("房间名称不能超过128个字符"))
		return
	}

	identity := c.GetLoginUID()
	if identity == "" {
		c.ResponseError(errors.New("登录用户无效"))
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = strings.TrimSpace(c.GetLoginName())
	}
	if name == "" {
		name = identity
	}

	ttl := cfg.TokenTTL
	if req.TTL > 0 {
		ttl = clampTTL(req.TTL)
	}

	permissions := normalizePermissions(req.Permissions)
	token, expiresAt, err := buildJoinToken(joinTokenOptions{
		Config:      cfg,
		Room:        req.Room,
		Identity:    identity,
		Name:        name,
		Metadata:    strings.TrimSpace(req.Metadata),
		Attributes:  req.Attributes,
		Permissions: permissions,
		TTL:         ttl,
	})
	if err != nil {
		r.Error("生成LiveKit token失败", zap.Error(err), zap.String("uid", identity), zap.String("room", req.Room))
		c.ResponseError(errors.New("生成LiveKit token失败"))
		return
	}

	c.Response(tokenResp{
		Token:       token,
		WSURL:       cfg.WSURL,
		Room:        req.Room,
		Identity:    identity,
		Name:        name,
		ExpiresAt:   expiresAt.Unix(),
		ExpiresIn:   int(ttl.Seconds()),
		Permissions: permissions,
	})
}

type tokenReq struct {
	Room        string            `json:"room"`
	Name        string            `json:"name"`
	Metadata    string            `json:"metadata"`
	Attributes  map[string]string `json:"attributes"`
	TTL         int               `json:"ttl"`
	Permissions *permissionReq    `json:"permissions"`
}

type tokenResp struct {
	Token       string         `json:"token"`
	WSURL       string         `json:"ws_url"`
	Room        string         `json:"room"`
	Identity    string         `json:"identity"`
	Name        string         `json:"name"`
	ExpiresAt   int64          `json:"expires_at"`
	ExpiresIn   int            `json:"expires_in"`
	Permissions permissionResp `json:"permissions"`
}
