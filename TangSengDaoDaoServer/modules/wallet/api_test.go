package wallet

import (
	"os"
	"strings"
	"testing"
)

func TestWalletRoutes(t *testing.T) {
	source := mustReadWalletTestFile(t, "api.go")
	assertContainsAll(t, source, []string{
		`rates.GET("/exchange-rates", w.exchangeRates)`,
		`wallet.GET("/balance", w.balance)`,
		`wallet.GET("/transactions", w.transactions)`,
		`wallet.GET("/receive-qrcode", w.receiveQRCode)`,
		`wallet.POST("/receive-qrcode", w.receiveQRCode)`,
		`wallet.GET("/scan-receive/:code", w.scanReceiveQRCode)`,
		`wallet.POST("/withdraw", w.withdraw)`,
		`wallet.POST("/transfer", w.transfer)`,
		`wallet.POST("/scan-pay", w.scanPay)`,
		`manager.GET("/exchange-rates", w.managerExchangeRates)`,
		`manager.POST("/exchange-rates", w.managerSaveExchangeRates)`,
		`manager.GET("/withdraws", w.managerWithdraws)`,
		`manager.POST("/withdraws/:trade_no/approve", w.managerWithdrawApprove)`,
		`manager.POST("/withdraws/:trade_no/reject", w.managerWithdrawReject)`,
		`manager.POST("/:uid/recharge", w.managerRecharge)`,
		`manager.POST("/:uid/deduct", w.managerDeduct)`,
	})
}

func TestWalletStorage(t *testing.T) {
	migration := mustReadWalletTestFile(t, "sql/wallet-20260620-01.sql")
	assertContainsAll(t, migration, []string{
		"`wallet_account`",
		"`wallet_transaction`",
		"balance",
		"trade_no",
		"balance_after",
		"frozen_amount",
		"wallet_transaction_trade_no_uidx",
	})
	exchangeRateMigration := mustReadWalletTestFile(t, "sql/wallet-20260621-01.sql")
	assertContainsAll(t, exchangeRateMigration, []string{
		"`wallet_exchange_rate`",
		"`rate_date`",
		"`base_currency`",
		"`quote_currency`",
		"rate           decimal",
		"wallet_exchange_rate_date_currency_uidx",
	})
	hiddenMigration := mustReadWalletTestFile(t, "sql/wallet-20260621-02.sql")
	assertContainsAll(t, hiddenMigration, []string{
		"ALTER TABLE `wallet_exchange_rate` ADD COLUMN `hidden`",
	})
}

func TestExchangeRateDirectionalFields(t *testing.T) {
	source := mustReadWalletTestFile(t, "exchange_rate.go")
	assertContainsAll(t, source, []string{
		`ReverseRates map[string]float64`,
		`ReverseRate float64`,
		`reverse_rates`,
		`reverse_rate`,
	})
}

func TestWalletAmountAndTradeHelpers(t *testing.T) {
	if validAmount(0) || validAmount(-1) {
		t.Fatal("zero and negative amount should be invalid")
	}
	if !validAmount(1) {
		t.Fatal("positive amount should be valid")
	}
	if got := normalizeTradeNo("wallet_test_", " custom "); got != "custom" {
		t.Fatalf("expected custom trade no, got %s", got)
	}
	if got := normalizeTradeNo("wallet_test_", ""); !strings.HasPrefix(got, "wallet_test_") {
		t.Fatalf("expected generated trade no prefix, got %s", got)
	}
	if n, ok := toInt64(float64(123)); !ok || n != 123 {
		t.Fatalf("expected numeric qrcode amount to convert, got %d %v", n, ok)
	}
}

func TestNormalizeRateSymbols(t *testing.T) {
	symbols := normalizeRateSymbols("thb,cny,vnd,eur,THB,12")
	want := []string{"USD", "THB", "CNY", "VND", "EUR"}
	if len(symbols) != len(want) {
		t.Fatalf("expected %v, got %v", want, symbols)
	}
	for i := range want {
		if symbols[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, symbols)
		}
	}
}

func mustReadWalletTestFile(t *testing.T, path string) string {
	t.Helper()

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(content)
}

func assertContainsAll(t *testing.T, content string, wants []string) {
	t.Helper()

	for _, want := range wants {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q", want)
		}
	}
}

func TestMergeRateSymbolsIncludesConfiguredCurrencies(t *testing.T) {
	symbols := mergeRateSymbols(defaultRateSymbols, []*exchangeRateModel{
		{QuoteCurrency: "EUR"},
		{QuoteCurrency: "jpy"},
		{QuoteCurrency: "USD"},
		{BaseCurrency: "THB", QuoteCurrency: "USD"},
	})
	want := []string{"USD", "THB", "CNY", "VND", "EUR", "JPY"}
	if len(symbols) != len(want) {
		t.Fatalf("expected %v, got %v", want, symbols)
	}
	for i := range want {
		if symbols[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, symbols)
		}
	}
}

func TestFallbackReverseRate(t *testing.T) {
	got := fallbackReverseRate("THB")
	if got <= 0 {
		t.Fatalf("expected positive THB reverse rate")
	}
	if got == fallbackRates["THB"] {
		t.Fatalf("reverse rate should not equal forward rate")
	}
}
