package message

import (
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/db"
	"github.com/gocraft/dbr/v2"
)

type conversationTeamDB struct {
	ctx     *config.Context
	session *dbr.Session
}

func newConversationTeamDB(ctx *config.Context) *conversationTeamDB {
	return &conversationTeamDB{
		ctx:     ctx,
		session: ctx.DB(),
	}
}

func (d *conversationTeamDB) queryTeams(uid string) ([]*conversationTeamModel, error) {
	var models []*conversationTeamModel
	_, err := d.session.Select("*").From("conversation_team").Where("uid=? and is_deleted=0", uid).OrderAsc("sort_no").OrderAsc("id").Load(&models)
	return models, err
}

func (d *conversationTeamDB) queryItems(uid string) ([]*conversationTeamItemModel, error) {
	var models []*conversationTeamItemModel
	_, err := d.session.Select("*").From("conversation_team_item").Where("uid=? and is_deleted=0", uid).Load(&models)
	return models, err
}

func (d *conversationTeamDB) queryTeam(uid string, teamID int64) (*conversationTeamModel, error) {
	var model conversationTeamModel
	count, err := d.session.Select("*").From("conversation_team").Where("uid=? and id=? and is_deleted=0", uid, teamID).Load(&model)
	if err != nil || count == 0 {
		return nil, err
	}
	return &model, nil
}

func (d *conversationTeamDB) queryMaxSort(uid string) (int, error) {
	var sortNo int
	err := d.session.SelectBySql("select COALESCE(max(sort_no),0) from conversation_team where uid=? and is_deleted=0", uid).LoadOne(&sortNo)
	return sortNo, err
}

func (d *conversationTeamDB) insertTeam(uid string, name string, sortNo int, version int64) (int64, error) {
	res, err := d.session.InsertBySql("insert into conversation_team(uid,name,sort_no,version) values(?,?,?,?)", uid, name, sortNo, version).Exec()
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *conversationTeamDB) updateTeamName(uid string, teamID int64, name string, version int64) error {
	_, err := d.session.Update("conversation_team").Set("name", name).Set("version", version).Where("uid=? and id=? and is_deleted=0", uid, teamID).Exec()
	return err
}

func (d *conversationTeamDB) deleteTeam(uid string, teamID int64, version int64) error {
	tx, err := d.session.Begin()
	if err != nil {
		return err
	}
	_, err = tx.Update("conversation_team").Set("is_deleted", 1).Set("version", version).Where("uid=? and id=? and is_deleted=0", uid, teamID).Exec()
	if err != nil {
		tx.Rollback()
		return err
	}
	_, err = tx.Update("conversation_team_item").Set("is_deleted", 1).Set("version", version).Where("uid=? and team_id=? and is_deleted=0", uid, teamID).Exec()
	if err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (d *conversationTeamDB) upsertItem(uid string, teamID int64, channelID string, channelType uint8, version int64) error {
	_, err := d.session.InsertBySql("insert into conversation_team_item(uid,team_id,channel_id,channel_type,version,is_deleted) values(?,?,?,?,?,0) on duplicate key update team_id=values(team_id),version=values(version),is_deleted=0", uid, teamID, channelID, channelType, version).Exec()
	return err
}

func (d *conversationTeamDB) deleteItem(uid string, channelID string, channelType uint8, version int64) error {
	_, err := d.session.Update("conversation_team_item").Set("is_deleted", 1).Set("version", version).Where("uid=? and channel_id=? and channel_type=? and is_deleted=0", uid, channelID, channelType).Exec()
	return err
}

type conversationTeamModel struct {
	UID       string
	Name      string
	SortNo    int
	IsDeleted int
	Version   int64
	db.BaseModel
}

type conversationTeamItemModel struct {
	UID         string
	TeamID      int64
	ChannelID   string
	ChannelType uint8
	TopOrder    int64
	IsDeleted   int
	Version     int64
	db.BaseModel
}
