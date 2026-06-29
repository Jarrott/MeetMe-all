package user

import (
	"context"
	"fmt"
	"net/mail"
	"strings"
	"time"

	commonapi "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/base/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/model"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/register"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"github.com/opentracing/opentracing-go"
	"github.com/pkg/errors"
	"go.uber.org/zap"
)

func (u *User) sendBindEmailCode(c *wkhttp.Context) {
	var req emailCodeReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		c.ResponseError(err)
		return
	}
	loginUID := c.GetLoginUID()
	userInfo, err := u.db.QueryByUsername(email)
	if err != nil {
		u.Error("查询邮箱用户信息失败！", zap.String("email", email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo != nil && userInfo.UID != loginUID {
		c.ResponseError(errors.New("该邮箱已被绑定"))
		return
	}
	sendCtx, cancel := context.WithTimeout(c.Context, time.Second*15)
	defer cancel()
	if err = u.emailService.SendVerifyCode(sendCtx, email, commonapi.CodeTypeBindEmail); err != nil {
		u.Error("发送绑定邮箱验证码失败", zap.String("email", email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	c.ResponseOK()
}

func (u *User) bindEmail(c *wkhttp.Context) {
	var req bindEmailReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		c.ResponseError(err)
		return
	}
	req.Email = email
	if strings.TrimSpace(req.Code) == "" {
		c.ResponseError(errors.New("验证码不能为空！"))
		return
	}
	loginUID := c.GetLoginUID()
	userInfo, err := u.db.QueryByUsername(req.Email)
	if err != nil {
		u.Error("查询邮箱用户信息失败！", zap.String("email", req.Email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo != nil && userInfo.UID != loginUID {
		c.ResponseError(errors.New("该邮箱已被绑定"))
		return
	}
	if err = u.emailService.Verify(c.Context, req.Email, req.Code, commonapi.CodeTypeBindEmail); err != nil {
		c.ResponseError(err)
		return
	}
	if err = u.db.UpdateUsersWithField("email", req.Email, loginUID); err != nil {
		u.Error("绑定邮箱失败", zap.String("uid", loginUID), zap.String("email", req.Email), zap.Error(err))
		c.ResponseError(errors.New("绑定邮箱失败"))
		return
	}
	c.ResponseOK()
}

func (u *User) sendBindPhoneCode(c *wkhttp.Context) {
	var req bindPhoneCodeReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	if strings.TrimSpace(req.Zone) == "" {
		c.ResponseError(errors.New("区号不能为空！"))
		return
	}
	if strings.TrimSpace(req.Phone) == "" {
		c.ResponseError(errors.New("手机号不能为空！"))
		return
	}
	loginUID := c.GetLoginUID()
	userInfo, err := u.db.QueryByPhone(req.Zone, req.Phone)
	if err != nil {
		u.Error("查询手机号用户信息失败！", zap.String("zone", req.Zone), zap.String("phone", req.Phone), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo != nil && userInfo.UID != loginUID {
		c.ResponseError(errors.New("该手机号已被绑定"))
		return
	}
	sendCtx, cancel := context.WithTimeout(c.Context, time.Second*15)
	defer cancel()
	if err = u.smsServie.SendVerifyCode(sendCtx, req.Zone, req.Phone, commonapi.CodeTypeBindPhone); err != nil {
		u.Error("发送绑定手机号验证码失败", zap.String("zone", req.Zone), zap.String("phone", req.Phone), zap.Error(err))
		c.ResponseError(errors.New("发送短信验证码失败！"))
		return
	}
	c.ResponseOK()
}

func (u *User) bindPhone(c *wkhttp.Context) {
	var req bindPhoneReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	req.Zone = strings.TrimSpace(req.Zone)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Code = strings.TrimSpace(req.Code)
	if req.Zone == "" {
		c.ResponseError(errors.New("区号不能为空！"))
		return
	}
	if req.Phone == "" {
		c.ResponseError(errors.New("手机号不能为空！"))
		return
	}
	if req.Code == "" {
		c.ResponseError(errors.New("验证码不能为空！"))
		return
	}
	loginUID := c.GetLoginUID()
	userInfo, err := u.db.QueryByPhone(req.Zone, req.Phone)
	if err != nil {
		u.Error("查询手机号用户信息失败！", zap.String("zone", req.Zone), zap.String("phone", req.Phone), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo != nil && userInfo.UID != loginUID {
		c.ResponseError(errors.New("该手机号已被绑定"))
		return
	}
	if err = u.smsServie.Verify(c.Context, req.Zone, req.Phone, req.Code, commonapi.CodeTypeBindPhone); err != nil {
		c.ResponseError(err)
		return
	}
	tx, err := u.db.session.Begin()
	if err != nil {
		u.Error("创建事务失败！", zap.Error(err))
		c.ResponseError(errors.New("创建事务失败！"))
		return
	}
	defer func() {
		if err := recover(); err != nil {
			tx.Rollback()
			panic(err)
		}
	}()
	err = u.db.updateUserTx(map[string]interface{}{
		"zone":     req.Zone,
		"phone":    req.Phone,
		"username": fmt.Sprintf("%s%s", req.Zone, req.Phone),
	}, loginUID, tx)
	if err != nil {
		tx.Rollback()
		u.Error("绑定手机号失败", zap.String("uid", loginUID), zap.String("zone", req.Zone), zap.String("phone", req.Phone), zap.Error(err))
		c.ResponseError(errors.New("绑定手机号失败"))
		return
	}
	if err = tx.Commit(); err != nil {
		tx.Rollback()
		u.Error("数据库事务提交失败", zap.Error(err))
		c.ResponseError(errors.New("数据库事务提交失败"))
		return
	}
	c.ResponseOK()
}

func (u *User) emailRegister(c *wkhttp.Context) {
	var req emailRegisterReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		c.ResponseError(err)
		return
	}
	req.Email = email
	if err := req.Check(); err != nil {
		c.ResponseError(err)
		return
	}
	if u.ctx.GetConfig().Register.Off {
		c.ResponseError(errors.New("注册通道暂不开放，请长按标题使用官网上演示账号登录"))
		return
	}
	appConfig, err := u.commonService.GetAppConfig()
	if err != nil {
		u.Error("查询应用设置错误", zap.Error(err))
		c.ResponseError(err)
		return
	}
	var registerInviteOn = 0
	if appConfig != nil {
		registerInviteOn = appConfig.RegisterInviteOn
	}
	var invite *model.Invite
	if registerInviteOn == 1 {
		if req.InviteCode == "" {
			c.ResponseError(errors.New("邀请码不能为空"))
			return
		}
		var inviteCodeIsExist = false
		modules := register.GetModules(u.ctx)
		for _, m := range modules {
			if m.BussDataSource.GetInviteCode != nil {
				invite, _ = m.BussDataSource.GetInviteCode(req.InviteCode)
				if invite != nil && invite.Uid != "" {
					inviteCodeIsExist = true
					break
				}
			}
		}
		if !inviteCodeIsExist {
			c.ResponseError(errors.New("邀请码不存在"))
			return
		}
	}

	registerSpan := u.ctx.Tracer().StartSpan(
		"user.emailRegister",
		opentracing.ChildOf(c.GetSpanContext()),
	)
	defer registerSpan.Finish()
	registerSpanCtx := u.ctx.Tracer().ContextWithSpan(context.Background(), registerSpan)
	registerSpan.SetTag("email", req.Email)

	userInfo, err := u.db.QueryByUsernameCxt(registerSpanCtx, req.Email)
	if err != nil {
		u.Error("查询邮箱用户信息失败！", zap.String("email", req.Email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo != nil {
		c.ResponseError(errors.New("该邮箱已注册"))
		return
	}
	if err := u.verifyEmailRegisterCode(registerSpanCtx, req.Email, req.Code); err != nil {
		c.ResponseError(err)
		return
	}

	model := &createUserModel{
		UID:      util.GenerUUID(),
		Sex:      1,
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Flag:     int(req.Flag),
		Device:   req.Device,
	}
	u.createUser(registerSpanCtx, model, c, invite)
}

func (u *User) sendEmailRegisterCode(c *wkhttp.Context) {
	if u.ctx.GetConfig().Register.Off {
		c.ResponseError(errors.New("注册通道暂不开放，请长按标题使用官网上演示账号登录"))
		return
	}
	var req emailCodeReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		c.ResponseError(err)
		return
	}

	span := u.ctx.Tracer().StartSpan(
		"user.sendEmailRegisterCode",
		opentracing.ChildOf(c.GetSpanContext()),
	)
	defer span.Finish()
	spanCtx := u.ctx.Tracer().ContextWithSpan(context.Background(), span)
	span.SetTag("email", email)

	userInfo, err := u.db.QueryByUsernameCxt(spanCtx, email)
	if err != nil {
		u.Error("查询邮箱用户信息失败！", zap.String("email", email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo != nil {
		c.Response(map[string]interface{}{
			"exist": 1,
		})
		return
	}
	sendCtx, cancel := context.WithTimeout(spanCtx, time.Second*15)
	defer cancel()
	if err = u.emailService.SendVerifyCode(sendCtx, email, commonapi.CodeTypeRegister); err != nil {
		u.Error("发送邮箱验证码失败", zap.String("email", email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	c.Response(map[string]interface{}{
		"exist": 0,
	})
}

func (u *User) emailLogin(c *wkhttp.Context) {
	var req emailLoginReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		c.ResponseError(err)
		return
	}
	req.Email = email
	if err := req.Check(); err != nil {
		c.ResponseError(err)
		return
	}

	loginSpan := u.ctx.Tracer().StartSpan(
		"user.emailLogin",
		opentracing.ChildOf(c.GetSpanContext()),
	)
	defer loginSpan.Finish()
	loginSpanCtx := u.ctx.Tracer().ContextWithSpan(context.Background(), loginSpan)
	loginSpan.SetTag("email", req.Email)

	userInfo, err := u.db.QueryByUsernameCxt(loginSpanCtx, req.Email)
	if err != nil {
		u.Error("查询邮箱用户信息失败！", zap.String("email", req.Email), zap.Error(err))
		c.ResponseError(err)
		return
	}
	if userInfo == nil || userInfo.IsDestroy == 1 || !strings.EqualFold(userInfo.Email, req.Email) {
		c.ResponseError(errors.New("邮箱账号不存在"))
		return
	}
	if userInfo.Password == "" {
		c.ResponseError(errors.New("此账号不允许登录"))
		return
	}
	if util.MD5(util.MD5(req.Password)) != userInfo.Password {
		c.ResponseError(errors.New("密码不正确！"))
		return
	}
	u.execLoginAndRespose(userInfo, config.DeviceFlag(req.Flag), req.Device, loginSpanCtx, c)
}

func (u *User) verifyEmailRegisterCode(ctx context.Context, email string, code string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return errors.New("验证码不能为空！")
	}
	return u.emailService.Verify(ctx, email, code, commonapi.CodeTypeRegister)
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", errors.New("邮箱不能为空")
	}
	if len(email) > 100 {
		return "", errors.New("邮箱长度不能超过100位")
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return "", errors.New("邮箱格式不正确")
	}
	return email, nil
}

type emailRegisterReq struct {
	Name       string     `json:"name"`
	Email      string     `json:"email"`
	Code       string     `json:"code"`
	Password   string     `json:"password"`
	Flag       uint8      `json:"flag"`
	Device     *deviceReq `json:"device"`
	InviteCode string     `json:"invite_code"`
}

func (r emailRegisterReq) Check() error {
	if strings.TrimSpace(r.Password) == "" {
		return errors.New("密码不能为空！")
	}
	if strings.TrimSpace(r.Code) == "" {
		return errors.New("验证码不能为空！")
	}
	if len(r.Password) < 6 {
		return errors.New("密码长度必须大于6位！")
	}
	return nil
}

type emailCodeReq struct {
	Email string `json:"email"`
}

type bindEmailReq struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type bindPhoneCodeReq struct {
	Zone  string `json:"zone"`
	Phone string `json:"phone"`
}

type bindPhoneReq struct {
	Zone  string `json:"zone"`
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type emailLoginReq struct {
	Email    string     `json:"email"`
	Password string     `json:"password"`
	Flag     int        `json:"flag"`
	Device   *deviceReq `json:"device"`
}

func (r emailLoginReq) Check() error {
	if strings.TrimSpace(r.Password) == "" {
		return errors.New("密码不能为空！")
	}
	return nil
}
