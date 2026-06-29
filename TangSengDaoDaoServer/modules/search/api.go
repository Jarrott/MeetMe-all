package search

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/group"
	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/message"
	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/user"
	"github.com/TangSengDaoDao/TangSengDaoDaoServer/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServer/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"go.uber.org/zap"
)

type Search struct {
	ctx *config.Context
	log.Log
	userService    user.IService
	groupService   group.IService
	messageService message.IService
}

type globalSearchReq struct {
	OnlyMessage int    `json:"only_message"` // 只加载消息
	ContentType []int  `json:"content_type"` // 消息类型
	Keyword     string `json:"keyword"`      // 搜索关键字
	FromUID     string `json:"from_uid"`     // 发送者uid
	ChannelID   string `json:"channel_id"`   // 频道ID
	ChannelType uint8  `json:"channel_type"` // 频道类型
	Topic       string `json:"topic"`        // 根据topic搜索
	Limit       int    `json:"limit"`        // 查询限制数量
	Page        int    `json:"page"`         // 页码，分页使用，默认为1
	StartTime   int64  `json:"start_time"`   // 消息时间（开始）
	EndTime     int64  `json:"end_time"`     // 消息时间（结束，结果不包含end_time）
}

func New(ctx *config.Context) *Search {
	s := &Search{
		ctx:            ctx,
		Log:            log.NewTLog("search"),
		userService:    user.NewService(ctx),
		groupService:   group.NewService(ctx),
		messageService: message.NewService(ctx),
	}
	return s
}

func (s *Search) Route(r *wkhttp.WKHttp) {
	searchs := r.Group("/v1/search", s.ctx.AuthMiddleware(r))
	{
		searchs.POST("/global", s.global) // 全局搜索
	}
}

func (s *Search) global(c *wkhttp.Context) {
	loginUID := c.GetLoginUID()
	var req globalSearchReq
	if err := c.BindJSON(&req); err != nil {
		s.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	payload := map[string]interface{}{
		"content": req.Keyword,
		"name":    req.Keyword,
	}
	highlights := []string{"payload.content", "payload.name"}
	searchChannelID := s.searchChannelID(loginUID, &req)

	// 查询消息
	msgResp, err := s.ctx.IMSearchUserMessages(&config.SearchUserMessageReq{
		UID:          loginUID,
		Payload:      payload,
		PayloadTypes: req.ContentType,
		Limit:        req.Limit,
		Page:         req.Page,
		FromUID:      req.FromUID,
		ChannelID:    searchChannelID,
		ChannelType:  req.ChannelType,
		Topic:        req.Topic,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Highlights:   highlights,
	})
	if err != nil {
		s.Warn("查询悟空IM消息错误，尝试使用本地消息表搜索", zap.Error(err))
		msgResp, err = s.searchLocalMessages(loginUID, &req)
		if err != nil {
			s.Error("查询本地消息错误", zap.Error(err))
			c.ResponseError(errors.New("查询消息错误"))
			return
		}
	}
	if msgResp == nil || len(msgResp.Messages) == 0 {
		localMsgResp, localErr := s.searchLocalMessages(loginUID, &req)
		if localErr != nil {
			s.Warn("本地消息表搜索失败", zap.Error(localErr))
		} else if localMsgResp != nil && len(localMsgResp.Messages) > 0 {
			msgResp = localMsgResp
		}
	}
	channelIds := make([]string, 0)
	messageIds := make([]string, 0)
	if msgResp != nil && len(msgResp.Messages) > 0 {
		for _, m := range msgResp.Messages {
			messageIds = append(messageIds, m.MessageIDStr)
			channelIds = append(channelIds, m.ChannelID)
		}
	}
	// 查询撤回标记
	revokedMsgExtras, err := s.messageService.GetRevokedMessages(messageIds)
	if err != nil {
		s.Error("查询消息撤回消息错误", zap.Error(err))
		c.ResponseError(errors.New("查询消息撤回消息错误"))
		return
	}
	// 查询后台管理删除标记
	deletedMsgExtras, err := s.messageService.GetDeletedMessages(messageIds)
	if err != nil {
		s.Error("查询消息删除消息错误", zap.Error(err))
		c.ResponseError(errors.New("查询消息删除消息错误"))
		return
	}
	// 查询登录用户的删除标记
	deletedMsgUserExtras, err := s.messageService.GetDeletedMessagesWithUID(loginUID, messageIds)
	if err != nil {
		s.Error("查询消息删除消息错误", zap.Error(err))
		c.ResponseError(errors.New("查询消息删除消息错误"))
		return
	}

	// 查询登录用户清空channel消息标记
	channelOffsetResps, err := s.messageService.GetChannelOffsetWithUID(loginUID, channelIds)
	if err != nil {
		s.Error("查询用户清空channel消息标记错误", zap.Error(err))
		c.ResponseError(errors.New("查询用户清空channel消息标记错误"))
		return
	}

	// 1. 预处理：构建 Map（O(n) 一次性处理）
	revokedMap := make(map[string]bool, len(revokedMsgExtras))
	for _, extra := range revokedMsgExtras {
		revokedMap[extra.MessageIDStr] = true
	}

	deletedMap := make(map[string]bool, len(deletedMsgExtras))
	for _, extra := range deletedMsgExtras {
		if extra.IsMutualDeleted == 1 {
			deletedMap[extra.MessageIDStr] = true
		}
	}

	deletedUserMap := make(map[string]bool, len(deletedMsgUserExtras))
	for _, extra := range deletedMsgUserExtras {
		if extra.MessageIsDeleted == 1 {
			deletedUserMap[extra.MessageIDStr] = true
		}
	}

	// channelID -> 清空到的 messageSeq
	channelOffsetMap := make(map[string]uint32, len(channelOffsetResps))
	for _, offset := range channelOffsetResps {
		channelOffsetMap[offset.ChannelID] = offset.MessageSeq
	}

	realMessages := make([]*config.MessageResp, 0)
	if msgResp != nil && len(msgResp.Messages) > 0 {
		for _, m := range msgResp.Messages {
			// O(1) 检查是否撤回
			if revokedMap[m.MessageIDStr] {
				continue
			}

			// O(1) 检查是否后台删除
			if deletedMap[m.MessageIDStr] {
				continue
			}

			// O(1) 检查是否用户删除
			if deletedUserMap[m.MessageIDStr] {
				continue
			}

			// O(1) 检查是否清空channel消息
			if offsetSeq, ok := channelOffsetMap[m.ChannelID]; ok && offsetSeq >= m.MessageSeq {
				continue
			}

			realMessages = append(realMessages, m)
		}
	}
	groupIds := make([]string, 0)
	uids := make([]string, 0)
	msgFromUids := make([]string, 0)

	if len(realMessages) > 0 {
		for _, m := range realMessages {
			if m.ChannelType == common.ChannelTypeGroup.Uint8() {
				groupIds = append(groupIds, m.ChannelID)
			} else if m.ChannelType == common.ChannelTypePerson.Uint8() {
				uids = append(uids, s.displayPersonChannelID(loginUID, m.ChannelID, m.FromUID))
			}
			if m.FromUID != "" {
				msgFromUids = append(msgFromUids, m.FromUID)
			}
		}
	}

	var joinedGroups []*group.InfoResp
	if req.OnlyMessage == 0 {
		joinedGroups, err = s.groupService.GetGroupsWithMemberUID(loginUID)
		if err != nil {
			s.Error("查询加入的群列表错误", zap.Error(err))
			c.ResponseError(errors.New("查询加入的群列表错误"))
			return
		}
		if len(joinedGroups) > 0 {
			for _, group := range joinedGroups {
				groupIds = append(groupIds, group.GroupNo)
			}
		}
	}

	var groups []*group.GroupResp
	var users []*user.UserDetailResp
	if len(groupIds) > 0 {
		groups, err = s.groupService.GetGroupDetails(groupIds, loginUID)
		if err != nil {
			s.Error("查询群列表错误", zap.Error(err))
			c.ResponseError(errors.New("查询群列表错误"))
			return
		}
	}
	if len(msgFromUids) > 0 {
		uids = append(uids, msgFromUids...)
	}
	if len(uids) > 0 {
		realUids := util.RemoveRepeatedElement(uids)
		users, err = s.userService.GetUserDetails(realUids, loginUID)
		if err != nil {
			s.Error("查询用户列表错误", zap.Error(err))
			c.ResponseError(errors.New("查询用户列表错误"))
			return
		}
	}

	// 加入的群
	groupResps := make([]*channelResp, 0)
	if req.OnlyMessage == 0 && len(joinedGroups) > 0 {
		for _, g := range joinedGroups {
			isAdd := false
			remark := ""
			if strings.Contains(g.Name, req.Keyword) {
				isAdd = true
			}
			if len(groups) > 0 {
				for _, group := range groups {
					if group.GroupNo == g.GroupNo {
						remark = group.Remark
						if strings.Contains(group.Remark, req.Keyword) {
							isAdd = true
						}
						break
					}
				}
			}
			if isAdd {
				name := strings.ReplaceAll(g.Name, req.Keyword, fmt.Sprintf("<mark>%s</mark>", req.Keyword))
				groupResps = append(groupResps, &channelResp{
					ChannelID:     g.GroupNo,
					ChannelType:   common.ChannelTypeGroup.Uint8(),
					ChannelName:   name,
					ChannelRemark: remark,
				})
			}
		}
	}

	// 查询好友
	friendResps := make([]*channelResp, 0)
	if req.OnlyMessage == 0 {
		friends, err := s.userService.SearchFriendsWithKeyword(loginUID, req.Keyword)
		if err != nil {
			s.Error("查询好友错误", zap.Error(err))
			c.ResponseError(err)
			return
		}
		if len(friends) > 0 {
			for _, friend := range friends {
				name := strings.ReplaceAll(friend.Name, req.Keyword, fmt.Sprintf("<mark>%s</mark>", req.Keyword))
				friendResps = append(friendResps, &channelResp{
					ChannelID:     friend.UID,
					ChannelName:   name,
					ChannelType:   common.ChannelTypePerson.Uint8(),
					ChannelRemark: friend.Remark,
				})
			}
		}
	}

	messagesResp := make([]*messageResp, 0)
	if len(realMessages) > 0 {
		for _, msg := range realMessages {
			var isDeleted int8 = 0
			setting := config.SettingFromUint8(msg.Setting)
			var payloadMap map[string]interface{}
			if setting.Signal {
				payloadMap = map[string]interface{}{
					"type": common.SignalError.Int(),
				}
			} else {
				err := util.ReadJsonByByte(msg.Payload, &payloadMap)
				if err != nil {
					log.Warn("负荷数据不是json格式！", zap.Error(err), zap.String("payload", string(msg.Payload)))
				}
				if len(payloadMap) > 0 {
					visibles := payloadMap["visibles"]
					if visibles != nil {
						visiblesArray := visibles.([]interface{})
						if len(visiblesArray) > 0 {
							isDeleted = 1
							for _, limitUID := range visiblesArray {
								if limitUID == loginUID {
									isDeleted = 0
								}
							}
						}
					}
				} else {
					payloadMap = map[string]interface{}{
						"type": common.ContentError.Int(),
					}
				}
			}
			if isDeleted == 1 {
				continue
			}
			var tempChannel *channelResp
			if msg.ChannelType == common.ChannelTypePerson.Uint8() {
				displayChannelID := s.displayPersonChannelID(loginUID, msg.ChannelID, msg.FromUID)
				for _, user := range users {
					if user.UID == displayChannelID {
						tempChannel = &channelResp{
							ChannelID:     user.UID,
							ChannelType:   common.ChannelTypePerson.Uint8(),
							ChannelRemark: user.Remark,
							ChannelName:   user.Name,
						}
						break
					}
				}
			}
			var fromChannel *channelResp
			if len(users) > 0 && msg.FromUID != "" {
				for _, user := range users {
					if msg.FromUID == user.UID {
						fromChannel = &channelResp{
							ChannelID:     user.UID,
							ChannelType:   common.ChannelTypePerson.Uint8(),
							ChannelRemark: user.Remark,
							ChannelName:   user.Name,
						}
					}
				}
			}
			if msg.ChannelType == common.ChannelTypeGroup.Uint8() {
				for _, group := range groups {
					if group.GroupNo == msg.ChannelID {
						tempChannel = &channelResp{
							ChannelID:     group.GroupNo,
							ChannelType:   common.ChannelTypeGroup.Uint8(),
							ChannelName:   group.Name,
							ChannelRemark: group.Remark,
						}
						break
					}
				}
			}
			messagesResp = append(messagesResp, &messageResp{
				MessageIDStr: msg.MessageIDStr,
				MessageID:    msg.MessageID,
				MessageSeq:   msg.MessageSeq,
				FromUID:      msg.FromUID,
				Timestamp:    msg.Timestamp,
				Payload:      payloadMap,
				ClientMsgNo:  msg.ClientMsgNo,
				Channel:      tempChannel,
				IsDeleted:    isDeleted,
				FromChannel:  fromChannel,
			})
		}
	}
	c.Response(map[string]interface{}{
		"friends":  friendResps,
		"groups":   groupResps,
		"messages": messagesResp,
	})
}

func (s *Search) searchLocalMessages(loginUID string, req *globalSearchReq) (*config.SearchUserMessageResp, error) {
	keyword := strings.TrimSpace(req.Keyword)
	if keyword == "" && len(req.ContentType) == 0 {
		return &config.SearchUserMessageResp{
			Total:    0,
			Limit:    req.Limit,
			Page:     req.Page,
			Messages: []*config.MessageResp{},
		}, nil
	}

	joinedGroups, err := s.groupService.GetGroupsWithMemberUID(loginUID)
	if err != nil {
		return nil, err
	}
	joinedGroupMap := make(map[string]bool, len(joinedGroups))
	for _, g := range joinedGroups {
		joinedGroupMap[g.GroupNo] = true
	}

	perTableLimit := req.Limit * req.Page * 4
	if perTableLimit < req.Limit {
		perTableLimit = req.Limit
	}
	if perTableLimit > 500 {
		perTableLimit = 500
	}

	rows := make([]*localSearchMessage, 0)
	for _, table := range s.localMessageTables() {
		tableRows, err := s.queryLocalMessageTable(table, loginUID, keyword, req, perTableLimit)
		if err != nil {
			return nil, err
		}
		rows = append(rows, tableRows...)
	}

	contentTypeSet := make(map[int]bool, len(req.ContentType))
	for _, contentType := range req.ContentType {
		contentTypeSet[contentType] = true
	}

	messages := make([]*config.MessageResp, 0, len(rows))
	for _, row := range rows {
		if row.IsDeleted == 1 {
			continue
		}
		if !s.localMessageVisible(loginUID, req, row, joinedGroupMap) {
			continue
		}
		if len(contentTypeSet) > 0 && !contentTypeSet[row.contentType()] {
			continue
		}
		messages = append(messages, row.toMessageResp(loginUID))
	}

	sort.Slice(messages, func(i, j int) bool {
		if messages[i].Timestamp == messages[j].Timestamp {
			return messages[i].MessageSeq > messages[j].MessageSeq
		}
		return messages[i].Timestamp > messages[j].Timestamp
	})

	total := len(messages)
	start := (req.Page - 1) * req.Limit
	if start > total {
		start = total
	}
	end := start + req.Limit
	if end > total {
		end = total
	}
	return &config.SearchUserMessageResp{
		Total:    int64(total),
		Limit:    req.Limit,
		Page:     req.Page,
		Messages: messages[start:end],
	}, nil
}

func (s *Search) queryLocalMessageTable(table string, loginUID string, keyword string, req *globalSearchReq, limit int) ([]*localSearchMessage, error) {
	rows := make([]*localSearchMessage, 0)
	builder := s.ctx.DB().Select(
		"message_id",
		"message_seq",
		"client_msg_no",
		"header",
		"setting",
		"`signal`",
		"from_uid",
		"channel_id",
		"channel_type",
		"timestamp",
		"payload",
		"is_deleted",
	).From(table).Where("is_deleted=0")

	if keyword != "" {
		builder = builder.Where("payload like ?", "%"+keyword+"%")
	}
	if req.FromUID != "" {
		builder = builder.Where("from_uid=?", req.FromUID)
	}
	if req.ChannelID != "" {
		if req.ChannelType == common.ChannelTypePerson.Uint8() {
			fakeChannelID := s.searchChannelID(loginUID, req)
			peerChannelID := req.ChannelID
			if common.IsFakeChannel(peerChannelID) {
				peerChannelID = common.GetToChannelIDWithFakeChannelID(peerChannelID, loginUID)
			}
			builder = builder.Where("(channel_id=? or (from_uid=? and channel_id=?) or (from_uid=? and channel_id=?))", fakeChannelID, loginUID, peerChannelID, peerChannelID, loginUID)
		} else {
			builder = builder.Where("channel_id=?", req.ChannelID)
		}
	}
	if req.ChannelType != 0 {
		builder = builder.Where("channel_type=?", req.ChannelType)
	}
	if req.StartTime > 0 {
		builder = builder.Where("timestamp>=?", req.StartTime)
	}
	if req.EndTime > 0 {
		builder = builder.Where("timestamp<?", req.EndTime)
	}

	_, err := builder.OrderDesc("timestamp").Limit(uint64(limit)).Load(&rows)
	return rows, err
}

func (s *Search) localMessageVisible(loginUID string, req *globalSearchReq, row *localSearchMessage, joinedGroupMap map[string]bool) bool {
	if req.ChannelID != "" {
		if req.ChannelType == common.ChannelTypePerson.Uint8() {
			if !s.matchPersonConversation(loginUID, req.ChannelID, row) {
				return false
			}
		} else if row.ChannelID != req.ChannelID {
			return false
		}
	}
	if req.ChannelType != 0 && row.ChannelType != req.ChannelType {
		return false
	}
	if row.ChannelType == common.ChannelTypeGroup.Uint8() {
		return joinedGroupMap[row.ChannelID]
	}
	if row.ChannelType == common.ChannelTypePerson.Uint8() {
		return row.ChannelID == loginUID || row.FromUID == loginUID
	}
	return false
}

func (s *Search) searchChannelID(loginUID string, req *globalSearchReq) string {
	if req.ChannelType == common.ChannelTypePerson.Uint8() && req.ChannelID != "" && !common.IsFakeChannel(req.ChannelID) {
		return common.GetFakeChannelIDWith(loginUID, req.ChannelID)
	}
	return req.ChannelID
}

func (s *Search) displayPersonChannelID(loginUID string, channelID string, fromUID string) string {
	if common.IsFakeChannel(channelID) {
		return common.GetToChannelIDWithFakeChannelID(channelID, loginUID)
	}
	if fromUID != "" && fromUID != loginUID {
		return fromUID
	}
	return channelID
}

func (s *Search) matchPersonConversation(loginUID string, channelID string, row *localSearchMessage) bool {
	if channelID == "" {
		return true
	}
	fakeChannelID := channelID
	peerChannelID := channelID
	if common.IsFakeChannel(channelID) {
		peerChannelID = common.GetToChannelIDWithFakeChannelID(channelID, loginUID)
	} else {
		fakeChannelID = common.GetFakeChannelIDWith(loginUID, channelID)
	}
	if row.ChannelID == fakeChannelID {
		return true
	}
	if row.FromUID == loginUID && row.ChannelID == peerChannelID {
		return true
	}
	if row.FromUID == peerChannelID && row.ChannelID == loginUID {
		return true
	}
	return false
}

func (s *Search) localMessageTables() []string {
	tableCount := s.ctx.GetConfig().TablePartitionConfig.MessageTableCount
	if tableCount <= 0 {
		tableCount = 1
	}
	tables := make([]string, 0, tableCount)
	for i := 0; i < tableCount; i++ {
		if i == 0 {
			tables = append(tables, "message")
			continue
		}
		tables = append(tables, fmt.Sprintf("message%d", i))
	}
	return tables
}

type localSearchMessage struct {
	MessageID   string
	MessageSeq  uint32
	ClientMsgNo string
	Header      string
	Setting     uint8
	Signal      int
	FromUID     string
	ChannelID   string
	ChannelType uint8
	Timestamp   int32
	Payload     []byte
	IsDeleted   int
}

func (m *localSearchMessage) contentType() int {
	var payloadMap map[string]interface{}
	if err := json.Unmarshal(m.Payload, &payloadMap); err != nil {
		return 0
	}
	contentType, ok := payloadMap["type"].(float64)
	if !ok {
		return 0
	}
	return int(contentType)
}

func (m *localSearchMessage) toMessageResp(loginUID string) *config.MessageResp {
	messageID, _ := strconv.ParseInt(m.MessageID, 10, 64)
	channelID := m.ChannelID
	if m.ChannelType == common.ChannelTypePerson.Uint8() {
		if common.IsFakeChannel(m.ChannelID) {
			channelID = common.GetToChannelIDWithFakeChannelID(m.ChannelID, loginUID)
		} else if m.FromUID != "" && m.FromUID != loginUID {
			channelID = m.FromUID
		}
	}
	return &config.MessageResp{
		Setting:      m.Setting,
		MessageID:    messageID,
		MessageIDStr: m.MessageID,
		MessageSeq:   m.MessageSeq,
		ClientMsgNo:  m.ClientMsgNo,
		FromUID:      m.FromUID,
		ChannelID:    channelID,
		ChannelType:  m.ChannelType,
		Timestamp:    m.Timestamp,
		Payload:      m.Payload,
		IsDeleted:    m.IsDeleted,
	}
}

type channelResp struct {
	ChannelID     string `json:"channel_id"`
	ChannelType   uint8  `json:"channel_type"`
	ChannelRemark string `json:"channel_remark"`
	ChannelName   string `json:"channel_name"`
}

type messageResp struct {
	Setting      uint8                  `json:"setting"`           // 设置
	MessageID    int64                  `json:"message_id"`        // 服务端的消息ID(全局唯一)
	MessageIDStr string                 `json:"message_idstr"`     // 服务端的消息ID(全局唯一)字符串形式
	MessageSeq   uint32                 `json:"message_seq"`       // 消息序列号 （用户唯一，有序递增）
	ClientMsgNo  string                 `json:"client_msg_no"`     // 客户端消息唯一编号
	FromUID      string                 `json:"from_uid"`          // 发送者UID
	Expire       uint32                 `json:"expire,omitempty"`  // expire
	Timestamp    int32                  `json:"timestamp"`         // 服务器消息时间戳(10位，到秒)
	Payload      map[string]interface{} `json:"payload"`           // 消息内容
	IsDeleted    int8                   `json:"is_deleted"`        // 是否已删除
	Channel      *channelResp           `json:"channel,omitempty"` // 消息所属channel
	FromChannel  *channelResp           `json:"from_channel"`      // 消息发送者channel
}
