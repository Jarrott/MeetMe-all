package wallet

import (
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	defaultExchangeRateBase  = "USD"
	exchangeRateSource       = "manual"
	exchangeRateProviderName = "后台配置"
)

var (
	defaultRateSymbols = []string{"USD", "THB", "CNY", "VND"}
	currencyCodeRegexp = regexp.MustCompile(`^[A-Z]{3,10}$`)
	fallbackRates      = map[string]float64{
		"USD": 1,
		"THB": 36,
		"CNY": 7.2,
		"VND": 25000,
	}
)

type exchangeRateProvider struct {
	db *DB
}

type exchangeRatesResp struct {
	Base         string             `json:"base"`
	RateDate     string             `json:"rate_date"`
	Rates        map[string]float64 `json:"rates"`
	ReverseRates map[string]float64 `json:"reverse_rates"`
	Source       string             `json:"source"`
	Provider     string             `json:"provider"`
	Attribution  string             `json:"attribution"`
	UpdatedAt    string             `json:"updated_at"`
	NextUpdateAt string             `json:"next_update_at"`
	FetchedAt    string             `json:"fetched_at"`
	CacheSeconds int64              `json:"cache_seconds"`
	Fallback     bool               `json:"fallback"`
	Stale        bool               `json:"stale"`
}

type managerExchangeRateResp struct {
	Base        string                       `json:"base"`
	RateDate    string                       `json:"rate_date"`
	Rates       []*managerExchangeRateDetail `json:"rates"`
	UpdatedAt   string                       `json:"updated_at"`
	OperatorUID string                       `json:"operator_uid"`
	Remark      string                       `json:"remark"`
}

type managerExchangeRateDetail struct {
	Currency    string  `json:"currency"`
	Rate        float64 `json:"rate"`
	ReverseRate float64 `json:"reverse_rate"`
	Hidden      bool    `json:"hidden"`
	UpdatedAt   string  `json:"updated_at"`
}

type exchangeRateSaveItem struct {
	Rate        float64
	ReverseRate float64
	Hidden      bool
}

func newExchangeRateProvider(db *DB) *exchangeRateProvider {
	return &exchangeRateProvider{db: db}
}

func (p *exchangeRateProvider) latest(symbols []string) (*exchangeRatesResp, error) {
	return p.byDate(todayRateDate(), symbols)
}

func (p *exchangeRateProvider) byDate(rateDate string, symbols []string) (*exchangeRatesResp, error) {
	rateDate, err := normalizeRateDate(rateDate)
	if err != nil {
		return nil, err
	}
	symbols = normalizeSymbols(symbols)
	models, err := p.db.queryExchangeRates(rateDate, symbols)
	if err != nil {
		return nil, err
	}

	rates := make(map[string]float64, len(symbols))
	reverseRates := make(map[string]float64, len(symbols))
	hiddenSymbols := map[string]struct{}{}
	for _, model := range models {
		base := normalizeCurrency(model.BaseCurrency)
		quote := normalizeCurrency(model.QuoteCurrency)
		currency := quote
		if quote == defaultExchangeRateBase {
			currency = base
		}
		if currency == "" {
			continue
		}
		if model.Hidden == 1 {
			hiddenSymbols[currency] = struct{}{}
			continue
		}
		if model.Rate > 0 && base == defaultExchangeRateBase {
			rates[currency] = model.Rate
		}
		if model.Rate > 0 && quote == defaultExchangeRateBase {
			reverseRates[currency] = model.Rate
		}
	}

	fallback := false
	for _, symbol := range symbols {
		if _, hidden := hiddenSymbols[symbol]; hidden {
			continue
		}
		if symbol == defaultExchangeRateBase {
			rates[symbol] = 1
			reverseRates[symbol] = 1
			continue
		}
		if _, ok := rates[symbol]; !ok {
			if rate, hasFallback := fallbackRates[symbol]; hasFallback {
				rates[symbol] = rate
				fallback = true
			}
		}
		if _, ok := reverseRates[symbol]; !ok {
			if rate := rates[symbol]; rate > 0 {
				reverseRates[symbol] = 1 / rate
			} else if rate, hasFallback := fallbackRates[symbol]; hasFallback && rate > 0 {
				reverseRates[symbol] = 1 / rate
				fallback = true
			}
		}
	}

	return &exchangeRatesResp{
		Base:         defaultExchangeRateBase,
		RateDate:     rateDate,
		Rates:        rates,
		ReverseRates: reverseRates,
		Source:       exchangeRateSource,
		Provider:     exchangeRateProviderName,
		Attribution:  "Rates configured by admin",
		UpdatedAt:    latestExchangeRateUpdateAt(models),
		FetchedAt:    time.Now().UTC().Format(time.RFC3339),
		Fallback:     fallback,
		Stale:        false,
	}, nil
}

func (p *exchangeRateProvider) managerConfig(rateDate string) (*managerExchangeRateResp, error) {
	rateDate, err := normalizeRateDate(rateDate)
	if err != nil {
		return nil, err
	}
	models, err := p.db.queryExchangeRates(rateDate, nil)
	if err != nil {
		return nil, err
	}
	rates := make([]*managerExchangeRateDetail, 0, len(models)+len(defaultRateSymbols))
	configured := map[string]*exchangeRateModel{}
	reverseConfigured := map[string]*exchangeRateModel{}
	for _, model := range models {
		base := normalizeCurrency(model.BaseCurrency)
		quote := normalizeCurrency(model.QuoteCurrency)
		if base == defaultExchangeRateBase {
			configured[quote] = model
		}
		if quote == defaultExchangeRateBase {
			reverseConfigured[base] = model
		}
	}
	symbols := mergeRateSymbols(defaultRateSymbols, models)
	sort.Strings(symbols)
	var updatedAt string
	var operatorUID string
	var remark string
	for _, symbol := range symbols {
		if symbol == defaultExchangeRateBase {
			continue
		}
		detail := &managerExchangeRateDetail{
			Currency:    symbol,
			Rate:        fallbackRates[symbol],
			ReverseRate: fallbackReverseRate(symbol),
		}
		if model := configured[symbol]; model != nil {
			detail.Rate = model.Rate
			detail.Hidden = model.Hidden == 1
			detail.UpdatedAt = model.UpdatedAt.String()
			if updatedAt == "" || model.UpdatedAt.String() > updatedAt {
				updatedAt = model.UpdatedAt.String()
				operatorUID = model.OperatorUID
				remark = model.Remark
			}
		}
		if model := reverseConfigured[symbol]; model != nil {
			detail.ReverseRate = model.Rate
			detail.Hidden = detail.Hidden || model.Hidden == 1
			if detail.UpdatedAt == "" || model.UpdatedAt.String() > detail.UpdatedAt {
				detail.UpdatedAt = model.UpdatedAt.String()
			}
			if updatedAt == "" || model.UpdatedAt.String() > updatedAt {
				updatedAt = model.UpdatedAt.String()
				operatorUID = model.OperatorUID
				remark = model.Remark
			}
		}
		rates = append(rates, detail)
	}
	return &managerExchangeRateResp{
		Base:        defaultExchangeRateBase,
		RateDate:    rateDate,
		Rates:       rates,
		UpdatedAt:   updatedAt,
		OperatorUID: operatorUID,
		Remark:      remark,
	}, nil
}

func (p *exchangeRateProvider) saveConfig(req *exchangeRateConfigReq, operatorUID string) error {
	rateDate, err := normalizeRateDate(req.RateDate)
	if err != nil {
		return err
	}
	rates := map[string]exchangeRateSaveItem{}
	for _, item := range req.Rates {
		currency := normalizeCurrency(item.Currency)
		if currency == "" || currency == defaultExchangeRateBase {
			continue
		}
		if !isValidCurrency(currency) {
			return errors.New("币种格式必须为3-10位大写字母")
		}
		if item.Rate <= 0 {
			return errors.New("USD兑换外币汇率必须大于0")
		}
		reverseRate := item.ReverseRate
		if reverseRate <= 0 {
			reverseRate = 1 / item.Rate
		}
		rates[currency] = exchangeRateSaveItem{
			Rate:        item.Rate,
			ReverseRate: reverseRate,
			Hidden:      item.Hidden,
		}
	}
	if len(rates) == 0 {
		return errors.New("请至少配置一个币种汇率")
	}
	return p.db.saveExchangeRates(rateDate, rates, normalizeRemark(req.Remark), operatorUID)
}

func latestExchangeRateUpdateAt(models []*exchangeRateModel) string {
	var updatedAt string
	for _, model := range models {
		if value := model.UpdatedAt.String(); value > updatedAt {
			updatedAt = value
		}
	}
	return updatedAt
}

func todayRateDate() string {
	return time.Now().Format("2006-01-02")
}

func normalizeRateDate(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return todayRateDate(), nil
	}
	parsed, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return "", errors.New("汇率日期格式必须为YYYY-MM-DD")
	}
	return parsed.Format("2006-01-02"), nil
}

func normalizeRateSymbols(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return append([]string(nil), defaultRateSymbols...)
	}
	symbols := make([]string, 0, len(defaultRateSymbols))
	for _, item := range strings.Split(raw, ",") {
		currency := normalizeCurrency(item)
		if currency == "" {
			continue
		}
		if !isValidCurrency(currency) {
			continue
		}
		symbols = append(symbols, currency)
	}
	return normalizeSymbols(symbols)
}

func normalizeSymbols(symbols []string) []string {
	seen := map[string]struct{}{}
	normalized := make([]string, 0, len(symbols)+1)
	for _, item := range symbols {
		currency := normalizeCurrency(item)
		if currency == "" {
			continue
		}
		if !isValidCurrency(currency) {
			continue
		}
		if _, ok := seen[currency]; ok {
			continue
		}
		seen[currency] = struct{}{}
		normalized = append(normalized, currency)
	}
	if _, ok := seen[defaultExchangeRateBase]; !ok {
		normalized = append([]string{defaultExchangeRateBase}, normalized...)
	}
	if len(normalized) == 0 {
		return append([]string(nil), defaultRateSymbols...)
	}
	return normalized
}

func normalizeCurrency(raw string) string {
	return strings.ToUpper(strings.TrimSpace(raw))
}

func isValidCurrency(currency string) bool {
	return currency != "" && currencyCodeRegexp.MatchString(currency)
}

func fallbackReverseRate(currency string) float64 {
	rate := fallbackRates[currency]
	if rate <= 0 {
		return 0
	}
	return 1 / rate
}

func mergeRateSymbols(defaults []string, models []*exchangeRateModel) []string {
	seen := map[string]struct{}{}
	symbols := make([]string, 0, len(defaults)+len(models))
	for _, item := range defaults {
		currency := normalizeCurrency(item)
		if !isValidCurrency(currency) {
			continue
		}
		if _, ok := seen[currency]; ok {
			continue
		}
		seen[currency] = struct{}{}
		symbols = append(symbols, currency)
	}
	for _, model := range models {
		currency := normalizeCurrency(model.QuoteCurrency)
		if normalizeCurrency(model.QuoteCurrency) == defaultExchangeRateBase {
			currency = normalizeCurrency(model.BaseCurrency)
		}
		if currency == defaultExchangeRateBase || !isValidCurrency(currency) {
			continue
		}
		if _, ok := seen[currency]; ok {
			continue
		}
		seen[currency] = struct{}{}
		symbols = append(symbols, currency)
	}
	return symbols
}
