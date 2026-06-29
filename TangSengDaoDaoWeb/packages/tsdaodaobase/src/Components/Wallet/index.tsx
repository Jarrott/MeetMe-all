import { Button, Toast } from "@douyinfe/semi-ui";
import React, { Component } from "react";
import QRCode from "qrcode.react";
import WKApp from "../../App";
import "./index.css";

type WithdrawCurrencyCode = "USD" | "THB" | "CNY" | "VND"

const WITHDRAW_CURRENCIES: Array<{
    code: WithdrawCurrencyCode
    label: string
    step: string
}> = [
        { code: "USD", label: "USD 美元", step: "0.01" },
        { code: "THB", label: "THB 泰铢", step: "0.01" },
        { code: "CNY", label: "CNY 人民币", step: "0.01" },
        { code: "VND", label: "VND 越南盾", step: "1" },
    ]

const DEFAULT_EXCHANGE_RATES: Record<WithdrawCurrencyCode, number> = {
    USD: 1,
    THB: 36,
    CNY: 7.2,
    VND: 25000,
}

const DEFAULT_REVERSE_EXCHANGE_RATES: Record<WithdrawCurrencyCode, number> = {
    USD: 1,
    THB: 1 / 36,
    CNY: 1 / 7.2,
    VND: 1 / 25000,
}

interface WalletBalance {
    uid?: string
    balance: number
    frozen_amount: number
    available_amount: number
}

interface WalletTransaction {
    trade_no: string
    trade_type: string | number
    direction: string | number
    amount: number
    balance_after: number
    counterparty_uid?: string
    remark?: string
    created_at?: string
}

interface WalletReceiveQRCode {
    code: string
    qrcode: string
    amount: number
    remark?: string
    expire?: string
}

interface WalletState {
    loading: boolean
    actionLoading: boolean
    balance: WalletBalance
    transactions: WalletTransaction[]
    transferUID: string
    transferAmount: string
    transferRemark: string
    receiveAmount: string
    receiveRemark: string
    receiveQRCode?: WalletReceiveQRCode
    withdrawAmount: string
    withdrawRemark: string
    withdrawCurrency: WithdrawCurrencyCode
    withdrawDirection: "currency_to_usd" | "usd_to_currency"
    exchangeRates: Record<WithdrawCurrencyCode, number>
    reverseExchangeRates: Record<WithdrawCurrencyCode, number>
    exchangeRateLoading: boolean
    exchangeRateUpdatedAt: string
    exchangeRateProvider: string
    exchangeRateFallback: boolean
    exchangeRateStale: boolean
    exchangeRateAttribution: string
}

export default class Wallet extends Component<any, WalletState> {
    constructor(props: any) {
        super(props)
        this.state = {
            loading: false,
            actionLoading: false,
            balance: {
                balance: 0,
                frozen_amount: 0,
                available_amount: 0,
            },
            transactions: [],
            transferUID: "",
            transferAmount: "",
            transferRemark: "",
            receiveAmount: "",
            receiveRemark: "",
            receiveQRCode: undefined,
            withdrawAmount: "",
            withdrawRemark: "",
            withdrawCurrency: "USD",
            withdrawDirection: "currency_to_usd",
            exchangeRates: DEFAULT_EXCHANGE_RATES,
            reverseExchangeRates: DEFAULT_REVERSE_EXCHANGE_RATES,
            exchangeRateLoading: false,
            exchangeRateUpdatedAt: "",
            exchangeRateProvider: "",
            exchangeRateFallback: true,
            exchangeRateStale: false,
            exchangeRateAttribution: "Rates By Exchange Rate API",
        }
    }

    componentDidMount() {
        this.refreshWallet()
        this.refreshExchangeRates()
    }

    async refreshWallet() {
        this.setState({ loading: true })
        try {
            const [balance, transactions] = await Promise.all([
                WKApp.apiClient.get("wallet/balance"),
                WKApp.apiClient.get("wallet/transactions", {
                    param: {
                        page_index: 1,
                        page_size: 30,
                    }
                })
            ])
            this.setState({
                balance: {
                    balance: balance?.balance || 0,
                    frozen_amount: balance?.frozen_amount || 0,
                    available_amount: balance?.available_amount || 0,
                    uid: balance?.uid,
                },
                transactions: transactions?.list || [],
            })
        } catch (err: any) {
            Toast.error(err?.msg || "钱包加载失败")
        } finally {
            this.setState({ loading: false })
        }
    }

    async refreshExchangeRates() {
        this.setState({ exchangeRateLoading: true })
        try {
            const resp = await WKApp.apiClient.get("wallet/exchange-rates", {
                param: {
                    symbols: "USD,THB,CNY,VND",
                }
            })
            const nextRates = { ...DEFAULT_EXCHANGE_RATES }
            const nextReverseRates = { ...DEFAULT_REVERSE_EXCHANGE_RATES }
            WITHDRAW_CURRENCIES.forEach((currency) => {
                const rate = Number(resp?.rates?.[currency.code])
                if (Number.isFinite(rate) && rate > 0) {
                    nextRates[currency.code] = rate
                }
                const reverseRate = Number(resp?.reverse_rates?.[currency.code])
                if (Number.isFinite(reverseRate) && reverseRate > 0) {
                    nextReverseRates[currency.code] = reverseRate
                } else if (Number.isFinite(nextRates[currency.code]) && nextRates[currency.code] > 0) {
                    nextReverseRates[currency.code] = 1 / nextRates[currency.code]
                }
            })
            this.setState({
                exchangeRates: nextRates,
                reverseExchangeRates: nextReverseRates,
                exchangeRateUpdatedAt: resp?.updated_at || resp?.fetched_at || "",
                exchangeRateProvider: resp?.provider || resp?.source || "",
                exchangeRateFallback: !!resp?.fallback,
                exchangeRateStale: !!resp?.stale,
                exchangeRateAttribution: resp?.attribution || "Rates By Exchange Rate API",
            })
            if (resp?.fallback || resp?.stale) {
                Toast.warning(resp?.stale ? "实时汇率暂时不可用，已使用最近缓存汇率" : "实时汇率暂时不可用，已使用备用汇率")
            }
        } catch (err: any) {
            Toast.warning("实时汇率加载失败，已使用备用汇率")
        } finally {
            this.setState({ exchangeRateLoading: false })
        }
    }

    formatAmount(amount?: number) {
        return ((amount || 0) / 100).toFixed(2)
    }

    amountToFen(value: string) {
        const amount = this.parseAmount(value)
        if (!Number.isFinite(amount) || amount <= 0) {
            return 0
        }
        return Math.round(amount * 100)
    }

    parseAmount(value: string) {
        return Number(String(value || "").replace(/,/g, ""))
    }

    getWithdrawCurrency() {
        return WITHDRAW_CURRENCIES.find((item) => item.code === this.state.withdrawCurrency) || WITHDRAW_CURRENCIES[0]
    }

    getWithdrawRate() {
        const currency = this.getWithdrawCurrency()
        return this.state.exchangeRates[currency.code] || DEFAULT_EXCHANGE_RATES[currency.code] || 1
    }

    getWithdrawReverseRate() {
        const currency = this.getWithdrawCurrency()
        return this.state.reverseExchangeRates[currency.code] || DEFAULT_REVERSE_EXCHANGE_RATES[currency.code] || 1
    }

    getWithdrawUSDAmount() {
        const inputAmount = this.parseAmount(this.state.withdrawAmount)
        if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
            return 0
        }
        if (this.state.withdrawDirection === "usd_to_currency") {
            return inputAmount
        }
        return inputAmount * this.getWithdrawReverseRate()
    }

    getWithdrawLocalAmount() {
        const inputAmount = this.parseAmount(this.state.withdrawAmount)
        if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
            return 0
        }
        if (this.state.withdrawDirection === "usd_to_currency") {
            return inputAmount * this.getWithdrawRate()
        }
        return inputAmount
    }

    getWithdrawOutputAmount() {
        if (this.state.withdrawDirection === "usd_to_currency") {
            return this.getWithdrawLocalAmount()
        }
        return this.getWithdrawUSDAmount()
    }

    getWithdrawAmountFen() {
        const usdAmount = this.getWithdrawUSDAmount()
        if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
            return 0
        }
        return Math.round(usdAmount * 100)
    }

    buildWithdrawRemark() {
        const currency = this.getWithdrawCurrency()
        const rate = this.getWithdrawRate()
        const reverseRate = this.getWithdrawReverseRate()
        const localAmount = this.getWithdrawLocalAmount()
        const usdAmount = this.getWithdrawAmountFen() / 100
        const userRemark = this.state.withdrawRemark.trim()
        const exchangeText = `提现币种 ${currency.code} ${localAmount.toFixed(currency.code === "VND" ? 0 : 2)}，折合 ${usdAmount.toFixed(2)} USD，汇率 1 ${currency.code} = ${this.formatRate(reverseRate)} USD；参考 1 USD = ${this.formatRate(rate)} ${currency.code}`
        return userRemark ? `${userRemark} | ${exchangeText}` : exchangeText
    }

    formatRate(rate: number) {
        return Number(rate || 0).toFixed(8).replace(/\.?0+$/, "")
    }

    currencySymbol(code: WithdrawCurrencyCode) {
        const map: Record<WithdrawCurrencyCode, string> = {
            USD: "$",
            THB: "฿",
            CNY: "¥",
            VND: "₫",
        }
        return map[code] || code
    }

    formatCurrencyAmount(amount: number, code: WithdrawCurrencyCode) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return "0.00"
        }
        if (code === "VND") {
            return Math.round(amount).toLocaleString()
        }
        return amount.toFixed(2)
    }

    formatInputAmount(amount: number, code: WithdrawCurrencyCode) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return ""
        }
        if (code === "VND") {
            return String(Math.round(amount))
        }
        return amount.toFixed(2)
    }

    switchWithdrawDirection() {
        const outputAmount = this.getWithdrawOutputAmount()
        const nextDirection = this.state.withdrawDirection === "currency_to_usd" ? "usd_to_currency" : "currency_to_usd"
        const nextInputCode = nextDirection === "usd_to_currency" ? "USD" : this.state.withdrawCurrency
        this.setState({
            withdrawDirection: nextDirection,
            withdrawAmount: this.formatInputAmount(outputAmount, nextInputCode),
        })
    }

    tradeTypeText(value: string | number) {
        const map: Record<string, string> = {
            "1": "充值",
            "2": "提现",
            "3": "转账",
            "4": "扣款",
            recharge: "充值",
            withdraw: "提现",
            transfer_in: "转入",
            transfer_out: "转出",
            transfer: "转账",
        }
        return map[String(value)] || String(value || "-")
    }

    directionText(value: string | number) {
        const map: Record<string, string> = {
            "1": "收入",
            "2": "支出",
            in: "收入",
            out: "支出",
        }
        return map[String(value)] || String(value || "-")
    }

    async submitTransfer() {
        const amount = this.amountToFen(this.state.transferAmount)
        if (!this.state.transferUID.trim()) {
            Toast.warning("请输入对方用户 ID")
            return
        }
        if (amount <= 0) {
            Toast.warning("请输入正确的转账金额")
            return
        }
        this.setState({ actionLoading: true })
        try {
            await WKApp.apiClient.post("wallet/transfer", {
                to_uid: this.state.transferUID.trim(),
                amount,
                remark: this.state.transferRemark.trim(),
            })
            Toast.success("转账成功")
            this.setState({
                transferAmount: "",
                transferRemark: "",
            })
            await this.refreshWallet()
        } catch (err: any) {
            Toast.error(err?.msg || "转账失败")
        } finally {
            this.setState({ actionLoading: false })
        }
    }

    async generateReceiveQRCode() {
        const amount = this.state.receiveAmount.trim() ? this.amountToFen(this.state.receiveAmount) : 0
        if (this.state.receiveAmount.trim() && amount <= 0) {
            Toast.warning("请输入正确的收款金额")
            return
        }
        this.setState({ actionLoading: true })
        try {
            const resp = await WKApp.apiClient.post("wallet/receive-qrcode", {
                amount,
                remark: this.state.receiveRemark.trim(),
            })
            this.setState({
                receiveQRCode: resp,
            })
            Toast.success("收款码已生成")
        } catch (err: any) {
            Toast.error(err?.msg || "生成收款码失败")
        } finally {
            this.setState({ actionLoading: false })
        }
    }

    async submitWithdraw() {
        const amount = this.getWithdrawAmountFen()
        if (amount <= 0) {
            Toast.warning("请输入正确的提现金额")
            return
        }
        this.setState({ actionLoading: true })
        try {
            await WKApp.apiClient.post("wallet/withdraw", {
                amount,
                remark: this.buildWithdrawRemark(),
            })
            Toast.success("提现申请已提交")
            this.setState({
                withdrawAmount: "",
                withdrawRemark: "",
            })
            await this.refreshWallet()
        } catch (err: any) {
            Toast.error(err?.msg || "提现失败")
        } finally {
            this.setState({ actionLoading: false })
        }
    }

    renderTransactions() {
        const { transactions, loading } = this.state
        if (loading) {
            return <div className="wk-wallet-empty">加载中...</div>
        }
        if (!transactions || transactions.length === 0) {
            return <div className="wk-wallet-empty">暂无流水</div>
        }
        return transactions.map((item) => {
            const isIn = item.direction === "in" || item.direction === 1 || item.direction === "1"
            return <div className="wk-wallet-transaction" key={item.trade_no}>
                <div className="wk-wallet-transaction-main">
                    <div className="wk-wallet-transaction-title">
                        {this.tradeTypeText(item.trade_type)}
                        <em>{this.directionText(item.direction)}</em>
                        {
                            item.counterparty_uid ? <span>{item.counterparty_uid}</span> : undefined
                        }
                    </div>
                    <div className="wk-wallet-transaction-subtitle">
                        {item.remark || item.trade_no}
                    </div>
                    <div className="wk-wallet-transaction-time">
                        {item.created_at || ""}
                    </div>
                </div>
                <div className={isIn ? "wk-wallet-transaction-amount in" : "wk-wallet-transaction-amount out"}>
                    {isIn ? "+" : "-"}{this.formatAmount(item.amount)} USD
                    <span>余额 {this.formatAmount(item.balance_after)} USD</span>
                </div>
            </div>
        })
    }

    render() {
        const { balance, actionLoading } = this.state
        const withdrawCurrency = this.getWithdrawCurrency()
        const withdrawUSDAmount = this.getWithdrawUSDAmount()
        const withdrawOutputAmount = this.getWithdrawOutputAmount()
        const withdrawRate = this.getWithdrawRate()
        const withdrawReverseRate = this.getWithdrawReverseRate()
        const rateBadge = this.state.exchangeRateLoading ? "汇率加载中" : (this.state.exchangeRateFallback ? "备用汇率" : (this.state.exchangeRateStale ? "缓存汇率" : "实时汇率"))
        const isCurrencyToUSD = this.state.withdrawDirection === "currency_to_usd"
        const fromCurrency = isCurrencyToUSD ? withdrawCurrency.code : "USD"
        const toCurrency = isCurrencyToUSD ? "USD" : withdrawCurrency.code
        return <div className="wk-wallet">
            <div className="wk-wallet-balance">
                <div>
                    <div className="wk-wallet-balance-label">余额</div>
                    <div className="wk-wallet-balance-value">{this.formatAmount(balance.balance)} USD</div>
                </div>
                <Button theme="borderless" onClick={() => this.refreshWallet()}>刷新</Button>
            </div>

            <div className="wk-wallet-action-grid">
            <div className="wk-wallet-panel">
                <div className="wk-wallet-panel-title">转账</div>
                <input
                    className="wk-wallet-input"
                    value={this.state.transferUID}
                    placeholder="对方用户 ID"
                    onChange={(e) => this.setState({ transferUID: e.target.value })}
                />
                <input
                    className="wk-wallet-input"
                    value={this.state.transferAmount}
                    placeholder="金额（USD）"
                    type="number"
                    min="0"
                    step="0.01"
                    onChange={(e) => this.setState({ transferAmount: e.target.value })}
                />
                <input
                    className="wk-wallet-input"
                    value={this.state.transferRemark}
                    placeholder="备注"
                    onChange={(e) => this.setState({ transferRemark: e.target.value })}
                />
                <Button block theme="solid" type="primary" loading={actionLoading} onClick={() => this.submitTransfer()}>确认转账</Button>
            </div>

            <div className="wk-wallet-panel wk-wallet-receive-panel">
                <div className="wk-wallet-panel-title">收款码</div>
                <input
                    className="wk-wallet-input"
                    value={this.state.receiveAmount}
                    placeholder="固定金额（USD，可不填）"
                    type="number"
                    min="0"
                    step="0.01"
                    onChange={(e) => this.setState({ receiveAmount: e.target.value })}
                />
                <input
                    className="wk-wallet-input"
                    value={this.state.receiveRemark}
                    placeholder="收款备注"
                    onChange={(e) => this.setState({ receiveRemark: e.target.value })}
                />
                <Button block theme="solid" type="primary" loading={actionLoading} onClick={() => this.generateReceiveQRCode()}>生成收款码</Button>
                {
                    this.state.receiveQRCode ? <div className="wk-wallet-receive-qrcode">
                        <QRCode value={this.state.receiveQRCode.qrcode} size={168} fgColor="#111827"></QRCode>
                        <div className="wk-wallet-receive-qrcode-meta">
                            <strong>{this.state.receiveQRCode.amount > 0 ? `${this.formatAmount(this.state.receiveQRCode.amount)} USD` : "扫码方输入金额"}</strong>
                            <span>{this.state.receiveQRCode.remark || "无备注"}</span>
                            <em>{this.state.receiveQRCode.expire ? `有效期至 ${this.state.receiveQRCode.expire}` : ""}</em>
                        </div>
                    </div> : undefined
                }
            </div>

            <div className="wk-wallet-panel wk-wallet-exchange-panel">
                <div className="wk-wallet-panel-title">提现换汇</div>
                <div className="wk-wallet-converter">
                    <div className="wk-wallet-converter-field">
                        <div className="wk-wallet-converter-label">从</div>
                        <div className="wk-wallet-converter-control">
                            <div className="wk-wallet-converter-main">
                                <span className="wk-wallet-currency-symbol">{this.currencySymbol(fromCurrency as WithdrawCurrencyCode)}</span>
                                <input
                                    className="wk-wallet-converter-input"
                                    value={this.state.withdrawAmount}
                                    placeholder="0.00"
                                    type="number"
                                    min="0"
                                    step={isCurrencyToUSD ? withdrawCurrency.step : "0.01"}
                                    onChange={(e) => this.setState({ withdrawAmount: e.target.value })}
                                />
                            </div>
                            {
                                isCurrencyToUSD ? <select
                                    className="wk-wallet-converter-select"
                                    value={this.state.withdrawCurrency}
                                    onChange={(e) => this.setState({ withdrawCurrency: e.target.value as WithdrawCurrencyCode })}
                                >
                                    {
                                        WITHDRAW_CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)
                                    }
                                </select> : <div className="wk-wallet-converter-code">USD 美元</div>
                            }
                        </div>
                    </div>

                    <button className="wk-wallet-swap-button" type="button" onClick={() => this.switchWithdrawDirection()}>
                        ⇄
                    </button>

                    <div className="wk-wallet-converter-field">
                        <div className="wk-wallet-converter-label">到</div>
                        <div className="wk-wallet-converter-control">
                            <div className="wk-wallet-converter-main">
                                <span className="wk-wallet-currency-symbol">{this.currencySymbol(toCurrency as WithdrawCurrencyCode)}</span>
                                <div className="wk-wallet-converter-result">
                                    {this.formatCurrencyAmount(withdrawOutputAmount, toCurrency as WithdrawCurrencyCode)}
                                </div>
                            </div>
                            {
                                isCurrencyToUSD ? <div className="wk-wallet-converter-code">USD 美元</div> : <select
                                    className="wk-wallet-converter-select"
                                    value={this.state.withdrawCurrency}
                                    onChange={(e) => this.setState({ withdrawCurrency: e.target.value as WithdrawCurrencyCode })}
                                >
                                    {
                                        WITHDRAW_CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)
                                    }
                                </select>
                            }
                        </div>
                    </div>
                </div>
                <div className="wk-wallet-convert-summary">
                    <strong>{this.formatCurrencyAmount(isCurrencyToUSD ? this.parseAmount(this.state.withdrawAmount) : withdrawUSDAmount, fromCurrency as WithdrawCurrencyCode)} {fromCurrency}</strong>
                    <span>=</span>
                    <strong>{this.formatCurrencyAmount(withdrawOutputAmount, toCurrency as WithdrawCurrencyCode)} {toCurrency}</strong>
                </div>
                <div className="wk-wallet-convert-preview">
                    <span>{rateBadge} · 1 {withdrawCurrency.code} = {this.formatRate(withdrawReverseRate)} USD</span>
                    <em>参考 · 1 USD = {this.formatRate(withdrawRate)} {withdrawCurrency.code}</em>
                </div>
                <div className="wk-wallet-rate-source">
                    <span>{this.state.exchangeRateUpdatedAt ? `更新时间 ${this.state.exchangeRateUpdatedAt}` : "汇率更新时间待同步"}</span>
                    <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">{this.state.exchangeRateAttribution}</a>
                </div>
                <input
                    className="wk-wallet-input"
                    value={this.state.withdrawRemark}
                    placeholder="提现备注"
                    onChange={(e) => this.setState({ withdrawRemark: e.target.value })}
                />
                <Button block theme="solid" type="tertiary" loading={actionLoading} onClick={() => this.submitWithdraw()}>提交提现</Button>
            </div>
            </div>

            <div className="wk-wallet-recharge-tip">
                充值由后台钱包管理处理
            </div>

            <div className="wk-wallet-history">
                <div className="wk-wallet-history-title">钱包流水</div>
                {this.renderTransactions()}
            </div>
        </div>
    }
}
