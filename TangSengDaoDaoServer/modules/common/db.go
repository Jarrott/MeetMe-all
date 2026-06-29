package common

import (
	dbs "github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/db"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/gocraft/dbr/v2"
)

type db struct {
	session *dbr.Session
}

func newDB(session *dbr.Session) *db {
	return &db{
		session: session,
	}
}

// 添加版本升级
func (d *db) insertAppVersion(m *appVersionModel) (int64, error) {
	result, err := d.session.InsertInto("app_version").Columns(util.AttrToUnderscore(m)...).Record(m).Exec()
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return id, err
}

// 查询某个系统的最新版本
func (d *db) queryNewVersion(os string) (*appVersionModel, error) {
	var model *appVersionModel
	_, err := d.session.Select("*").From("app_version").Where("os=?", os).OrderDir("created_at", false).Limit(1).Load(&model)
	return model, err
}

// 查询版本升级列表
func (d *db) queryAppVersionListWithPage(pageSize, page uint64) ([]*appVersionModel, error) {
	var models []*appVersionModel
	_, err := d.session.Select("*").From("app_version").Offset((page-1)*pageSize).Limit(pageSize).OrderDir("updated_at", false).Load(&models)
	return models, err
}

// 模糊查询用户数量
func (d *db) queryCount() (int64, error) {
	var count int64
	_, err := d.session.Select("count(*)").From("app_version").Load(&count)
	return count, err
}

// 查询所有背景图片
func (d *db) queryChatBgs() ([]*chatBgModel, error) {
	var models []*chatBgModel
	_, err := d.session.Select("*").From("chat_bg").Load(&models)
	return models, err
}

// 查询app模块
func (d *db) queryAppModule() ([]*appModuleModel, error) {
	var list []*appModuleModel
	_, err := d.session.Select("*").From("app_module").OrderDir("created_at", true).Load(&list)
	return list, err
}

// 查询某个app模块
func (d *db) queryAppModuleWithSid(sid string) (*appModuleModel, error) {
	var m *appModuleModel
	_, err := d.session.Select("*").From("app_module").Where("sid=?", sid).Load(&m)
	return m, err
}

// 新增app模块
func (d *db) insertAppModule(m *appModuleModel) (int64, error) {
	result, err := d.session.InsertInto("app_module").Columns(util.AttrToUnderscore(m)...).Record(m).Exec()
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return id, err
}

// 修改app模块
func (d *db) updateAppModule(m *appModuleModel) error {
	_, err := d.session.Update("app_module").SetMap(map[string]interface{}{
		"name":   m.Name,
		"desc":   m.Desc,
		"status": m.Status,
	}).Where("id=?", m.Id).Exec()
	return err
}

// 删除模块
func (d *db) deleteAppModule(sid string) error {
	_, err := d.session.DeleteFrom("app_module").Where("sid=?", sid).Exec()
	return err
}

func InsertManagerAlert(session *dbr.Session, m *ManagerAlertModel) error {
	_, err := session.InsertInto("manager_alert").Columns(util.AttrToUnderscore(m)...).Record(m).Exec()
	return err
}

func (d *db) queryManagerAlerts(alertType string, unreadOnly bool, pageSize, page uint64) ([]*ManagerAlertModel, error) {
	var list []*ManagerAlertModel
	builder := d.session.Select("*").From("manager_alert")
	if alertType != "" {
		builder = builder.Where("alert_type=?", alertType)
	}
	if unreadOnly {
		builder = builder.Where("is_read=0")
	}
	_, err := builder.Offset((page-1)*pageSize).Limit(pageSize).OrderDir("created_at", false).Load(&list)
	return list, err
}

func (d *db) queryManagerAlertCount(alertType string, unreadOnly bool) (int64, error) {
	var count int64
	builder := d.session.Select("count(*)").From("manager_alert")
	if alertType != "" {
		builder = builder.Where("alert_type=?", alertType)
	}
	if unreadOnly {
		builder = builder.Where("is_read=0")
	}
	_, err := builder.Load(&count)
	return count, err
}

func (d *db) queryManagerAlertUnreadStats() ([]*managerAlertUnreadStat, error) {
	var list []*managerAlertUnreadStat
	_, err := d.session.Select("alert_type,count(*) count").From("manager_alert").Where("is_read=0").GroupBy("alert_type").Load(&list)
	return list, err
}

func (d *db) markManagerAlertsRead(ids []int64, alertType string) error {
	builder := d.session.Update("manager_alert").Set("is_read", 1).Set("read_at", dbr.Expr("Now()"))
	if len(ids) > 0 {
		builder = builder.Where("id in ?", ids)
	}
	if alertType != "" {
		builder = builder.Where("alert_type=?", alertType)
	}
	_, err := builder.Exec()
	return err
}

func (d *db) insertUserSticker(m *userStickerModel) (int64, error) {
	result, err := d.session.InsertInto("user_sticker").
		Columns("uid", "category", "path", "placeholder", "format", "name").
		Record(m).Exec()
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (d *db) queryUserStickers(uid string, category string) ([]*userStickerModel, error) {
	var list []*userStickerModel
	builder := d.session.Select("*").From("user_sticker").
		Where("uid=?", uid).
		Where("is_deleted=0")
	if category != "" {
		builder = builder.Where("category=?", category)
	}
	_, err := builder.OrderDir("created_at", true).Load(&list)
	return list, err
}

func (d *db) queryFirstUserSticker(uid string) (*userStickerModel, error) {
	var model *userStickerModel
	_, err := d.session.Select("*").From("user_sticker").
		Where("uid=?", uid).
		Where("is_deleted=0").
		OrderDir("created_at", false).
		Limit(1).
		Load(&model)
	return model, err
}

func (d *db) deleteUserSticker(uid string, id int64) error {
	_, err := d.session.Update("user_sticker").
		Set("is_deleted", 1).
		Set("updated_at", dbr.Expr("Now()")).
		Where("uid=?", uid).
		Where("id=?", id).
		Exec()
	return err
}

type chatBgModel struct {
	Cover string // 封面
	Url   string // 图片地址
	IsSvg int    // 1 svg图片 0 普通图片
	dbs.BaseModel
}

type appVersionModel struct {
	AppVersion  string // app版本
	OS          string // android | ios
	IsForce     int    // 是否强制更新 1:是
	UpdateDesc  string // 更新说明
	DownloadURL string // 下载地址
	Signature   string // 安装包签名
	dbs.BaseModel
}

type appModuleModel struct {
	SID    string // 模块ID
	Name   string // 模块名称
	Desc   string // 介绍
	Status int    // 状态
	dbs.BaseModel
}

type ManagerAlertModel struct {
	AlertType   string
	Title       string
	Content     string
	ActorUID    string
	ActorName   string
	TargetID    string
	TargetType  string
	ChannelID   string
	ChannelType uint8
	MessageID   string
	MessageSeq  uint32
	TriggerWord string
	Payload     string
	IsRead      int
	dbs.BaseModel
}

type managerAlertUnreadStat struct {
	AlertType string
	Count     int64
}

type userStickerModel struct {
	UID         string
	Category    string
	Path        string
	Placeholder string
	Format      string
	Name        string
	IsDeleted   int
	dbs.BaseModel
}
