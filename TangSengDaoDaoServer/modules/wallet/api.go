package wallet

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/user"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"github.com/gin-gonic/gin"
	"github.com/gocraft/dbr/v2"
	"go.uber.org/zap"
)

const walletReceiveQRCodeType common.QRCodeType = "walletReceive"

type Wallet struct {
	ctx          *config.Context
	db           *DB
	userDB       *user.DB
	rateProvider *exchangeRateProvider
	log.Log
}

func New(ctx *config.Context) *Wallet {
	return &Wallet{
		ctx:    ctx,
		db:     NewDB(ctx),
		userDB: user.NewDB(ctx),
		Log:    log.NewTLog("Wallet"),
	}
}

func (w *Wallet) Route(r *wkhttp.WKHttp) {
	rates := r.Group("/v1/wallet")
	{
		rates.GET("/exchange-rates", w.exchangeRates)
	}

	wallet := r.Group("/v1/wallet", w.ctx.AuthMiddleware(r))
	{
		wallet.GET("/balance", w.balance)
		wallet.GET("/transactions", w.transactions)
		wallet.GET("/receive-qrcode", w.receiveQRCode)
		wallet.POST("/receive-qrcode", w.receiveQRCode)
		wallet.GET("/scan-receive/:code", w.scanReceiveQRCode)
		wallet.POST("/withdraw", w.withdraw)
		wallet.POST("/transfer", w.transfer)
		wallet.POST("/scan-pay", w.scanPay)
	}

	manager := r.Group("/v1/manager/wallet", w.ctx.AuthMiddleware(r))
	{
		manager.GET("/exchange-rates", w.managerExchangeRates)
		manager.POST("/exchange-rates", w.managerSaveExchangeRates)
		manager.GET("/withdraws", w.managerWithdraws)
		manager.POST("/withdraws/:trade_no/approve", w.managerWithdrawApprove)
		manager.POST("/withdraws/:trade_no/reject", w.managerWithdrawReject)
		manager.GET("/:uid/balance", w.managerBalance)
		manager.GET("/:uid/transactions", w.managerTransactions)
		manager.POST("/:uid/recharge", w.managerRecharge)
		manager.POST("/:uid/deduct", w.managerDeduct)
	}
}

func (w *Wallet) getRateProvider() *exchangeRateProvider {
	if w.rateProvider == nil {
		w.rateProvider = newExchangeRateProvider(w.db)
	}
	return w.rateProvider
}

func (w *Wallet) balance(c *wkhttp.Context) {
	uid := c.GetLoginUID()
	model, err := w.db.getOrCreateAccount(uid)
	if err != nil {
		w.Error("查询钱包余额失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("查询钱包余额失败"))
		return
	}
	c.Response(accountToResp(model))
}

func (w *Wallet) exchangeRates(c *wkhttp.Context) {
	symbols := normalizeRateSymbols(c.Query("symbols"))
	resp, err := w.getRateProvider().latest(symbols)
	if err != nil {
		w.Error("查询汇率失败", zap.Error(err), zap.Strings("symbols", symbols))
		c.ResponseError(errors.New("查询汇率失败"))
		return
	}
	c.Response(resp)
}

func (w *Wallet) managerExchangeRates(c *wkhttp.Context) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	resp, err := w.getRateProvider().managerConfig(c.Query("rate_date"))
	if err != nil {
		w.Error("查询汇率配置失败", zap.Error(err))
		c.ResponseError(err)
		return
	}
	c.Response(resp)
}

func (w *Wallet) managerSaveExchangeRates(c *wkhttp.Context) {
	if err := c.CheckLoginRoleIsSuperAdmin(); err != nil {
		c.ResponseError(err)
		return
	}
	var req exchangeRateConfigReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	if err := w.getRateProvider().saveConfig(&req, c.GetLoginUID()); err != nil {
		w.Error("保存汇率配置失败", zap.Error(err))
		c.ResponseError(err)
		return
	}
	c.ResponseOK()
}

func (w *Wallet) managerBalance(c *wkhttp.Context) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	uid := strings.TrimSpace(c.Param("uid"))
	if uid == "" {
		c.ResponseError(errors.New("用户uid不能为空"))
		return
	}
	if err := w.ensureUserExists(uid); err != nil {
		c.ResponseError(err)
		return
	}
	model, err := w.db.getOrCreateAccount(uid)
	if err != nil {
		w.Error("查询用户钱包余额失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("查询用户钱包余额失败"))
		return
	}
	c.Response(accountToResp(model))
}

func (w *Wallet) transactions(c *wkhttp.Context) {
	uid := c.GetLoginUID()
	w.respondTransactions(c, uid)
}

func (w *Wallet) managerTransactions(c *wkhttp.Context) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	uid := strings.TrimSpace(c.Param("uid"))
	if uid == "" {
		c.ResponseError(errors.New("用户uid不能为空"))
		return
	}
	if err := w.ensureUserExists(uid); err != nil {
		c.ResponseError(err)
		return
	}
	w.respondTransactions(c, uid)
}

func (w *Wallet) respondTransactions(c *wkhttp.Context, uid string) {
	pageIndex, pageSize := c.GetPage()
	tradeType := parseIntQuery(c.Query("trade_type"))
	direction := parseIntQuery(c.Query("direction"))
	list, err := w.db.queryTransactions(uid, tradeType, direction, pageIndex, pageSize)
	if err != nil {
		w.Error("查询钱包流水失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("查询钱包流水失败"))
		return
	}
	count, err := w.db.queryTransactionCount(uid, tradeType, direction)
	if err != nil {
		w.Error("查询钱包流水数量失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("查询钱包流水数量失败"))
		return
	}
	c.Response(gin.H{
		"count": count,
		"list":  transactionsToResp(list),
	})
}

func (w *Wallet) managerWithdraws(c *wkhttp.Context) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	pageIndex, pageSize := c.GetPage()
	status := parseStatusQuery(c.Query("status"))
	list, err := w.db.queryWithdrawTransactions(status, pageIndex, pageSize)
	if err != nil {
		w.Error("查询提现订单失败", zap.Error(err))
		c.ResponseError(errors.New("查询提现订单失败"))
		return
	}
	count, err := w.db.queryWithdrawTransactionCount(status)
	if err != nil {
		w.Error("查询提现订单数量失败", zap.Error(err))
		c.ResponseError(errors.New("查询提现订单数量失败"))
		return
	}
	c.Response(gin.H{
		"count": count,
		"list":  transactionsToResp(list),
	})
}

func (w *Wallet) managerRecharge(c *wkhttp.Context) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	uid := strings.TrimSpace(c.Param("uid"))
	if uid == "" {
		c.ResponseError(errors.New("用户uid不能为空"))
		return
	}
	if err := w.ensureUserExists(uid); err != nil {
		c.ResponseError(err)
		return
	}
	var req amountReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	if !validAmount(req.Amount) {
		c.ResponseError(errors.New("金额必须大于0"))
		return
	}
	transaction, err := w.db.recharge(uid, req.Amount, normalizeRemark(req.Remark), c.GetLoginUID(), normalizeTradeNo("wallet_recharge_", req.TradeNo))
	if err != nil {
		w.Error("钱包充值失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("钱包充值失败"))
		return
	}
	c.Response(transactionToResp(transaction))
}

func (w *Wallet) managerDeduct(c *wkhttp.Context) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	uid := strings.TrimSpace(c.Param("uid"))
	if uid == "" {
		c.ResponseError(errors.New("用户uid不能为空"))
		return
	}
	if err := w.ensureUserExists(uid); err != nil {
		c.ResponseError(err)
		return
	}
	var req amountReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	if !validAmount(req.Amount) {
		c.ResponseError(errors.New("金额必须大于0"))
		return
	}
	transaction, err := w.db.deduct(uid, req.Amount, normalizeRemark(req.Remark), c.GetLoginUID(), normalizeTradeNo("wallet_deduct_", req.TradeNo))
	if err != nil {
		if err == errInsufficientBalance {
			c.ResponseError(err)
			return
		}
		w.Error("钱包扣款失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("钱包扣款失败"))
		return
	}
	c.Response(transactionToResp(transaction))
}

func (w *Wallet) managerWithdrawApprove(c *wkhttp.Context) {
	w.auditWithdraw(c, true)
}

func (w *Wallet) managerWithdrawReject(c *wkhttp.Context) {
	w.auditWithdraw(c, false)
}

func (w *Wallet) auditWithdraw(c *wkhttp.Context, approved bool) {
	if err := c.CheckLoginRole(); err != nil {
		c.ResponseError(err)
		return
	}
	tradeNo := strings.TrimSpace(c.Param("trade_no"))
	if tradeNo == "" {
		c.ResponseError(errors.New("提现订单号不能为空"))
		return
	}
	var transaction *transactionModel
	var err error
	if approved {
		transaction, err = w.db.approveWithdraw(tradeNo, c.GetLoginUID())
	} else {
		transaction, err = w.db.rejectWithdraw(tradeNo, c.GetLoginUID())
	}
	if err != nil {
		if err == errInvalidWithdrawStatus || err == errInsufficientFrozenAmount {
			c.ResponseError(err)
			return
		}
		w.Error("审核提现订单失败", zap.Error(err), zap.String("tradeNo", tradeNo), zap.Bool("approved", approved))
		c.ResponseError(errors.New("审核提现订单失败"))
		return
	}
	c.Response(transactionToResp(transaction))
}

func (w *Wallet) withdraw(c *wkhttp.Context) {
	uid := c.GetLoginUID()
	var req amountReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	if !validAmount(req.Amount) {
		c.ResponseError(errors.New("金额必须大于0"))
		return
	}
	transaction, err := w.db.withdraw(uid, req.Amount, normalizeRemark(req.Remark), normalizeTradeNo("wallet_withdraw_", req.TradeNo))
	if err != nil {
		if err == errInsufficientBalance {
			c.ResponseError(err)
			return
		}
		w.Error("钱包提现失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("钱包提现失败"))
		return
	}
	c.Response(transactionToResp(transaction))
}

func (w *Wallet) transfer(c *wkhttp.Context) {
	fromUID := c.GetLoginUID()
	var req transferReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	req.ToUID = strings.TrimSpace(req.ToUID)
	if req.ToUID == "" {
		c.ResponseError(errors.New("收款用户uid不能为空"))
		return
	}
	if !validAmount(req.Amount) {
		c.ResponseError(errors.New("金额必须大于0"))
		return
	}
	if err := w.ensureUserExists(req.ToUID); err != nil {
		c.ResponseError(err)
		return
	}
	transaction, _, err := w.db.transfer(fromUID, req.ToUID, req.Amount, normalizeRemark(req.Remark), normalizeTradeNo("wallet_transfer_out_", req.TradeNo))
	if err != nil {
		if err == errInsufficientBalance || err == errSameTransferUser || err == errDuplicateTradeNo {
			c.ResponseError(err)
			return
		}
		w.Error("钱包转账失败", zap.Error(err), zap.String("fromUID", fromUID), zap.String("toUID", req.ToUID))
		c.ResponseError(errors.New("钱包转账失败"))
		return
	}
	c.Response(transactionToResp(transaction))
}

func (w *Wallet) receiveQRCode(c *wkhttp.Context) {
	uid := c.GetLoginUID()
	amount := parseInt64Query(c.Query("amount"))
	remark := normalizeRemark(c.Query("remark"))
	req := receiveQRCodeReq{
		Amount: amount,
		Remark: remark,
	}
	if c.Request.Method == http.MethodPost {
		_ = c.BindJSON(&req)
		req.Remark = normalizeRemark(req.Remark)
	}
	if req.Amount < 0 {
		c.ResponseError(errors.New("金额不能小于0"))
		return
	}
	if _, err := w.db.getOrCreateAccount(uid); err != nil {
		w.Error("生成收款码前查询钱包失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("生成收款码失败"))
		return
	}
	code := util.GenerUUID()
	qrModel := common.NewQRCodeModel(walletReceiveQRCodeType, map[string]interface{}{
		"receiver_uid": uid,
		"amount":       req.Amount,
		"remark":       req.Remark,
	})
	if err := w.ctx.GetRedisConn().SetAndExpire(fmt.Sprintf("%s%s", common.QRCodeCachePrefix, code), util.ToJson(qrModel), time.Hour*24); err != nil {
		w.Error("设置钱包收款码缓存失败", zap.Error(err), zap.String("uid", uid))
		c.ResponseError(errors.New("生成收款码失败"))
		return
	}
	qrcodeURL := fmt.Sprintf("%s/%s", w.ctx.GetConfig().External.BaseURL, strings.ReplaceAll(w.ctx.GetConfig().QRCodeInfoURL, ":code", code))
	c.Response(gin.H{
		"code":    code,
		"qrcode":  qrcodeURL,
		"expire":  time.Now().Add(time.Hour * 24).Format("2006-01-02 15:04:05"),
		"amount":  req.Amount,
		"remark":  req.Remark,
		"type":    string(walletReceiveQRCodeType),
		"pay_url": fmt.Sprintf("%s/v1/wallet/scan-receive/%s", strings.TrimRight(w.ctx.GetConfig().External.BaseURL, "/"), code),
	})
}

func (w *Wallet) scanReceiveQRCode(c *wkhttp.Context) {
	code := strings.TrimSpace(c.Param("code"))
	data, err := w.getReceiveQRCodeData(code)
	if err != nil {
		c.ResponseError(err)
		return
	}
	c.Response(data)
}

func (w *Wallet) scanPay(c *wkhttp.Context) {
	fromUID := c.GetLoginUID()
	var req scanPayReq
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误"))
		return
	}
	req.Code = strings.TrimSpace(req.Code)
	data, err := w.getReceiveQRCodeData(req.Code)
	if err != nil {
		c.ResponseError(err)
		return
	}
	toUID, _ := data["receiver_uid"].(string)
	if toUID == "" {
		c.ResponseError(errors.New("收款码收款人为空"))
		return
	}
	if err := w.ensureUserExists(toUID); err != nil {
		c.ResponseError(err)
		return
	}
	amount := req.Amount
	if fixedAmount, ok := toInt64(data["amount"]); ok && fixedAmount > 0 {
		amount = fixedAmount
	}
	if !validAmount(amount) {
		c.ResponseError(errors.New("金额必须大于0"))
		return
	}
	remark := normalizeRemark(req.Remark)
	if remark == "" {
		if qrRemark, _ := data["remark"].(string); qrRemark != "" {
			remark = normalizeRemark(qrRemark)
		}
	}
	tradeNo := normalizeTradeNo("wallet_scan_transfer_out_", req.TradeNo)
	transaction, _, err := w.db.transfer(fromUID, toUID, amount, remark, tradeNo)
	if err != nil {
		if err == errInsufficientBalance || err == errSameTransferUser || err == errDuplicateTradeNo {
			c.ResponseError(err)
			return
		}
		w.Error("扫码转账失败", zap.Error(err), zap.String("fromUID", fromUID), zap.String("toUID", toUID), zap.String("code", req.Code))
		c.ResponseError(errors.New("扫码转账失败"))
		return
	}
	c.Response(transactionToResp(transaction))
}

func (w *Wallet) getReceiveQRCodeData(code string) (map[string]interface{}, error) {
	if code == "" {
		return nil, errors.New("收款码不能为空")
	}
	qrcodeContent, err := w.ctx.GetRedisConn().GetString(fmt.Sprintf("%s%s", common.QRCodeCachePrefix, code))
	if err != nil {
		w.Error("获取钱包收款码失败", zap.Error(err), zap.String("code", code))
		return nil, errors.New("获取收款码失败")
	}
	if strings.TrimSpace(qrcodeContent) == "" {
		return nil, errors.New("收款码不存在或已过期")
	}
	var qrCodeModel common.QRCodeModel
	if err := util.ReadJsonByByte([]byte(qrcodeContent), &qrCodeModel); err != nil {
		w.Error("解码钱包收款码失败", zap.Error(err), zap.String("code", code))
		return nil, errors.New("收款码数据有误")
	}
	if qrCodeModel.Type != walletReceiveQRCodeType {
		return nil, errors.New("不是钱包收款码")
	}
	if qrCodeModel.Data == nil {
		return nil, errors.New("收款码数据为空")
	}
	resp := map[string]interface{}{}
	for k, v := range qrCodeModel.Data {
		resp[k] = v
	}
	resp["code"] = code
	resp["type"] = string(walletReceiveQRCodeType)
	return resp, nil
}

func (w *Wallet) ensureUserExists(uid string) error {
	model, err := w.userDB.QueryByUID(uid)
	if err != nil {
		if err == dbr.ErrNotFound {
			return errors.New("用户不存在")
		}
		w.Error("查询用户失败", zap.Error(err), zap.String("uid", uid))
		return errors.New("查询用户失败")
	}
	if model == nil {
		return errors.New("用户不存在")
	}
	return nil
}

func parseIntQuery(v string) int {
	if strings.TrimSpace(v) == "" {
		return 0
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return 0
	}
	return n
}

func parseInt64Query(v string) int64 {
	if strings.TrimSpace(v) == "" {
		return 0
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0
	}
	return n
}

func toInt64(v interface{}) (int64, bool) {
	switch val := v.(type) {
	case int64:
		return val, true
	case int:
		return int64(val), true
	case float64:
		return int64(val), true
	case json.Number:
		n, err := val.Int64()
		return n, err == nil
	default:
		return 0, false
	}
}

func parseStatusQuery(v string) int {
	if strings.TrimSpace(v) == "" {
		return -1
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return -1
	}
	return n
}
