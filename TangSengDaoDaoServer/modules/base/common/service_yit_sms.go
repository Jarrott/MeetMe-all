package common

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"go.uber.org/zap"
)

type YitSMSProvider struct {
	ctx *config.Context
	log.Log
}

func NewYitSMSProvider(ctx *config.Context) ISMSProvider {
	return &YitSMSProvider{
		ctx: ctx,
		Log: log.NewTLog("YitSMSProvider"),
	}
}

func isYitSMSConfigured() bool {
	return strings.TrimSpace(os.Getenv("YIT_SMS_SPID")) != "" && strings.TrimSpace(os.Getenv("YIT_SMS_PASSWORD")) != ""
}

func (p *YitSMSProvider) SendSMS(ctx context.Context, zone, phone string, code string) error {
	sendURL := strings.TrimSpace(os.Getenv("YIT_SMS_API_URL"))
	baseURL := strings.TrimSpace(os.Getenv("YIT_SMS_API_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://api.3yit.com"
	}
	spid := strings.TrimSpace(os.Getenv("YIT_SMS_SPID"))
	password := strings.TrimSpace(os.Getenv("YIT_SMS_PASSWORD"))
	if spid == "" || password == "" {
		return errors.New("3yit 短信服务未配置")
	}

	if sendURL == "" {
		apiPath := strings.TrimSpace(os.Getenv("YIT_SMS_API_PATH"))
		if apiPath == "" {
			apiPath = "api/send-sms-single"
		}
		sendURL = strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(apiPath, "/")
	}
	content := buildSMSContent(code)

	form := url.Values{}
	form.Set("sp_id", spid)
	form.Set("password", password)
	form.Set("mobile", normalizeSMSPhone(zone, phone))
	form.Set("content", content)
	if ext := strings.TrimSpace(os.Getenv("YIT_SMS_EXT")); ext != "" {
		form.Set("ext", ext)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sendURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Expect", "")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		p.Error("3yit 短信发送请求失败", zap.Error(err), zap.String("phone", phone))
		return errors.New("短信发送失败")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		p.Error("3yit 短信发送失败", zap.Int("status", resp.StatusCode), zap.ByteString("body", body), zap.String("phone", phone))
		return errors.New("短信发送失败")
	}
	if err = parseSMSProviderResponse(body); err != nil {
		p.Error("3yit 短信发送返回失败", zap.ByteString("body", body), zap.String("phone", phone), zap.Error(err))
		return errors.New("短信发送失败")
	}
	return nil
}

type TextboostSMSProvider struct {
	ctx *config.Context
	log.Log
}

func NewTextboostSMSProvider(ctx *config.Context) ISMSProvider {
	return &TextboostSMSProvider{
		ctx: ctx,
		Log: log.NewTLog("TextboostSMSProvider"),
	}
}

func (p *TextboostSMSProvider) SendSMS(ctx context.Context, zone, phone string, code string) error {
	apiURL := strings.TrimSpace(os.Getenv("TEXTBOOST_SMS_API_URL"))
	apiKey := strings.TrimSpace(os.Getenv("TEXTBOOST_API_KEY"))
	if apiURL == "" || apiKey == "" {
		return errors.New("Textboost 短信服务未配置")
	}
	payload := map[string]string{
		"to":      normalizeSMSPhone(zone, phone),
		"message": buildSMSContent(code),
	}
	if from := strings.TrimSpace(os.Getenv("TEXTBOOST_FROM")); from != "" {
		payload["from"] = from
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		p.Error("Textboost 短信发送请求失败", zap.Error(err), zap.String("phone", phone))
		return errors.New("短信发送失败")
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		p.Error("Textboost 短信发送失败", zap.Int("status", resp.StatusCode), zap.ByteString("body", respBody), zap.String("phone", phone))
		return errors.New("短信发送失败")
	}
	if err = parseSMSProviderResponse(respBody); err != nil {
		p.Error("Textboost 短信发送返回失败", zap.ByteString("body", respBody), zap.String("phone", phone), zap.Error(err))
		return errors.New("短信发送失败")
	}
	return nil
}

func buildSMSContent(code string) string {
	tpl := strings.TrimSpace(os.Getenv("SMS_VERIFICATION_TEMPLATE"))
	if tpl == "" {
		tpl = "Your verification code is %6%. Please use it within 10 minutes."
	}
	replacer := strings.NewReplacer("%6%", code, "{code}", code, "${code}", code)
	return replacer.Replace(tpl)
}

func normalizeSMSPhone(zone, phone string) string {
	phone = normalizePhoneDigits(phone)
	zone = strings.TrimSpace(zone)
	if zone == "" || zone == "0086" {
		return phone
	}
	zone = strings.TrimPrefix(zone, "00")
	zone = strings.TrimPrefix(zone, "+")
	zone = normalizePhoneDigits(zone)
	if zone == "" {
		return phone
	}
	if strings.HasPrefix(phone, zone) {
		return phone
	}
	phone = strings.TrimLeft(phone, "0")
	return zone + phone
}

func normalizePhoneDigits(value string) string {
	value = strings.TrimSpace(value)
	var builder strings.Builder
	for _, r := range value {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func parseSMSProviderResponse(body []byte) error {
	text := strings.TrimSpace(string(body))
	if text == "" {
		return nil
	}
	lower := strings.ToLower(text)
	if lower == "0" || strings.Contains(lower, `"success":true`) || strings.Contains(lower, `"status":"success"`) {
		return nil
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(body, &decoded); err == nil {
		for _, key := range []string{"code", "error_code", "statusCode"} {
			if code, ok := decoded[key]; ok {
				codeText := fmt.Sprint(code)
				if codeText != "" && codeText != "0" && codeText != "200" {
					return fmt.Errorf("provider %s %v", key, code)
				}
			}
		}
		if success, ok := decoded["success"].(bool); ok && !success {
			return errors.New("provider success false")
		}
		if status, ok := decoded["status"].(string); ok {
			status = strings.ToLower(status)
			if status != "" && status != "success" && status != "ok" && status != "0" {
				return fmt.Errorf("provider status %s", status)
			}
		}
		return nil
	}
	if strings.Contains(lower, "error") || strings.Contains(lower, "fail") || strings.Contains(lower, "invalid") {
		return errors.New(text)
	}
	return nil
}
