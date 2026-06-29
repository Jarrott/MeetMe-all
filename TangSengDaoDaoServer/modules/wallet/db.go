package wallet

import (
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/gocraft/dbr/v2"
)

var (
	errInsufficientBalance      = errors.New("余额不足")
	errInsufficientFrozenAmount = errors.New("冻结金额不足")
	errInvalidWithdrawStatus    = errors.New("提现订单状态不可操作")
	errSameTransferUser         = errors.New("不能给自己转账")
	errDuplicateTradeNo         = errors.New("交易流水号已存在")
)

type DB struct {
	session *dbr.Session
	ctx     *config.Context
}

func NewDB(ctx *config.Context) *DB {
	return &DB{
		session: ctx.DB(),
		ctx:     ctx,
	}
}

func (d *DB) getOrCreateAccount(uid string) (*accountModel, error) {
	tx, err := d.session.Begin()
	if err != nil {
		return nil, err
	}
	model, err := d.getOrCreateAccountTx(uid, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, err
	}
	return model, nil
}

func (d *DB) getOrCreateAccountTx(uid string, tx *dbr.Tx) (*accountModel, error) {
	if err := d.ensureAccountTx(uid, tx); err != nil {
		return nil, err
	}
	return d.lockAccountTx(uid, tx)
}

func (d *DB) ensureAccountTx(uid string, tx *dbr.Tx) error {
	_, err := tx.InsertBySql("insert into wallet_account(uid,balance,frozen_amount,version) values(?,0,0,?) on duplicate key update uid=uid", uid, time.Now().UnixNano()/1000).Exec()
	return err
}

func (d *DB) lockAccountTx(uid string, tx *dbr.Tx) (*accountModel, error) {
	var model *accountModel
	_, err := tx.SelectBySql("select * from wallet_account where uid=? for update", uid).Load(&model)
	if err == dbr.ErrNotFound {
		return nil, errors.New("钱包账户不存在")
	}
	return model, err
}

func (d *DB) lockAccountsTx(uidA string, uidB string, tx *dbr.Tx) (map[string]*accountModel, error) {
	uids := []string{uidA, uidB}
	sort.Strings(uids)
	result := make(map[string]*accountModel, 2)
	for _, uid := range uids {
		model, err := d.getOrCreateAccountTx(uid, tx)
		if err != nil {
			return nil, err
		}
		result[uid] = model
	}
	return result, nil
}

func (d *DB) updateBalanceTx(uid string, balance int64, tx *dbr.Tx) error {
	_, err := tx.Update("wallet_account").SetMap(map[string]interface{}{
		"balance":    balance,
		"version":    time.Now().UnixNano() / 1000,
		"updated_at": dbr.Expr("NOW()"),
	}).Where("uid=?", uid).Exec()
	return err
}

func (d *DB) updateAccountAmountsTx(uid string, balance int64, frozenAmount int64, tx *dbr.Tx) error {
	_, err := tx.Update("wallet_account").SetMap(map[string]interface{}{
		"balance":       balance,
		"frozen_amount": frozenAmount,
		"version":       time.Now().UnixNano() / 1000,
		"updated_at":    dbr.Expr("NOW()"),
	}).Where("uid=?", uid).Exec()
	return err
}

func (d *DB) insertTransactionTx(model *transactionModel, tx *dbr.Tx) error {
	_, err := tx.InsertInto("wallet_transaction").Columns(util.AttrToUnderscore(model)...).Record(model).Exec()
	return err
}

func (d *DB) lockWithdrawTransactionTx(tradeNo string, tx *dbr.Tx) (*transactionModel, error) {
	var model *transactionModel
	_, err := tx.SelectBySql("select * from wallet_transaction where trade_no=? and trade_type=? for update", tradeNo, tradeTypeWithdraw).Load(&model)
	if err == dbr.ErrNotFound {
		return nil, errors.New("提现订单不存在")
	}
	return model, err
}

func (d *DB) lockTransactionByTradeNoTx(tradeNo string, tx *dbr.Tx) (*transactionModel, error) {
	var model *transactionModel
	_, err := tx.SelectBySql("select * from wallet_transaction where trade_no=? for update", tradeNo).Load(&model)
	if err == dbr.ErrNotFound {
		return nil, nil
	}
	return model, err
}

func (d *DB) updateTransactionAuditTx(tradeNo string, status int, balanceAfter int64, operatorUID string, tx *dbr.Tx) error {
	_, err := tx.Update("wallet_transaction").SetMap(map[string]interface{}{
		"status":        status,
		"balance_after": balanceAfter,
		"operator_uid":  operatorUID,
		"updated_at":    dbr.Expr("NOW()"),
	}).Where("trade_no=?", tradeNo).Exec()
	return err
}

func (d *DB) queryTransactions(uid string, tradeType int, direction int, pageIndex int64, pageSize int64) ([]*transactionModel, error) {
	query := d.session.Select("*").From("wallet_transaction").Where("uid=?", uid)
	if tradeType > 0 {
		query = query.Where("trade_type=?", tradeType)
	}
	if direction > 0 {
		query = query.Where("direction=?", direction)
	}
	var models []*transactionModel
	_, err := query.OrderDesc("id").Offset(uint64((pageIndex - 1) * pageSize)).Limit(uint64(pageSize)).Load(&models)
	return models, err
}

func (d *DB) queryTransactionCount(uid string, tradeType int, direction int) (int64, error) {
	query := d.session.Select("count(*)").From("wallet_transaction").Where("uid=?", uid)
	if tradeType > 0 {
		query = query.Where("trade_type=?", tradeType)
	}
	if direction > 0 {
		query = query.Where("direction=?", direction)
	}
	var count int64
	_, err := query.Load(&count)
	return count, err
}

func (d *DB) queryWithdrawTransactions(status int, pageIndex int64, pageSize int64) ([]*transactionModel, error) {
	query := d.session.Select("*").From("wallet_transaction").Where("trade_type=?", tradeTypeWithdraw)
	if status >= 0 {
		query = query.Where("status=?", status)
	}
	var models []*transactionModel
	_, err := query.OrderDesc("id").Offset(uint64((pageIndex - 1) * pageSize)).Limit(uint64(pageSize)).Load(&models)
	return models, err
}

func (d *DB) queryWithdrawTransactionCount(status int) (int64, error) {
	query := d.session.Select("count(*)").From("wallet_transaction").Where("trade_type=?", tradeTypeWithdraw)
	if status >= 0 {
		query = query.Where("status=?", status)
	}
	var count int64
	_, err := query.Load(&count)
	return count, err
}

func (d *DB) queryExchangeRates(rateDate string, symbols []string) ([]*exchangeRateModel, error) {
	query := d.session.SelectBySql("select id, date_format(rate_date, '%Y-%m-%d') as rate_date, base_currency, quote_currency, rate, hidden, remark, operator_uid, created_at, updated_at from wallet_exchange_rate where rate_date=? and (base_currency='USD' or quote_currency='USD')", rateDate)
	if len(symbols) > 0 {
		query = d.session.SelectBySql("select id, date_format(rate_date, '%Y-%m-%d') as rate_date, base_currency, quote_currency, rate, hidden, remark, operator_uid, created_at, updated_at from wallet_exchange_rate where rate_date=? and ((base_currency='USD' and quote_currency in ?) or (quote_currency='USD' and base_currency in ?))", rateDate, symbols, symbols)
	}
	var models []*exchangeRateModel
	_, err := query.Load(&models)
	return models, err
}

func (d *DB) saveExchangeRates(rateDate string, rates map[string]exchangeRateSaveItem, remark string, operatorUID string) error {
	tx, err := d.session.Begin()
	if err != nil {
		return err
	}
	currencies := make([]string, 0, len(rates))
	for currency := range rates {
		currency = strings.ToUpper(strings.TrimSpace(currency))
		if currency != "" {
			currencies = append(currencies, currency)
		}
	}
	if len(currencies) > 0 {
		_, err = tx.DeleteFrom("wallet_exchange_rate").Where("rate_date=? and ((base_currency='USD' and quote_currency not in ?) or (quote_currency='USD' and base_currency not in ?))", rateDate, currencies, currencies).Exec()
	} else {
		_, err = tx.DeleteFrom("wallet_exchange_rate").Where("rate_date=? and (base_currency='USD' or quote_currency='USD')", rateDate).Exec()
	}
	if err != nil {
		tx.Rollback()
		return err
	}
	for currency, item := range rates {
		currency = strings.ToUpper(strings.TrimSpace(currency))
		if currency == "" || item.Rate <= 0 {
			continue
		}
		hidden := 0
		if item.Hidden {
			hidden = 1
		}
		reverseRate := item.ReverseRate
		if reverseRate <= 0 && item.Rate > 0 {
			reverseRate = 1 / item.Rate
		}
		ratePairs := []struct {
			base  string
			quote string
			rate  float64
		}{
			{base: "USD", quote: currency, rate: item.Rate},
			{base: currency, quote: "USD", rate: reverseRate},
		}
		for _, pair := range ratePairs {
			if pair.rate <= 0 {
				continue
			}
			_, err = tx.InsertBySql(
				"insert into wallet_exchange_rate(rate_date,base_currency,quote_currency,rate,hidden,remark,operator_uid) values(?,?,?,?,?,?,?) on duplicate key update rate=values(rate), hidden=values(hidden), remark=values(remark), operator_uid=values(operator_uid), updated_at=NOW()",
				rateDate,
				pair.base,
				pair.quote,
				pair.rate,
				hidden,
				remark,
				operatorUID,
			).Exec()
			if err != nil {
				tx.Rollback()
				return err
			}
		}
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return err
	}
	return nil
}

func (d *DB) recharge(uid string, amount int64, remark string, operatorUID string, tradeNo string) (*transactionModel, error) {
	tx, err := d.session.Begin()
	if err != nil {
		return nil, err
	}
	account, err := d.getOrCreateAccountTx(uid, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	account.Balance += amount
	if err := d.updateBalanceTx(uid, account.Balance, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	transaction := &transactionModel{
		TradeNo:      tradeNo,
		UID:          uid,
		TradeType:    tradeTypeRecharge,
		Direction:    directionIncome,
		Amount:       amount,
		BalanceAfter: account.Balance,
		Status:       transactionStatusSuccess,
		Remark:       remark,
		OperatorUID:  operatorUID,
	}
	if err := d.insertTransactionTx(transaction, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, err
	}
	return transaction, nil
}

func (d *DB) deduct(uid string, amount int64, remark string, operatorUID string, tradeNo string) (*transactionModel, error) {
	tx, err := d.session.Begin()
	if err != nil {
		return nil, err
	}
	account, err := d.getOrCreateAccountTx(uid, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if account.Balance < amount {
		tx.Rollback()
		return nil, errInsufficientBalance
	}
	account.Balance -= amount
	if err := d.updateBalanceTx(uid, account.Balance, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	transaction := &transactionModel{
		TradeNo:      tradeNo,
		UID:          uid,
		TradeType:    tradeTypeDeduct,
		Direction:    directionExpense,
		Amount:       amount,
		BalanceAfter: account.Balance,
		Status:       transactionStatusSuccess,
		Remark:       remark,
		OperatorUID:  operatorUID,
	}
	if err := d.insertTransactionTx(transaction, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, err
	}
	return transaction, nil
}

func (d *DB) withdraw(uid string, amount int64, remark string, tradeNo string) (*transactionModel, error) {
	tx, err := d.session.Begin()
	if err != nil {
		return nil, err
	}
	account, err := d.getOrCreateAccountTx(uid, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if account.Balance < amount {
		tx.Rollback()
		return nil, errInsufficientBalance
	}
	account.Balance -= amount
	account.FrozenAmount += amount
	if err := d.updateAccountAmountsTx(uid, account.Balance, account.FrozenAmount, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	transaction := &transactionModel{
		TradeNo:      tradeNo,
		UID:          uid,
		TradeType:    tradeTypeWithdraw,
		Direction:    directionExpense,
		Amount:       amount,
		BalanceAfter: account.Balance,
		Status:       transactionStatusPending,
		Remark:       remark,
		OperatorUID:  uid,
	}
	if err := d.insertTransactionTx(transaction, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, err
	}
	return transaction, nil
}

func (d *DB) approveWithdraw(tradeNo string, operatorUID string) (*transactionModel, error) {
	tx, err := d.session.Begin()
	if err != nil {
		return nil, err
	}
	transaction, err := d.lockWithdrawTransactionTx(tradeNo, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if transaction.Status != transactionStatusPending {
		tx.Rollback()
		return nil, errInvalidWithdrawStatus
	}
	account, err := d.getOrCreateAccountTx(transaction.UID, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if account.FrozenAmount < transaction.Amount {
		tx.Rollback()
		return nil, errInsufficientFrozenAmount
	}
	account.FrozenAmount -= transaction.Amount
	if err := d.updateAccountAmountsTx(transaction.UID, account.Balance, account.FrozenAmount, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := d.updateTransactionAuditTx(transaction.TradeNo, transactionStatusSuccess, account.Balance, operatorUID, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, err
	}
	transaction.Status = transactionStatusSuccess
	transaction.BalanceAfter = account.Balance
	transaction.OperatorUID = operatorUID
	return transaction, nil
}

func (d *DB) rejectWithdraw(tradeNo string, operatorUID string) (*transactionModel, error) {
	tx, err := d.session.Begin()
	if err != nil {
		return nil, err
	}
	transaction, err := d.lockWithdrawTransactionTx(tradeNo, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if transaction.Status != transactionStatusPending {
		tx.Rollback()
		return nil, errInvalidWithdrawStatus
	}
	account, err := d.getOrCreateAccountTx(transaction.UID, tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if account.FrozenAmount < transaction.Amount {
		tx.Rollback()
		return nil, errInsufficientFrozenAmount
	}
	account.FrozenAmount -= transaction.Amount
	account.Balance += transaction.Amount
	if err := d.updateAccountAmountsTx(transaction.UID, account.Balance, account.FrozenAmount, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := d.updateTransactionAuditTx(transaction.TradeNo, transactionStatusRejected, account.Balance, operatorUID, tx); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, err
	}
	transaction.Status = transactionStatusRejected
	transaction.BalanceAfter = account.Balance
	transaction.OperatorUID = operatorUID
	return transaction, nil
}

func (d *DB) transfer(fromUID string, toUID string, amount int64, remark string, tradeNo string) (*transactionModel, *transactionModel, error) {
	if fromUID == toUID {
		return nil, nil, errSameTransferUser
	}
	tx, err := d.session.Begin()
	if err != nil {
		return nil, nil, err
	}
	existing, err := d.lockTransactionByTradeNoTx(tradeNo, tx)
	if err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	if existing != nil {
		if existing.UID == fromUID &&
			existing.CounterpartyUID == toUID &&
			existing.TradeType == tradeTypeTransfer &&
			existing.Direction == directionExpense &&
			existing.Amount == amount &&
			existing.Status == transactionStatusSuccess {
			if err := tx.Commit(); err != nil {
				tx.Rollback()
				return nil, nil, err
			}
			return existing, nil, nil
		}
		tx.Rollback()
		return nil, nil, errDuplicateTradeNo
	}
	accounts, err := d.lockAccountsTx(fromUID, toUID, tx)
	if err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	fromAccount := accounts[fromUID]
	toAccount := accounts[toUID]
	if fromAccount.Balance < amount {
		tx.Rollback()
		return nil, nil, errInsufficientBalance
	}
	fromAccount.Balance -= amount
	toAccount.Balance += amount
	if err := d.updateBalanceTx(fromUID, fromAccount.Balance, tx); err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	if err := d.updateBalanceTx(toUID, toAccount.Balance, tx); err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	relatedTradeNo := normalizeTradeNo("wallet_transfer_in_", "")
	outTransaction := &transactionModel{
		TradeNo:         tradeNo,
		RelatedTradeNo:  relatedTradeNo,
		UID:             fromUID,
		CounterpartyUID: toUID,
		TradeType:       tradeTypeTransfer,
		Direction:       directionExpense,
		Amount:          amount,
		BalanceAfter:    fromAccount.Balance,
		Status:          transactionStatusSuccess,
		Remark:          remark,
		OperatorUID:     fromUID,
	}
	inTransaction := &transactionModel{
		TradeNo:         relatedTradeNo,
		RelatedTradeNo:  tradeNo,
		UID:             toUID,
		CounterpartyUID: fromUID,
		TradeType:       tradeTypeTransfer,
		Direction:       directionIncome,
		Amount:          amount,
		BalanceAfter:    toAccount.Balance,
		Status:          transactionStatusSuccess,
		Remark:          remark,
		OperatorUID:     fromUID,
	}
	if err := d.insertTransactionTx(outTransaction, tx); err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	if err := d.insertTransactionTx(inTransaction, tx); err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	return outTransaction, inTransaction, nil
}
