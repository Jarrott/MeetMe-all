package common

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"go.uber.org/zap"
)

type IEmailService interface {
	SendVerifyCode(ctx context.Context, email string, codeType CodeType) error
	Verify(ctx context.Context, email, code string, codeType CodeType) error
}

type EmailService struct {
	ctx *config.Context
	log.Log
}

func NewEmailService(ctx *config.Context) *EmailService {
	return &EmailService{
		ctx: ctx,
		Log: log.NewTLog("EmailService"),
	}
}

func (s *EmailService) SendVerifyCode(ctx context.Context, email string, codeType CodeType) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return errors.New("邮箱不能为空")
	}
	rateLimitKey := fmt.Sprintf("email_rate_limit:%s", email)
	exists, err := s.ctx.GetRedisConn().GetString(rateLimitKey)
	if err != nil {
		return err
	}
	if exists != "" {
		return errors.New("发送过于频繁，请1分钟后再试")
	}

	verifyCode, err := generateSecureVerifyCode(6)
	if err != nil {
		s.Error("生成邮箱验证码失败", zap.Error(err))
		return errors.New("系统错误，请稍后重试")
	}
	cacheKey := fmt.Sprintf("%s%d@%s", CacheKeyEmailCode, codeType, email)
	if err = s.ctx.GetRedisConn().SetAndExpire(cacheKey, verifyCode, time.Minute*5); err != nil {
		return err
	}
	if err = s.ctx.GetRedisConn().SetAndExpire(rateLimitKey, "1", time.Minute); err != nil {
		return err
	}

	if err = s.sendMail(ctx, email, verifyCode); err != nil {
		s.ctx.GetRedisConn().Del(cacheKey)
		s.ctx.GetRedisConn().Del(rateLimitKey)
		return err
	}
	return nil
}

func (s *EmailService) Verify(ctx context.Context, email, code string, codeType CodeType) error {
	span, _ := s.ctx.Tracer().StartSpanFromContext(ctx, "emailService.Verify")
	defer span.Finish()

	email = strings.ToLower(strings.TrimSpace(email))
	code = strings.TrimSpace(code)
	lockKey := fmt.Sprintf("email_verify_lock:%s", email)
	locked, err := s.ctx.GetRedisConn().GetString(lockKey)
	if err != nil {
		return err
	}
	if locked != "" {
		return errors.New("验证失败次数过多，请10分钟后再试")
	}

	cacheKey := fmt.Sprintf("%s%d@%s", CacheKeyEmailCode, codeType, email)
	sysCode, err := s.ctx.GetRedisConn().GetString(cacheKey)
	if err != nil {
		return err
	}
	if sysCode != "" && subtle.ConstantTimeCompare([]byte(sysCode), []byte(code)) == 1 {
		s.ctx.GetRedisConn().Del(cacheKey)
		failCountKey := fmt.Sprintf("email_verify_fail:%s", email)
		s.ctx.GetRedisConn().Del(failCountKey)
		s.ctx.GetRedisConn().Del(lockKey)
		return nil
	}

	failCountKey := fmt.Sprintf("email_verify_fail:%s", email)
	failCountStr, _ := s.ctx.GetRedisConn().GetString(failCountKey)
	failCount := 0
	if failCountStr != "" {
		if count, err := strconv.Atoi(failCountStr); err == nil {
			failCount = count
		}
	}
	failCount++
	if failCount >= 3 {
		s.ctx.GetRedisConn().SetAndExpire(lockKey, "1", time.Minute*10)
		return errors.New("验证失败次数过多，已锁定10分钟")
	}
	s.ctx.GetRedisConn().SetAndExpire(failCountKey, fmt.Sprintf("%d", failCount), time.Minute*10)
	return errors.New("验证码无效！")
}

func (s *EmailService) sendMail(ctx context.Context, toEmail string, code string) error {
	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) != "" {
		return s.sendResendMail(ctx, toEmail, code)
	}

	cfg := s.ctx.GetConfig().Support
	fromEmail := strings.TrimSpace(cfg.Email)
	smtpAddr := strings.TrimSpace(cfg.EmailSmtp)
	password := strings.TrimSpace(cfg.EmailPwd)
	if fromEmail == "" || smtpAddr == "" || password == "" {
		return errors.New("邮箱验证码服务未配置")
	}
	host := smtpAddr
	if idx := strings.Index(host, ":"); idx > 0 {
		host = host[:idx]
	}
	subject := "MeetMe 注册验证码"
	body := fmt.Sprintf("您的 MeetMe 注册验证码是：%s\n\n验证码 5 分钟内有效，请勿泄露给他人。", code)
	message := []byte(
		fmt.Sprintf("From: MeetMe <%s>\r\n", fromEmail) +
			fmt.Sprintf("To: %s\r\n", toEmail) +
			"Subject: " + subject + "\r\n" +
			"MIME-Version: 1.0\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"\r\n" +
			body,
	)
	done := make(chan error, 1)
	go func() {
		auth := smtp.PlainAuth("", fromEmail, password, host)
		done <- smtp.SendMail(smtpAddr, auth, fromEmail, []string{toEmail}, message)
	}()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-done:
		if err != nil {
			s.Error("发送邮箱验证码失败", zap.Error(err), zap.String("email", toEmail))
			return errors.New("发送邮箱验证码失败")
		}
		return nil
	}
}

func (s *EmailService) sendResendMail(ctx context.Context, toEmail string, code string) error {
	apiKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	fromEmail := strings.TrimSpace(os.Getenv("RESEND_FROM_EMAIL"))
	apiURL := strings.TrimSpace(os.Getenv("RESEND_API_URL"))
	if apiURL == "" {
		apiURL = "https://api.resend.com/emails"
	}
	if apiKey == "" || fromEmail == "" {
		return errors.New("Resend 邮箱验证码服务未配置")
	}

	subject := "MeetMe 注册验证码"
	textBody := fmt.Sprintf("您的 MeetMe 注册验证码是：%s\n\n验证码 5 分钟内有效，请勿泄露给他人。", code)
	htmlBody := fmt.Sprintf(
		`<div style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#222;line-height:1.7"><h2>MeetMe 验证码</h2><p>您的验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">%s</p><p>验证码 5 分钟内有效，请勿泄露给他人。</p></div>`,
		code,
	)
	payload := map[string]interface{}{
		"from":    fromEmail,
		"to":      []string{toEmail},
		"subject": subject,
		"text":    textBody,
		"html":    htmlBody,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		s.Error("Resend 发送邮箱验证码请求失败", zap.Error(err), zap.String("email", toEmail))
		return errors.New("发送邮箱验证码失败")
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		s.Error("Resend 发送邮箱验证码失败", zap.Int("status", resp.StatusCode), zap.ByteString("body", respBody), zap.String("email", toEmail))
		return errors.New("发送邮箱验证码失败")
	}
	return nil
}
