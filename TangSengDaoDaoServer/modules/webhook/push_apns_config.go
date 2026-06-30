package webhook

import (
	"os"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/spf13/viper"
)

type apnsTokenAuthConfig struct {
	AuthType string
	KeyID    string
	TeamID   string
	AuthKey  string
}

func (c apnsTokenAuthConfig) enabled() bool {
	return strings.EqualFold(c.AuthType, "p8") ||
		strings.TrimSpace(c.KeyID) != "" ||
		strings.TrimSpace(c.TeamID) != "" ||
		strings.TrimSpace(c.AuthKey) != ""
}

func loadAPNSTokenAuthConfig(cfg *config.Config) apnsTokenAuthConfig {
	tokenAuth := apnsTokenAuthConfig{
		AuthType: firstNonEmpty(os.Getenv("APNS_AUTH_TYPE")),
		KeyID:    firstNonEmpty(os.Getenv("APNS_KEY_ID")),
		TeamID:   firstNonEmpty(os.Getenv("APNS_TEAM_ID")),
		AuthKey:  firstNonEmpty(os.Getenv("APNS_AUTH_KEY"), os.Getenv("APNS_AUTH_KEY_PATH")),
	}
	if cfg == nil || strings.TrimSpace(cfg.ConfigFileUsed()) == "" {
		return tokenAuth
	}

	vp := viper.New()
	vp.SetConfigFile(cfg.ConfigFileUsed())
	if err := vp.ReadInConfig(); err != nil {
		return tokenAuth
	}

	tokenAuth.AuthType = firstNonEmpty(tokenAuth.AuthType, vp.GetString("push.apns.authType"))
	tokenAuth.KeyID = firstNonEmpty(tokenAuth.KeyID, vp.GetString("push.apns.keyID"))
	tokenAuth.TeamID = firstNonEmpty(tokenAuth.TeamID, vp.GetString("push.apns.teamID"))
	tokenAuth.AuthKey = firstNonEmpty(
		tokenAuth.AuthKey,
		vp.GetString("push.apns.authKey"),
		vp.GetString("push.apns.authKeyPath"),
		vp.GetString("push.apns.keyPath"),
	)
	return tokenAuth
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
