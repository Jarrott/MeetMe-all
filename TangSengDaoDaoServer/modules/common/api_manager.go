package common

import (
	"errors"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"go.uber.org/zap"
)

// Manager 通用后台管理api
type Manager struct {
	ctx *config.Context
	log.Log
	db          *db
	appconfigDB *appConfigDB
}

type managerAlertResp struct {
	ID          int64  `json:"id"`
	AlertType   string `json:"alert_type"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	ActorUID    string `json:"actor_uid"`
	ActorName   string `json:"actor_name"`
	TargetID    string `json:"target_id"`
	TargetType  string `json:"target_type"`
	ChannelID   string `json:"channel_id"`
	ChannelType uint8  `json:"channel_type"`
	MessageID   string `json:"message_id"`
	MessageSeq  uint32 `json:"message_seq"`
	TriggerWord string `json:"trigger_word"`
	Payload     string `json:"payload"`
	IsRead      int    `json:"is_read"`
	CreatedAt   string `json:"created_at"`
}

func newManagerAlertResps(list []*ManagerAlertModel) []*managerAlertResp {
	resps := make([]*managerAlertResp, 0, len(list))
	for _, alert := range list {
		resps = append(resps, &managerAlertResp{
			ID:          alert.Id,
			AlertType:   alert.AlertType,
			Title:       alert.Title,
			Content:     alert.Content,
			ActorUID:    alert.ActorUID,
			ActorName:   alert.ActorName,
			TargetID:    alert.TargetID,
			TargetType:  alert.TargetType,
			ChannelID:   alert.ChannelID,
			ChannelType: alert.ChannelType,
			MessageID:   alert.MessageID,
			MessageSeq:  alert.MessageSeq,
			TriggerWord: alert.TriggerWord,
			Payload:     alert.Payload,
			IsRead:      alert.IsRead,
			CreatedAt:   alert.CreatedAt.String(),
		})
	}
	return resps
}

// NewManager NewManager
func NewManager(ctx *config.Context) *Manager {
	return &Manager{
		ctx:         ctx,
		Log:         log.NewTLog("commonManager"),
		db:          newDB(ctx.DB()),
		appconfigDB: newAppConfigDB(ctx),
	}
}

// Route 配置路由规则
func (m *Manager) Route(r *wkhttp.WKHttp) {
	auth := r.Group("/v1/manager", m.ctx.AuthMiddleware(r))
	{
		auth.GET("/common/appconfig", m.appconfig)               // 获取app配置
		auth.POST("/common/appconfig", m.updateConfig)           // 修改app配置
		auth.GET("/common/appmodule", m.getAppModule)            // 获取app模块
		auth.PUT("/common/appmodule", m.updateAppModule)         // 修改app模块
		auth.POST("/common/appmodule", m.addAppModule)           // 新增app模块
		auth.DELETE("/common/:sid/appmodule", m.deleteAppModule) // 删除app模块
		auth.GET("/common/alerts/summary", m.alertSummary)       // 后台提醒汇总
		auth.GET("/common/alerts", m.alerts)                     // 后台提醒列表
		auth.POST("/common/alerts/read", m.readAlerts)           // 标记后台提醒已读
	}
}

func (m *Manager) alertSummary(c *wkhttp.Context) {
	err := c.CheckLoginRole()
	if err != nil {
		c.ResponseError(err)
		return
	}
	stats, err := m.db.queryManagerAlertUnreadStats()
	if err != nil {
		m.Error("查询后台提醒汇总错误", zap.Error(err))
		c.ResponseError(errors.New("查询后台提醒汇总错误"))
		return
	}
	total := int64(0)
	byType := map[string]int64{}
	for _, stat := range stats {
		total += stat.Count
		byType[stat.AlertType] = stat.Count
	}
	latest, err := m.db.queryManagerAlerts("", true, 5, 1)
	if err != nil {
		m.Error("查询最新后台提醒错误", zap.Error(err))
		c.ResponseError(errors.New("查询最新后台提醒错误"))
		return
	}
	c.Response(map[string]interface{}{
		"unread_count": total,
		"by_type":      byType,
		"latest":       newManagerAlertResps(latest),
	})
}

func (m *Manager) alerts(c *wkhttp.Context) {
	err := c.CheckLoginRole()
	if err != nil {
		c.ResponseError(err)
		return
	}
	alertType := strings.TrimSpace(c.Query("type"))
	unreadOnly := c.Query("unread") == "1"
	pageIndex, pageSize := c.GetPage()
	list, err := m.db.queryManagerAlerts(alertType, unreadOnly, uint64(pageSize), uint64(pageIndex))
	if err != nil {
		m.Error("查询后台提醒列表错误", zap.Error(err))
		c.ResponseError(errors.New("查询后台提醒列表错误"))
		return
	}
	count, err := m.db.queryManagerAlertCount(alertType, unreadOnly)
	if err != nil {
		m.Error("查询后台提醒数量错误", zap.Error(err))
		c.ResponseError(errors.New("查询后台提醒数量错误"))
		return
	}
	c.Response(map[string]interface{}{
		"list":  newManagerAlertResps(list),
		"count": count,
	})
}

func (m *Manager) readAlerts(c *wkhttp.Context) {
	err := c.CheckLoginRole()
	if err != nil {
		c.ResponseError(err)
		return
	}
	var req struct {
		IDs  []int64 `json:"ids"`
		Type string  `json:"type"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	alertType := strings.TrimSpace(req.Type)
	if len(req.IDs) == 0 && alertType == "" {
		c.ResponseError(errors.New("提醒id或类型不能为空"))
		return
	}
	if err := m.db.markManagerAlertsRead(req.IDs, alertType); err != nil {
		m.Error("标记后台提醒已读错误", zap.Error(err))
		c.ResponseError(errors.New("标记后台提醒已读错误"))
		return
	}
	c.ResponseOK()
}
func (m *Manager) deleteAppModule(c *wkhttp.Context) {
	err := c.CheckLoginRoleIsSuperAdmin()
	if err != nil {
		c.ResponseError(err)
		return
	}

	sid := c.Param("sid")
	if strings.TrimSpace(sid) == "" {
		c.ResponseError(errors.New("sid不能为空！"))
		return
	}
	module, err := m.db.queryAppModuleWithSid(sid)
	if err != nil {
		m.Error("查询app模块错误", zap.Error(err))
		c.ResponseError(errors.New("查询app模块错误"))
		return
	}
	if module == nil {
		c.ResponseError(errors.New("删除的模块不存在"))
		return
	}
	err = m.db.deleteAppModule(sid)
	if err != nil {
		m.Error("删除app模块错误", zap.Error(err))
		c.ResponseError(errors.New("删除app模块错误"))
		return
	}
	c.ResponseOK()
}

// 新增app模块
func (m *Manager) addAppModule(c *wkhttp.Context) {
	err := c.CheckLoginRoleIsSuperAdmin()
	if err != nil {
		c.ResponseError(err)
		return
	}
	type ReqVO struct {
		SID    string `json:"sid"`
		Name   string `json:"name"`
		Desc   string `json:"desc"`
		Status int    `json:"status"`
	}
	var req ReqVO
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}

	if strings.TrimSpace(req.SID) == "" || strings.TrimSpace(req.Desc) == "" || strings.TrimSpace(req.Name) == "" {
		c.ResponseError(errors.New("名称/ID/介绍不能为空！"))
		return
	}
	module, err := m.db.queryAppModuleWithSid(req.SID)
	if err != nil {
		m.Error("查询app模块错误", zap.Error(err))
		c.ResponseError(errors.New("查询app模块错误"))
		return
	}
	if module != nil && module.SID != "" {
		c.ResponseError(errors.New("该sid模块已存在"))
		return
	}
	_, err = m.db.insertAppModule(&appModuleModel{
		SID:    req.SID,
		Name:   req.Name,
		Desc:   req.Desc,
		Status: req.Status,
	})
	if err != nil {
		m.Error("新增app模块错误", zap.Error(err))
		c.ResponseError(errors.New("新增app模块错误"))
		return
	}
	c.ResponseOK()
}
func (m *Manager) updateAppModule(c *wkhttp.Context) {
	err := c.CheckLoginRoleIsSuperAdmin()
	if err != nil {
		c.ResponseError(err)
		return
	}
	type ReqVO struct {
		SID    string `json:"sid"`
		Name   string `json:"name"`
		Desc   string `json:"desc"`
		Status int    `json:"status"`
	}
	var req ReqVO
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}

	if strings.TrimSpace(req.SID) == "" || strings.TrimSpace(req.Desc) == "" || strings.TrimSpace(req.Name) == "" {
		c.ResponseError(errors.New("名称/ID/介绍不能为空！"))
		return
	}
	module, err := m.db.queryAppModuleWithSid(req.SID)
	if err != nil {
		m.Error("查询app模块错误", zap.Error(err))
		c.ResponseError(errors.New("查询app模块错误"))
		return
	}
	if module == nil {
		c.ResponseError(errors.New("不存在该模块"))
		return
	}
	module.Name = req.Name
	module.Desc = req.Desc
	module.Status = req.Status
	err = m.db.updateAppModule(module)
	if err != nil {
		m.Error("修改app模块错误", zap.Error(err))
		c.ResponseError(errors.New("修改app模块错误"))
		return
	}
	c.ResponseOK()
}

// 获取app模块
func (m *Manager) getAppModule(c *wkhttp.Context) {
	err := c.CheckLoginRole()
	if err != nil {
		c.ResponseError(err)
		return
	}
	modules, err := m.db.queryAppModule()
	if err != nil {
		m.Error("查询app模块错误", zap.Error(err))
		c.ResponseError(errors.New("查询app模块错误"))
		return
	}
	list := make([]*managerAppModule, 0)
	if len(modules) > 0 {
		for _, module := range modules {
			list = append(list, &managerAppModule{
				SID:    module.SID,
				Name:   module.Name,
				Desc:   module.Desc,
				Status: module.Status,
			})
		}
	}
	c.Response(list)
}
func (m *Manager) updateConfig(c *wkhttp.Context) {
	err := c.CheckLoginRoleIsSuperAdmin()
	if err != nil {
		c.ResponseError(err)
		return
	}
	type reqVO struct {
		RevokeSecond                   int    `json:"revoke_second"`
		WelcomeMessage                 string `json:"welcome_message"`
		NewUserJoinSystemGroup         int    `json:"new_user_join_system_group"`
		SearchByPhone                  int    `json:"search_by_phone"`
		RegisterInviteOn               int    `json:"register_invite_on"`                  // 开启注册邀请机制
		SendWelcomeMessageOn           int    `json:"send_welcome_message_on"`             // 开启注册登录发送欢迎语
		InviteSystemAccountJoinGroupOn int    `json:"invite_system_account_join_group_on"` // 开启系统账号加入群聊
		RegisterUserMustCompleteInfoOn int    `json:"register_user_must_complete_info_on"` // 注册用户必须填写完整信息
		ChannelPinnedMessageMaxCount   int    `json:"channel_pinned_message_max_count"`    // 频道置顶消息最大数量
		CanModifyApiUrl                int    `json:"can_modify_api_url"`                  // 是否可以修改api地址
		AutoTranslateOn                int    `json:"auto_translate_on"`                   // 是否开启自动翻译
		ConversationTeamEnabled        int    `json:"conversation_team_enabled"`           // 是否允许会话分组管理
		GroupMemberPrivateChatEnabled  int    `json:"group_member_private_chat_enabled"`   // 是否允许群成员不加好友私聊
	}
	var req reqVO
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}
	appConfigM, err := m.appconfigDB.query()
	if err != nil {
		m.Error("查询应用配置失败！", zap.Error(err))
		c.ResponseError(errors.New("查询应用配置失败！"))
		return
	}
	configMap := map[string]interface{}{}
	configMap["revoke_second"] = req.RevokeSecond
	configMap["welcome_message"] = req.WelcomeMessage
	configMap["new_user_join_system_group"] = req.NewUserJoinSystemGroup
	configMap["search_by_phone"] = req.SearchByPhone
	configMap["register_invite_on"] = req.RegisterInviteOn
	configMap["send_welcome_message_on"] = req.SendWelcomeMessageOn
	configMap["invite_system_account_join_group_on"] = req.InviteSystemAccountJoinGroupOn
	configMap["register_user_must_complete_info_on"] = req.RegisterUserMustCompleteInfoOn
	configMap["channel_pinned_message_max_count"] = req.ChannelPinnedMessageMaxCount
	configMap["can_modify_api_url"] = req.CanModifyApiUrl
	configMap["auto_translate_on"] = req.AutoTranslateOn
	configMap["conversation_team_enabled"] = req.ConversationTeamEnabled
	configMap["group_member_private_chat_enabled"] = req.GroupMemberPrivateChatEnabled
	err = m.appconfigDB.updateWithMap(configMap, appConfigM.Id)
	if err != nil {
		m.Error("修改app配置信息错误", zap.Error(err))
		c.ResponseError(errors.New("修改app配置信息错误"))
		return
	}
	c.ResponseOK()
}
func (m *Manager) appconfig(c *wkhttp.Context) {
	err := c.CheckLoginRole()
	if err != nil {
		c.ResponseError(err)
		return
	}
	appconfig, err := m.appconfigDB.query()
	if err != nil {
		m.Error("查询应用配置失败！", zap.Error(err))
		c.ResponseError(errors.New("查询应用配置失败！"))
		return
	}
	var revokeSecond = 0
	var newUserJoinSystemGroup = 1
	var welcomeMessage = ""
	var searchByPhone = 1
	var registerInviteOn = 0
	var sendWelcomeMessageOn = 0
	var inviteSystemAccountJoinGroupOn = 0
	var registerUserMustCompleteInfoOn = 0
	var channelPinnedMessageMaxCount = 10
	var canModifyApiUrl = 0
	var autoTranslateOn = 0
	var conversationTeamEnabled = 1
	var groupMemberPrivateChatEnabled = 1
	if appconfig != nil {
		revokeSecond = appconfig.RevokeSecond
		welcomeMessage = appconfig.WelcomeMessage
		newUserJoinSystemGroup = appconfig.NewUserJoinSystemGroup
		searchByPhone = appconfig.SearchByPhone
		registerInviteOn = appconfig.RegisterInviteOn
		sendWelcomeMessageOn = appconfig.SendWelcomeMessageOn
		inviteSystemAccountJoinGroupOn = appconfig.InviteSystemAccountJoinGroupOn
		registerUserMustCompleteInfoOn = appconfig.RegisterUserMustCompleteInfoOn
		channelPinnedMessageMaxCount = appconfig.ChannelPinnedMessageMaxCount
		canModifyApiUrl = appconfig.CanModifyApiUrl
		autoTranslateOn = appconfig.AutoTranslateOn
		conversationTeamEnabled = appconfig.ConversationTeamEnabled
		groupMemberPrivateChatEnabled = appconfig.GroupMemberPrivateChatEnabled
	}
	if revokeSecond == 0 {
		revokeSecond = 120
	}
	if welcomeMessage == "" {
		welcomeMessage = m.ctx.GetConfig().WelcomeMessage
	}
	c.Response(&managerAppConfigResp{
		RevokeSecond:                   revokeSecond,
		WelcomeMessage:                 welcomeMessage,
		NewUserJoinSystemGroup:         newUserJoinSystemGroup,
		SearchByPhone:                  searchByPhone,
		RegisterInviteOn:               registerInviteOn,
		SendWelcomeMessageOn:           sendWelcomeMessageOn,
		InviteSystemAccountJoinGroupOn: inviteSystemAccountJoinGroupOn,
		RegisterUserMustCompleteInfoOn: registerUserMustCompleteInfoOn,
		ChannelPinnedMessageMaxCount:   channelPinnedMessageMaxCount,
		CanModifyApiUrl:                canModifyApiUrl,
		AutoTranslateOn:                autoTranslateOn,
		ConversationTeamEnabled:        conversationTeamEnabled,
		GroupMemberPrivateChatEnabled:  groupMemberPrivateChatEnabled,
	})
}

type managerAppConfigResp struct {
	RevokeSecond                   int    `json:"revoke_second"`
	WelcomeMessage                 string `json:"welcome_message"`
	NewUserJoinSystemGroup         int    `json:"new_user_join_system_group"`
	SearchByPhone                  int    `json:"search_by_phone"`
	RegisterInviteOn               int    `json:"register_invite_on"`                  // 开启注册邀请机制
	SendWelcomeMessageOn           int    `json:"send_welcome_message_on"`             // 开启注册登录发送欢迎语
	InviteSystemAccountJoinGroupOn int    `json:"invite_system_account_join_group_on"` // 开启系统账号加入群聊
	RegisterUserMustCompleteInfoOn int    `json:"register_user_must_complete_info_on"` // 注册用户必须填写完整信息
	ChannelPinnedMessageMaxCount   int    `json:"channel_pinned_message_max_count"`    // 频道置顶消息最大数量
	CanModifyApiUrl                int    `json:"can_modify_api_url"`                  // 是否可以修改api地址
	AutoTranslateOn                int    `json:"auto_translate_on"`                   // 是否开启自动翻译
	ConversationTeamEnabled        int    `json:"conversation_team_enabled"`           // 是否允许会话分组管理
	GroupMemberPrivateChatEnabled  int    `json:"group_member_private_chat_enabled"`   // 是否允许群成员不加好友私聊
}

type managerAppModule struct {
	SID    string `json:"sid"`
	Name   string `json:"name"`
	Desc   string `json:"desc"`
	Status int    `json:"status"` // 模块状态 1.可选 0.不可选 2.选中不可编辑
}
