package webhook

import (
	"errors"
	"fmt"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/user"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/sideshow/apns2"
	"github.com/sideshow/apns2/certificate"
	apnstoken "github.com/sideshow/apns2/token"
)

// IOSPayload iOS负载
type IOSPayload struct {
	Payload
}

// NewIOSPayload NewIOSPayload
func NewIOSPayload(payloadInfo *PayloadInfo) Payload {

	return &IOSPayload{
		Payload: payloadInfo.toPayload(),
	}
}

// IOSPush IOSPush
type IOSPush struct {
	client          *apns2.Client
	topic           string
	password        string
	p12FilePath     string
	tokenAuthKeyID  string
	tokenAuthTeamID string
	tokenAuthKey    string
	dev             bool // 是否是开发环境
	log.Log
}

// NewIOSPush NewIOSPush
func NewIOSPush(topic string, dev bool, p12FilePath string, password string, tokenAuth apnsTokenAuthConfig) *IOSPush {
	return &IOSPush{
		topic:           topic,
		dev:             dev,
		p12FilePath:     p12FilePath,
		password:        password,
		tokenAuthKeyID:  tokenAuth.KeyID,
		tokenAuthTeamID: tokenAuth.TeamID,
		tokenAuthKey:    tokenAuth.AuthKey,
		Log:             log.NewTLog("IOSPush"),
	}
}

func (p *IOSPush) createClient() (*apns2.Client, error) {
	if p.tokenAuthEnabled() {
		if strings.TrimSpace(p.tokenAuthKeyID) == "" || strings.TrimSpace(p.tokenAuthTeamID) == "" || strings.TrimSpace(p.tokenAuthKey) == "" {
			return nil, errors.New("apns p8配置不完整：keyID、teamID、authKey不能为空")
		}
		authKey, err := apnstoken.AuthKeyFromFile(p.tokenAuthKey)
		if err != nil {
			return nil, err
		}
		token := &apnstoken.Token{
			AuthKey: authKey,
			KeyID:   p.tokenAuthKeyID,
			TeamID:  p.tokenAuthTeamID,
		}
		return p.selectAPNSEnvironment(apns2.NewTokenClient(token)), nil
	}
	if strings.TrimSpace(p.p12FilePath) == "" {
		return nil, errors.New("apns p12证书路径不能为空")
	}
	cert, err := certificate.FromP12File(p.p12FilePath, p.password)
	if err != nil {
		return nil, err
	}
	return p.selectAPNSEnvironment(apns2.NewClient(cert)), nil
}

func (p *IOSPush) tokenAuthEnabled() bool {
	return strings.TrimSpace(p.tokenAuthKeyID) != "" || strings.TrimSpace(p.tokenAuthTeamID) != "" || strings.TrimSpace(p.tokenAuthKey) != ""
}

func (p *IOSPush) selectAPNSEnvironment(client *apns2.Client) *apns2.Client {
	if p.dev {
		return client.Development()
	}
	return client.Production()
}

// GetPayload 获取推送负载
func (p *IOSPush) GetPayload(msg msgOfflineNotify, ctx *config.Context, toUser *user.Resp) (Payload, error) {
	pushInfo, err := ParsePushInfo(msg, ctx, toUser)
	if err != nil {
		return nil, err
	}
	return NewIOSPayload(pushInfo), nil
}

// Push iOS推送
func (p *IOSPush) Push(deviceToken string, payload Payload) error {
	notification := &apns2.Notification{}
	notification.DeviceToken = deviceToken
	notification.Topic = p.topic

	rtcPayload := payload.GetRTCPayload()
	if rtcPayload != nil {
		fmt.Println("音视频推送。。。。。")
		notification.Payload = []byte(util.ToJson(map[string]interface{}{
			"aps": map[string]interface{}{
				"content-available": 1,
				"alert":             "",
				"badge":             payload.GetBadge(),
				"sound":             "default",
			},
			"content":   payload.GetContent(),
			"call_type": rtcPayload.GetCallType(),
			"from_uid":  rtcPayload.GetFromUID(),
		}))
	} else {
		fmt.Println("普通推送。。。。。")
		notification.Payload = []byte(util.ToJson(map[string]interface{}{
			"aps": map[string]interface{}{
				"alert": map[string]interface{}{
					"title": payload.GetTitle(),
					"body":  payload.GetContent(),
				},
				"badge": payload.GetBadge(),
				"sound": "default",
			},
		}))
	}

	var err error
	if p.client == nil {
		p.client, err = p.createClient()
		if err != nil {
			return err
		}
	}
	res, err := p.client.Push(notification)
	if err != nil {
		return err
	}
	if res.StatusCode != 200 {
		return errors.New(res.Reason)
	}
	return nil
}
