package wallet

import (
	"fmt"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/db"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
)

const (
	tradeTypeRecharge = 1
	tradeTypeWithdraw = 2
	tradeTypeTransfer = 3
	tradeTypeDeduct   = 4
)

const (
	directionIncome  = 1
	directionExpense = 2
)

const (
	transactionStatusPending  = 0
	transactionStatusSuccess  = 1
	transactionStatusRejected = 2
)

type accountModel struct {
	UID          string
	Balance      int64
	FrozenAmount int64
	Version      int64
	db.BaseModel
}

type transactionModel struct {
	TradeNo         string
	RelatedTradeNo  string
	UID             string
	CounterpartyUID string
	TradeType       int
	Direction       int
	Amount          int64
	BalanceAfter    int64
	Status          int
	Remark          string
	OperatorUID     string
	db.BaseModel
}

type exchangeRateModel struct {
	RateDate      string
	BaseCurrency  string
	QuoteCurrency string
	Rate          float64
	Hidden        int
	Remark        string
	OperatorUID   string
	db.BaseModel
}

type amountReq struct {
	Amount  int64  `json:"amount"`
	Remark  string `json:"remark"`
	TradeNo string `json:"trade_no"`
}

type exchangeRateItemReq struct {
	Currency    string  `json:"currency"`
	Rate        float64 `json:"rate"`         // USD -> currency
	ReverseRate float64 `json:"reverse_rate"` // currency -> USD
	Hidden      bool    `json:"hidden"`
}

type exchangeRateConfigReq struct {
	RateDate string                `json:"rate_date"`
	Rates    []exchangeRateItemReq `json:"rates"`
	Remark   string                `json:"remark"`
}

type transferReq struct {
	ToUID   string `json:"to_uid"`
	Amount  int64  `json:"amount"`
	Remark  string `json:"remark"`
	TradeNo string `json:"trade_no"`
}

type receiveQRCodeReq struct {
	Amount int64  `json:"amount"`
	Remark string `json:"remark"`
}

type scanPayReq struct {
	Code    string `json:"code"`
	Amount  int64  `json:"amount"`
	Remark  string `json:"remark"`
	TradeNo string `json:"trade_no"`
}

type balanceResp struct {
	UID          string `json:"uid"`
	Balance      int64  `json:"balance"`
	FrozenAmount int64  `json:"frozen_amount"`
}

type transactionResp struct {
	TradeNo         string `json:"trade_no"`
	RelatedTradeNo  string `json:"related_trade_no"`
	UID             string `json:"uid"`
	CounterpartyUID string `json:"counterparty_uid"`
	TradeType       int    `json:"trade_type"`
	Direction       int    `json:"direction"`
	Amount          int64  `json:"amount"`
	BalanceAfter    int64  `json:"balance_after"`
	Status          int    `json:"status"`
	Remark          string `json:"remark"`
	OperatorUID     string `json:"operator_uid"`
	CreatedAt       string `json:"created_at"`
}

func accountToResp(model *accountModel) *balanceResp {
	if model == nil {
		return &balanceResp{}
	}
	return &balanceResp{
		UID:          model.UID,
		Balance:      model.Balance,
		FrozenAmount: model.FrozenAmount,
	}
}

func transactionToResp(model *transactionModel) *transactionResp {
	if model == nil {
		return nil
	}
	return &transactionResp{
		TradeNo:         model.TradeNo,
		RelatedTradeNo:  model.RelatedTradeNo,
		UID:             model.UID,
		CounterpartyUID: model.CounterpartyUID,
		TradeType:       model.TradeType,
		Direction:       model.Direction,
		Amount:          model.Amount,
		BalanceAfter:    model.BalanceAfter,
		Status:          model.Status,
		Remark:          model.Remark,
		OperatorUID:     model.OperatorUID,
		CreatedAt:       model.CreatedAt.String(),
	}
}

func transactionsToResp(models []*transactionModel) []*transactionResp {
	resps := make([]*transactionResp, 0, len(models))
	for _, model := range models {
		resps = append(resps, transactionToResp(model))
	}
	return resps
}

func normalizeTradeNo(prefix string, tradeNo string) string {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo != "" {
		return tradeNo
	}
	return fmt.Sprintf("%s%s", prefix, util.GenerUUID())
}

func normalizeRemark(remark string) string {
	remark = strings.TrimSpace(remark)
	if len([]rune(remark)) > 200 {
		return string([]rune(remark)[:200])
	}
	return remark
}

func validAmount(amount int64) bool {
	return amount > 0
}
