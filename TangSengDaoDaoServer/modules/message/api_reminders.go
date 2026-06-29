package message

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	commonapi "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/group"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"go.uber.org/zap"
)

// 提醒已完成
func (m *Message) reminderDone(c *wkhttp.Context) {
	var ids []int64
	if err := c.BindJSON(&ids); err != nil {
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	if len(ids) == 0 {
		c.ResponseError(errors.New("数据不能为空！"))
		return
	}
	loginUID := c.GetLoginUID()
	tx, err := m.ctx.DB().Begin()
	if err != nil {
		m.Error("开启事务失败！", zap.Error(err))
		c.ResponseError(errors.New("开启事务失败！"))
		return
	}
	defer func() {
		if err := recover(); err != nil {
			tx.RollbackUnlessCommitted()
			panic(err)
		}
	}()
	err = m.remindersDB.insertDonesTx(ids, loginUID, tx)
	if err != nil {
		tx.Rollback()
		m.Error("添加done失败！", zap.Error(err))
		c.ResponseError(errors.New("添加done失败！"))
		return
	}
	for _, id := range ids {
		version := m.ctx.GenSeq(common.RemindersKey)
		err = m.remindersDB.updateVersionTx(version, id, tx)
		if err != nil {
			tx.Rollback()
			m.Error("更新提醒项版本失败！", zap.Error(err))
			c.ResponseError(errors.New("更新提醒项版本失败！"))
			return
		}
	}
	if err := tx.Commit(); err != nil {
		tx.RollbackUnlessCommitted()
		m.Error("提交事务失败！", zap.Error(err))
		c.ResponseError(errors.New("提交事务失败！"))
		return
	}
	err = m.ctx.SendCMD(config.MsgCMDReq{
		NoPersist:   true,
		ChannelID:   loginUID,
		ChannelType: common.ChannelTypePerson.Uint8(),
		CMD:         common.CMDSyncReminders,
	})
	if err != nil {
		m.Error("发送同步提醒项cmd失败！", zap.Error(err))
		c.ResponseError(errors.New("发送同步提醒项cmd失败！"))
		return
	}
	c.ResponseOK()
}

// 提醒内容同步
func (m *Message) reminderSync(c *wkhttp.Context) {
	var req struct {
		Version    int64    `json:"version"`
		Limit      uint64   `json:"limit"`
		ChannelIDs []string `json:"channel_ids"`
	}
	if err := c.BindJSON(&req); err != nil {
		m.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	loginUID := c.GetLoginUID()
	reminders, err := m.remindersDB.sync(loginUID, req.Version, req.Limit, req.ChannelIDs)
	if err != nil {
		m.Error("同步提醒项失败！", zap.Error(err))
		c.ResponseError(errors.New("同步提醒项失败！"))
		return
	}

	groupIds := make([]string, 0)
	if len(reminders) > 0 {
		for _, reminder := range reminders {
			if reminder.ChannelType == common.ChannelTypeGroup.Uint8() {
				groupIds = append(groupIds, reminder.ChannelID)
			}
		}
	}
	members := make([]*group.MemberResp, 0)
	if len(groupIds) > 0 {
		members, err = m.groupService.GetMembersWithUIDAndGroupIds(loginUID, groupIds)
		if err != nil {
			m.Error("查询登录用户加入群成员信息错误", zap.Error(err))
			c.ResponseError(errors.New("查询登录用户加入群成员信息错误"))
			return
		}
	}
	reminderResps := make([]*reminderResp, 0, len(reminders))
	for _, reminder := range reminders {
		if len(members) > 0 && reminder.ChannelType == common.ChannelTypeGroup.Uint8() {
			for _, member := range members {
				if member.GroupNo == reminder.ChannelID && time.Time(reminder.CreatedAt).Unix() < member.CreatedAt {
					reminder.Done = 1
					break
				}
			}
		}
		reminderResps = append(reminderResps, newReminderResp(reminder))
	}
	c.JSON(http.StatusOK, reminderResps)
}

func (m *Message) listenerMessages(messages []*config.MessageResp) {

	reminders := m.getReminders(messages) // 提醒
	if len(reminders) > 0 {
		m.handleReminders(reminders)
	}
	m.handleProhibitWordAlerts(messages)

}

func (m *Message) handleProhibitWordAlerts(messages []*config.MessageResp) {
	if len(messages) == 0 {
		return
	}
	words, err := m.db.queryActiveMonitorWords()
	if err != nil {
		m.Error("查询监听词失败", zap.Error(err))
		return
	}
	if len(words) == 0 {
		return
	}
	uids := make([]string, 0, len(messages))
	uidSet := map[string]bool{}
	for _, message := range messages {
		if message.FromUID != "" && !uidSet[message.FromUID] {
			uidSet[message.FromUID] = true
			uids = append(uids, message.FromUID)
		}
	}
	userNameMap := map[string]string{}
	if len(uids) > 0 {
		users, err := m.userService.GetUsers(uids)
		if err != nil {
			m.Warn("查询违禁词触发用户信息失败", zap.Error(err))
		} else {
			for _, u := range users {
				userNameMap[u.UID] = u.Name
			}
		}
	}
	for _, message := range messages {
		payloadMap, err := message.GetPayloadMap()
		if err != nil {
			m.Warn("解码消息payload失败，跳过违禁词记录", zap.Error(err))
			continue
		}
		content := extractProhibitCheckContent(payloadMap)
		if strings.TrimSpace(content) == "" {
			continue
		}
		matches := matchProhibitWords(content, words)
		if len(matches) == 0 {
			continue
		}
		payloadSnapshot := string(message.Payload)
		if len([]rune(payloadSnapshot)) > 4000 {
			payloadSnapshot = string([]rune(payloadSnapshot)[:4000])
		}
		for _, word := range matches {
			alert := &commonapi.ManagerAlertModel{
				AlertType:   "prohibit_word",
				Title:       "违禁词触发",
				Content:     content,
				ActorUID:    message.FromUID,
				ActorName:   userNameMap[message.FromUID],
				TargetID:    fmt.Sprintf("%d", message.MessageID),
				TargetType:  "message",
				ChannelID:   message.ChannelID,
				ChannelType: message.ChannelType,
				MessageID:   fmt.Sprintf("%d", message.MessageID),
				MessageSeq:  message.MessageSeq,
				TriggerWord: word,
				Payload:     payloadSnapshot,
				IsRead:      0,
			}
			if err := commonapi.InsertManagerAlert(m.ctx.DB(), alert); err != nil {
				m.Warn("写入违禁词后台提醒失败", zap.Error(err), zap.String("messageID", alert.MessageID), zap.String("word", word))
			}
		}
	}
}

func extractProhibitCheckContent(payloadMap map[string]interface{}) string {
	if payloadMap == nil {
		return ""
	}
	if content, ok := payloadMap["content"].(string); ok {
		return content
	}
	if text, ok := payloadMap["text"].(string); ok {
		return text
	}
	return util.ToJson(payloadMap)
}

func matchProhibitWords(content string, words []*MonitorWordModel) []string {
	matches := make([]string, 0)
	lowerContent := strings.ToLower(content)
	seen := map[string]bool{}
	for _, word := range words {
		w := strings.TrimSpace(word.Content)
		if w == "" || seen[w] {
			continue
		}
		if strings.Contains(content, w) || strings.Contains(lowerContent, strings.ToLower(w)) {
			matches = append(matches, w)
			seen[w] = true
		}
	}
	return matches
}

func (m *Message) getReminders(messages []*config.MessageResp) []*remindersModel {
	reminders := make([]*remindersModel, 0, len(messages))
	for _, message := range messages {
		payloadMap, err := message.GetPayloadMap()
		if err != nil {
			m.Warn("解码消息payload失败！,跳过", zap.Error(err))
			continue
		}
		if payloadMap == nil {
			continue
		}
		if m.hasMention(payloadMap) {
			all, uids := m.getMention(payloadMap)
			if all {
				version := m.ctx.GenSeq(common.RemindersKey)
				reminders = append(reminders, &remindersModel{
					ChannelID:    message.ChannelID,
					ChannelType:  message.ChannelType,
					ClientMsgNo:  message.ClientMsgNo,
					Publisher:    message.FromUID,
					MessageID:    fmt.Sprintf("%d", message.MessageID),
					MessageSeq:   message.MessageSeq,
					ReminderType: ReminderTypeMentionMe,
					IsLocate:     1,
					Version:      version,
					Text:         "[有人@我]",
				})
			} else if len(uids) > 0 {
				for _, uid := range uids {
					version := m.ctx.GenSeq(common.RemindersKey)
					reminders = append(reminders, &remindersModel{
						ChannelID:    message.ChannelID,
						ChannelType:  message.ChannelType,
						Publisher:    message.FromUID,
						MessageID:    fmt.Sprintf("%d", message.MessageID),
						MessageSeq:   message.MessageSeq,
						ReminderType: ReminderTypeMentionMe,
						UID:          uid,
						IsLocate:     1,
						Version:      version,
						Text:         "[有人@我]",
					})
				}
			}
		}
		// 申请入群
		contentType := m.contentType(payloadMap)
		if contentType == common.GroupMemberInvite.Int() {
			if payloadMap["visibles"] != nil {
				visibleObjs := payloadMap["visibles"].([]interface{})
				for _, visibleObj := range visibleObjs {
					version := m.ctx.GenSeq(common.RemindersKey)
					reminders = append(reminders, &remindersModel{
						ChannelID:    message.ChannelID,
						ChannelType:  message.ChannelType,
						MessageID:    fmt.Sprintf("%d", message.MessageID),
						MessageSeq:   message.MessageSeq,
						ReminderType: ReminderTypeApplyJoinGroup,
						UID:          visibleObj.(string),
						IsLocate:     1,
						Version:      version,
						Text:         "[进群申请]",
					})
				}
			}
		}
	}
	return reminders
}

func (m *Message) handleReminders(reminders []*remindersModel) {
	if len(reminders) > 0 {
		err := m.remindersDB.inserts(reminders)
		if err != nil {
			m.Error("插入提醒项失败！", zap.Error(err))
		}
		channels := make([]*config.ChannelReq, 0)
		uids := make([]string, 0)
		for _, reminder := range reminders {
			if reminder.UID == "" {
				channels = append(channels, &config.ChannelReq{
					ChannelID:   reminder.ChannelID,
					ChannelType: reminder.ChannelType,
				})
			} else {
				uids = append(uids, reminder.UID)
			}
		}
		if len(channels) > 0 {
			for _, channel := range channels {
				err = m.ctx.SendCMD(config.MsgCMDReq{
					NoPersist:   true,
					ChannelID:   channel.ChannelID,
					ChannelType: channel.ChannelType,
					CMD:         common.CMDSyncReminders,
				})
				if err != nil {
					m.Error("发送cmd[CMDSyncReminders]失败！", zap.Error(err))
				}
			}
		}
		if len(uids) > 0 {
			err = m.ctx.SendCMD(config.MsgCMDReq{
				NoPersist:   true,
				Subscribers: uids,
				CMD:         common.CMDSyncReminders,
			})
			if err != nil {
				m.Error("发送cmd[CMDSyncReminders]失败！", zap.Error(err))
			}
		}
	}
}

func (m *Message) hasMention(payloadMap map[string]interface{}) bool {
	return payloadMap["mention"] != nil
}

func (m *Message) getMention(payloadMap map[string]interface{}) (all bool, uids []string) {
	mentionMap := payloadMap["mention"].(map[string]interface{})
	if mentionMap["all"] != nil {
		allI, _ := mentionMap["all"].(json.Number).Int64()
		if allI == 1 {
			all = true
		}
	}
	if mentionMap["uids"] != nil {
		uidObjs := mentionMap["uids"].([]interface{})
		uids = make([]string, 0, len(uidObjs))
		for _, uidObj := range uidObjs {
			uids = append(uids, uidObj.(string))
		}
	}
	return
}

func (m *Message) contentType(payloadMap map[string]interface{}) int {
	if payloadMap["type"] != nil {
		contentTypeI, _ := payloadMap["type"].(json.Number).Int64()
		return int(contentTypeI)
	}
	return 0
}

type reminderResp struct {
	ID           int64                  `json:"id"`
	ChannelID    string                 `json:"channel_id"`
	ChannelType  uint8                  `json:"channel_type"`
	Publisher    string                 `json:"publisher"`
	MessageSeq   uint32                 `json:"message_seq"`
	MessageID    string                 `json:"message_id"`
	ReminderType ReminderType           `json:"reminder_type"`
	UID          string                 `json:"uid"`
	Text         string                 `json:"text"`
	Data         map[string]interface{} `json:"data,omitempty"`
	IsLocate     int                    `json:"is_locate"`
	Version      int64                  `json:"version"`
	Done         int                    `json:"done"`
}

func newReminderResp(m *remindersDetailModel) *reminderResp {

	var dataMap map[string]interface{}
	if m.Data != "" {
		dataMap, _ = util.JsonToMap(m.Data)
	}

	return &reminderResp{
		ID:           m.Id,
		ChannelID:    m.ChannelID,
		ChannelType:  m.ChannelType,
		MessageSeq:   m.MessageSeq,
		MessageID:    m.MessageID,
		ReminderType: ReminderType(m.ReminderType),
		Publisher:    m.Publisher,
		UID:          m.UID,
		Text:         m.Text,
		Data:         dataMap,
		IsLocate:     m.IsLocate,
		Version:      m.Version,
		Done:         m.Done,
	}
}
