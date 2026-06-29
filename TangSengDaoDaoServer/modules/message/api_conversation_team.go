package message

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func (co *Conversation) conversationTeams(c *wkhttp.Context) {
	loginUID := c.GetLoginUID()
	teams, err := co.conversationTeamDB.queryTeams(loginUID)
	if err != nil {
		co.Error("查询会话团队失败！", zap.Error(err))
		c.ResponseError(errors.New("查询会话团队失败"))
		return
	}
	items, err := co.conversationTeamDB.queryItems(loginUID)
	if err != nil {
		co.Error("查询会话团队成员失败！", zap.Error(err))
		c.ResponseError(errors.New("查询会话团队成员失败"))
		return
	}
	itemResps := make([]*conversationTeamItemResp, 0, len(items))
	for _, item := range items {
		itemResps = append(itemResps, newConversationTeamItemResp(item))
	}
	teamResps := make([]*conversationTeamResp, 0, len(teams))
	for _, team := range teams {
		resp := newConversationTeamResp(team)
		for _, item := range itemResps {
			if item.TeamID == resp.ID {
				resp.Items = append(resp.Items, item)
			}
		}
		teamResps = append(teamResps, resp)
	}
	c.JSON(http.StatusOK, gin.H{
		"teams": teamResps,
		"items": itemResps,
	})
}

func (co *Conversation) conversationTeamCreate(c *wkhttp.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.ResponseError(errors.New("团队名称不能为空"))
		return
	}
	if len([]rune(name)) > 30 {
		c.ResponseError(errors.New("团队名称不能超过30个字"))
		return
	}
	loginUID := c.GetLoginUID()
	sortNo, err := co.conversationTeamDB.queryMaxSort(loginUID)
	if err != nil {
		co.Error("查询会话团队排序失败！", zap.Error(err))
		c.ResponseError(errors.New("创建团队失败"))
		return
	}
	version := co.ctx.GenSeq(common.SyncConversationExtraKey)
	teamID, err := co.conversationTeamDB.insertTeam(loginUID, name, sortNo+1, version)
	if err != nil {
		co.Error("创建会话团队失败！", zap.Error(err))
		c.ResponseError(errors.New("创建团队失败"))
		return
	}
	co.notifyConversationTeamSync(loginUID)
	c.JSON(http.StatusOK, gin.H{
		"id":      teamID,
		"name":    name,
		"sort_no": sortNo + 1,
		"version": version,
	})
}

func (co *Conversation) conversationTeamUpdate(c *wkhttp.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.ResponseError(errors.New("团队名称不能为空"))
		return
	}
	if len([]rune(name)) > 30 {
		c.ResponseError(errors.New("团队名称不能超过30个字"))
		return
	}
	teamID, _ := strconv.ParseInt(c.Param("team_id"), 10, 64)
	loginUID := c.GetLoginUID()
	version := co.ctx.GenSeq(common.SyncConversationExtraKey)
	err := co.conversationTeamDB.updateTeamName(loginUID, teamID, name, version)
	if err != nil {
		co.Error("修改会话团队失败！", zap.Error(err))
		c.ResponseError(errors.New("修改团队失败"))
		return
	}
	co.notifyConversationTeamSync(loginUID)
	c.JSON(http.StatusOK, gin.H{
		"id":      teamID,
		"name":    name,
		"version": version,
	})
}

func (co *Conversation) conversationTeamDelete(c *wkhttp.Context) {
	teamID, _ := strconv.ParseInt(c.Param("team_id"), 10, 64)
	loginUID := c.GetLoginUID()
	version := co.ctx.GenSeq(common.SyncConversationExtraKey)
	err := co.conversationTeamDB.deleteTeam(loginUID, teamID, version)
	if err != nil {
		co.Error("删除会话团队失败！", zap.Error(err))
		c.ResponseError(errors.New("删除团队失败"))
		return
	}
	co.notifyConversationTeamSync(loginUID)
	c.ResponseOK()
}

func (co *Conversation) conversationTeamItemSet(c *wkhttp.Context) {
	var req struct {
		ChannelID   string `json:"channel_id"`
		ChannelType uint8  `json:"channel_type"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	if strings.TrimSpace(req.ChannelID) == "" {
		c.ResponseError(errors.New("会话ID不能为空"))
		return
	}
	teamID, _ := strconv.ParseInt(c.Param("team_id"), 10, 64)
	loginUID := c.GetLoginUID()
	if teamID > 0 {
		team, err := co.conversationTeamDB.queryTeam(loginUID, teamID)
		if err != nil {
			co.Error("查询会话团队失败！", zap.Error(err))
			c.ResponseError(errors.New("设置团队失败"))
			return
		}
		if team == nil {
			c.ResponseError(errors.New("团队不存在"))
			return
		}
	}
	version := co.ctx.GenSeq(common.SyncConversationExtraKey)
	err := co.conversationTeamDB.upsertItem(loginUID, teamID, req.ChannelID, req.ChannelType, version)
	if err != nil {
		co.Error("设置会话团队成员失败！", zap.Error(err))
		c.ResponseError(errors.New("设置团队失败"))
		return
	}
	co.notifyConversationTeamSync(loginUID)
	c.JSON(http.StatusOK, gin.H{
		"team_id":      teamID,
		"channel_id":    req.ChannelID,
		"channel_type":  req.ChannelType,
		"version":       version,
	})
}

func (co *Conversation) conversationTeamItemDelete(c *wkhttp.Context) {
	channelID := c.Param("channel_id")
	channelTypeI64, _ := strconv.ParseInt(c.Param("channel_type"), 10, 64)
	loginUID := c.GetLoginUID()
	version := co.ctx.GenSeq(common.SyncConversationExtraKey)
	err := co.conversationTeamDB.deleteItem(loginUID, channelID, uint8(channelTypeI64), version)
	if err != nil {
		co.Error("移出会话团队失败！", zap.Error(err))
		c.ResponseError(errors.New("移出团队失败"))
		return
	}
	co.notifyConversationTeamSync(loginUID)
	c.ResponseOK()
}

func (co *Conversation) notifyConversationTeamSync(uid string) {
	err := co.ctx.SendCMD(config.MsgCMDReq{
		NoPersist:   true,
		ChannelID:   uid,
		ChannelType: uint8(common.ChannelTypePerson),
		CMD:         common.CMDSyncConversationExtra,
	})
	if err != nil {
		co.Warn("发送会话团队同步cmd失败", zap.String("uid", uid), zap.Error(err))
	}
}

type conversationTeamResp struct {
	ID      int64                       `json:"id"`
	Name    string                      `json:"name"`
	SortNo  int                         `json:"sort_no"`
	Version int64                       `json:"version"`
	Items   []*conversationTeamItemResp `json:"items"`
}

func newConversationTeamResp(m *conversationTeamModel) *conversationTeamResp {
	return &conversationTeamResp{
		ID:      m.Id,
		Name:    m.Name,
		SortNo:  m.SortNo,
		Version: m.Version,
		Items:   make([]*conversationTeamItemResp, 0),
	}
}

type conversationTeamItemResp struct {
	TeamID      int64  `json:"team_id"`
	ChannelID   string `json:"channel_id"`
	ChannelType uint8  `json:"channel_type"`
	TopOrder    int64  `json:"top_order"`
	Version     int64  `json:"version"`
}

func newConversationTeamItemResp(m *conversationTeamItemModel) *conversationTeamItemResp {
	return &conversationTeamItemResp{
		TeamID:      m.TeamID,
		ChannelID:   m.ChannelID,
		ChannelType: m.ChannelType,
		TopOrder:    m.TopOrder,
		Version:     m.Version,
	}
}
