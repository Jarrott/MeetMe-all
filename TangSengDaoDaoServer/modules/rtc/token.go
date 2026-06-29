package rtc

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

const (
	defaultLiveKitWSURL = "wss://rtc.meetme.im"
	defaultTokenTTL     = time.Hour
	minTokenTTL         = time.Minute
	maxTokenTTL         = 24 * time.Hour
	maxRoomNameLength   = 128
)

type liveKitConfig struct {
	APIKey    string
	APISecret string
	WSURL     string
	TokenTTL  time.Duration
}

func loadLiveKitConfig() liveKitConfig {
	wsURL := strings.TrimRight(strings.TrimSpace(os.Getenv("LIVEKIT_WS_URL")), "/")
	if wsURL == "" {
		wsURL = defaultLiveKitWSURL
	}
	return liveKitConfig{
		APIKey:    strings.TrimSpace(os.Getenv("LIVEKIT_API_KEY")),
		APISecret: strings.TrimSpace(os.Getenv("LIVEKIT_API_SECRET")),
		WSURL:     wsURL,
		TokenTTL:  loadDefaultTTL(),
	}
}

func (c liveKitConfig) enabled() bool {
	return c.APIKey != "" && c.APISecret != ""
}

func loadDefaultTTL() time.Duration {
	raw := strings.TrimSpace(os.Getenv("LIVEKIT_TOKEN_TTL_SECONDS"))
	if raw == "" {
		return defaultTokenTTL
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return defaultTokenTTL
	}
	return clampTTL(seconds)
}

func clampTTL(seconds int) time.Duration {
	ttl := time.Duration(seconds) * time.Second
	if ttl < minTokenTTL {
		return minTokenTTL
	}
	if ttl > maxTokenTTL {
		return maxTokenTTL
	}
	return ttl
}

type joinTokenOptions struct {
	Config      liveKitConfig
	Room        string
	Identity    string
	Name        string
	Metadata    string
	Attributes  map[string]string
	Permissions permissionResp
	TTL         time.Duration
}

func buildJoinToken(opts joinTokenOptions) (string, time.Time, error) {
	if !opts.Config.enabled() {
		return "", time.Time{}, errors.New("LiveKit未配置")
	}
	if strings.TrimSpace(opts.Room) == "" {
		return "", time.Time{}, errors.New("房间不能为空")
	}
	if strings.TrimSpace(opts.Identity) == "" {
		return "", time.Time{}, errors.New("用户身份不能为空")
	}
	if opts.TTL <= 0 {
		opts.TTL = defaultTokenTTL
	}

	now := time.Now()
	expiresAt := now.Add(opts.TTL)
	claims := liveKitClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    opts.Config.APIKey,
			Subject:   opts.Identity,
			NotBefore: jwt.NewNumericDate(now.Add(-5 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
		},
		Name:       opts.Name,
		Metadata:   opts.Metadata,
		Attributes: sanitizeAttributes(opts.Attributes),
		Video: liveKitVideoGrant{
			RoomJoin:             true,
			Room:                 opts.Room,
			CanPublish:           boolPtr(opts.Permissions.CanPublish),
			CanSubscribe:         boolPtr(opts.Permissions.CanSubscribe),
			CanPublishData:       boolPtr(opts.Permissions.CanPublishData),
			CanUpdateOwnMetadata: boolPtr(opts.Permissions.CanUpdateOwnMetadata),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(opts.Config.APISecret))
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

type liveKitClaims struct {
	jwt.RegisteredClaims
	Name       string            `json:"name,omitempty"`
	Metadata   string            `json:"metadata,omitempty"`
	Attributes map[string]string `json:"attributes,omitempty"`
	Video      liveKitVideoGrant `json:"video"`
}

type liveKitVideoGrant struct {
	RoomJoin             bool     `json:"roomJoin"`
	Room                 string   `json:"room,omitempty"`
	CanPublish           *bool    `json:"canPublish,omitempty"`
	CanSubscribe         *bool    `json:"canSubscribe,omitempty"`
	CanPublishData       *bool    `json:"canPublishData,omitempty"`
	CanUpdateOwnMetadata *bool    `json:"canUpdateOwnMetadata,omitempty"`
	RoomAdmin            bool     `json:"roomAdmin,omitempty"`
	RoomRecord           bool     `json:"roomRecord,omitempty"`
	RoomCreate           bool     `json:"roomCreate,omitempty"`
	RoomList             bool     `json:"roomList,omitempty"`
	CanPublishSources    []string `json:"canPublishSources,omitempty"`
}

type permissionReq struct {
	CanPublish           *bool `json:"can_publish"`
	CanSubscribe         *bool `json:"can_subscribe"`
	CanPublishData       *bool `json:"can_publish_data"`
	CanUpdateOwnMetadata *bool `json:"can_update_own_metadata"`
}

type permissionResp struct {
	CanPublish           bool `json:"can_publish"`
	CanSubscribe         bool `json:"can_subscribe"`
	CanPublishData       bool `json:"can_publish_data"`
	CanUpdateOwnMetadata bool `json:"can_update_own_metadata"`
}

func normalizePermissions(req *permissionReq) permissionResp {
	resp := permissionResp{
		CanPublish:           true,
		CanSubscribe:         true,
		CanPublishData:       true,
		CanUpdateOwnMetadata: true,
	}
	if req == nil {
		return resp
	}
	if req.CanPublish != nil {
		resp.CanPublish = *req.CanPublish
	}
	if req.CanSubscribe != nil {
		resp.CanSubscribe = *req.CanSubscribe
	}
	if req.CanPublishData != nil {
		resp.CanPublishData = *req.CanPublishData
	}
	if req.CanUpdateOwnMetadata != nil {
		resp.CanUpdateOwnMetadata = *req.CanUpdateOwnMetadata
	}
	return resp
}

func sanitizeAttributes(attrs map[string]string) map[string]string {
	if len(attrs) == 0 {
		return nil
	}
	cleaned := make(map[string]string, len(attrs))
	for key, value := range attrs {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		cleaned[key] = strings.TrimSpace(value)
	}
	if len(cleaned) == 0 {
		return nil
	}
	return cleaned
}

func boolPtr(value bool) *bool {
	return &value
}
