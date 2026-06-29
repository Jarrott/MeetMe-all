import WKSDK from "wukongimjssdk";
import { ChannelInfoListener } from "wukongimjssdk";
import { Channel, ChannelInfo, ChannelTypeGroup, ChannelTypePerson } from "wukongimjssdk";
import React, { Component } from "react";
import { ConversationWrap, MessageWrap } from "../../Service/Model";
import { getTimeStringAutoShort2 } from '../../Utils/time'
import classNames from "classnames";

import "./index.css"
import { Badge, Button, Input, Modal, Toast } from "@douyinfe/semi-ui";
import WKApp from "../../App";
import { EndpointID, MessageContentTypeConst } from "../../Service/Const";
import ContextMenus, { ContextMenusContext } from "../ContextMenus";
import { ChannelSettingManager } from "../../Service/ChannelSetting";
import { TypingListener, TypingManager } from "../../Service/TypingManager";
import { BeatLoader } from "react-spinners";
import { RevokeCell } from "../../Messages/Revoke";
import { FlameMessageCell } from "../../Messages/Flame";
import WKAvatar from "../WKAvatar";
import { ConversationTeam, ConversationTeamItem, ConversationTeamService } from "../../Service/ConversationTeam";
export interface ConversationListProps {
    conversations: ConversationWrap[]
    select?: Channel
    onClick?: (conversation: ConversationWrap) => void
    onClearMessages?: (channel: Channel) => void
}

export interface ConversationListState {
    selectConversationWrap?: ConversationWrap
    teams: ConversationTeam[]
    items: ConversationTeamItem[]
    collapsedTeams: { [key: string]: boolean }
    moveDialogVisible: boolean
    manageDialogVisible: boolean
    newTeamName: string
    editingTeamID?: number
    editingTeamName: string
}

export default class ConversationList extends Component<ConversationListProps, ConversationListState>{
    channelListener!: ChannelInfoListener
    contextMenusContext!: ContextMenusContext
    typingListener!: TypingListener
    topOrderSeed = 0
    topOrderMap: { [key: string]: number } = {}
    constructor(props: ConversationListProps) {
        super(props)

        this.state = {
            teams: [],
            items: [],
            collapsedTeams: {},
            moveDialogVisible: false,
            manageDialogVisible: false,
            newTeamName: "",
            editingTeamName: "",
        }
    }

    componentDidMount() {
        this.loadTopOrderMap()
        this.loadCollapsedTeams()
        this.loadTeams()
        this.channelListener = (channelInfo: ChannelInfo) => {
            this.setState({})
        }
        WKSDK.shared().channelManager.addListener(this.channelListener)

        this.typingListener = (channel: Channel, add: boolean) => {
            this.setState({})
        }
        TypingManager.shared.addTypingListener(this.typingListener)

    }

    loadCollapsedTeams() {
        try {
            const uid = WKApp.loginInfo?.uid || "default"
            const raw = localStorage.getItem(`meetme_conversation_team_collapsed_${uid}`)
            this.setState({
                collapsedTeams: raw ? JSON.parse(raw) : {},
            })
        } catch (e) {
            this.setState({ collapsedTeams: {} })
        }
    }

    saveCollapsedTeams(collapsedTeams: { [key: string]: boolean }) {
        try {
            const uid = WKApp.loginInfo?.uid || "default"
            localStorage.setItem(`meetme_conversation_team_collapsed_${uid}`, JSON.stringify(collapsedTeams))
        } catch (e) { }
    }

    toggleTeam(teamID: number) {
        const key = `${teamID}`
        const collapsedTeams = {
            ...this.state.collapsedTeams,
            [key]: !this.state.collapsedTeams[key],
        }
        this.setState({ collapsedTeams })
        this.saveCollapsedTeams(collapsedTeams)
    }

    componentWillUnmount() {
        WKSDK.shared().channelManager.removeListener(this.channelListener)
        TypingManager.shared.removeTypingListener(this.typingListener)
    }

    loadTopOrderMap() {
        try {
            const uid = WKApp.loginInfo?.uid || "default"
            const raw = localStorage.getItem(`meetme_conversation_top_order_${uid}`)
            this.topOrderMap = raw ? JSON.parse(raw) : {}
            this.topOrderSeed = Object.values(this.topOrderMap).reduce((max, value) => Math.max(max, Number(value) || 0), 0)
        } catch (e) {
            this.topOrderMap = {}
            this.topOrderSeed = 0
        }
    }

    saveTopOrderMap() {
        try {
            const uid = WKApp.loginInfo?.uid || "default"
            localStorage.setItem(`meetme_conversation_top_order_${uid}`, JSON.stringify(this.topOrderMap))
        } catch (e) { }
    }

    topOrderKey(teamID: number, conversationWrap: ConversationWrap) {
        return `${teamID}:${conversationWrap.channel.getChannelKey()}`
    }

    stableTopOrder(teamID: number, conversationWrap: ConversationWrap) {
        const key = this.topOrderKey(teamID, conversationWrap)
        if (!this.topOrderMap[key]) {
            this.topOrderSeed += 1
            this.topOrderMap[key] = this.topOrderSeed
            this.saveTopOrderMap()
        }
        return this.topOrderMap[key]
    }

    async loadTeams() {
        if (!this.conversationTeamEnabled()) {
            this.setState({ teams: [], items: [] })
            return
        }
        try {
            const state = await ConversationTeamService.shared.sync()
            this.setState({
                teams: state.teams || [],
                items: state.items || [],
            })
        } catch (err: any) {
            console.warn("load conversation teams failed", err)
        }
    }

    _handleScroll() {
        this.contextMenusContext.hide()
    }
    _handleContextMenu(conversationWrap: ConversationWrap, event: React.MouseEvent) {
        this.contextMenusContext.show(event)
        this.setState({
            selectConversationWrap: conversationWrap
        })
    }

    _getTypingUI(conversationWrap: ConversationWrap) {
        const { select } = this.props
        const typing = TypingManager.shared.getTyping(conversationWrap.channel)
        const selected = select && select.isEqual(conversationWrap.channel)
        return <div className="wk-typing"><BeatLoader size={4} margin={3} color={selected ? "white" : "var(--wk-color-theme)"} />&nbsp;&nbsp;{conversationWrap.channel.channelType !== ChannelTypePerson ? typing?.fromName : ""}正在输入</div>
    }

    lastContent(conversationWrap: ConversationWrap) {
        if (!conversationWrap.lastMessage) {
            return
        }
        const draft = conversationWrap.remoteExtra.draft
        if(draft && draft!=="") {
            return draft
        }
        const lastMessage = new MessageWrap(conversationWrap.lastMessage)
        if (lastMessage.isDeleted) {
            return "[消息已删除]"
        }
        if (lastMessage.revoke) {
            return RevokeCell.tip(lastMessage)
        }
        if(lastMessage.flame) {
            return FlameMessageCell.tip(lastMessage)
        }
        const digest = this.messageDigest(lastMessage)
        if (lastMessage.channel.channelType === ChannelTypePerson) {
            return digest
        } else {

            let from = ""
            if (lastMessage.fromUID && lastMessage.fromUID !== "") {
                const fromChannel = new Channel(lastMessage.fromUID, ChannelTypePerson)
                const fromChannelInfo = WKSDK.shared().channelManager.getChannelInfo(fromChannel)
                if (fromChannelInfo) {
                    from = `${fromChannelInfo.title}: `
                } else {
                    WKSDK.shared().channelManager.fetchChannelInfo(fromChannel)
                }
            }


            return `${from}${digest}`
        }
    }

    messageDigest(message: MessageWrap) {
        const digest = message.content?.conversationDigest
        if (digest && `${digest}`.trim() !== "") {
            return digest
        }
        switch (message.contentType) {
            case MessageContentTypeConst.image:
                return "[图片]"
            case MessageContentTypeConst.imageGroup:
                return "[多张图片]"
            case MessageContentTypeConst.gif:
                return "[GIF]"
            case MessageContentTypeConst.voice:
                return "[语音]"
            case MessageContentTypeConst.smallVideo:
                return "[小视频]"
            case MessageContentTypeConst.location:
                return "[位置]"
            case MessageContentTypeConst.card:
                return "[名片]"
            case MessageContentTypeConst.file:
                return "[文件]"
            case MessageContentTypeConst.mergeForward:
                return "[聊天记录]"
            case MessageContentTypeConst.lottieSticker:
            case MessageContentTypeConst.lottieEmojiSticker:
                return "[表情]"
            case MessageContentTypeConst.screenshot:
                return "[截图]"
            case MessageContentTypeConst.rtcP2P:
            case MessageContentTypeConst.rtcResult:
            case MessageContentTypeConst.rtcSwitchToVideo:
            case MessageContentTypeConst.rtcSwitchToVideoReply:
            case MessageContentTypeConst.rtcCancel:
            case MessageContentTypeConst.rtcSwitchToAudio:
            case MessageContentTypeConst.rtcData:
            case MessageContentTypeConst.rtcMissed:
            case MessageContentTypeConst.rtcReceived:
            case MessageContentTypeConst.rtcRefue:
            case MessageContentTypeConst.rtcAccept:
            case MessageContentTypeConst.rtcHangup:
                return "[通话]"
            default:
                return "[消息]"
        }
    }

    getOnlineTip(channelInfo: ChannelInfo) {
        if (channelInfo.online) {
            return undefined
        }
        const nowTime = new Date().getTime() / 1000
        const btwTime = nowTime - channelInfo.lastOffline
        if (btwTime < 60) {
            return "刚刚"
        }
        return `${(btwTime / 60).toFixed(0)}分钟`
    }

    // 是否需要显示在线状态
    needShowOnlineStatus(channelInfo?: ChannelInfo) {
        if (!channelInfo) {
            return false
        }
        if (channelInfo.online) {
            return true
        }
        const nowTime = new Date().getTime() / 1000
        const btwTime = nowTime - channelInfo.lastOffline
        if (btwTime > 0 && btwTime < 60 * 60) { // 小于1小时才显示
            return true
        }
        return false
    }

    conversationItem(conversationWrap: ConversationWrap) {
        

        let channelInfo = conversationWrap.channelInfo
        if (!channelInfo) {
            WKSDK.shared().channelManager.fetchChannelInfo(conversationWrap.channel)
        }

        const avatarKey = WKApp.shared.getChannelAvatarTag(conversationWrap.channel);

        const { select, onClick } = this.props
        const typing = TypingManager.shared.getTyping(conversationWrap.channel)
        const selected = select && select.isEqual(conversationWrap.channel)
        return <div key={conversationWrap.channel.getChannelKey()} onClick={() => {
            if (onClick) {
                onClick(conversationWrap)
            }
        }} className={classNames("wk-conversationlist-item", channelInfo?.top ? "wk-conversationlist-item-top" : undefined)} onContextMenu={(e) => {
            this._handleContextMenu(conversationWrap, e)
        }}>
            <div className={classNames("wk-conversationlist-item-content", selected ? "wk-conversationlist-item-selected" : undefined)}>
                <div className="wk-conversationlist-item-left">
                    <div className="wk-conversationlist-item-avatar-box">
                        <WKAvatar  channel={conversationWrap.channel} key={avatarKey}></WKAvatar>
                        {
                            channelInfo && this.needShowOnlineStatus(channelInfo) ? <OnlineStatusBadge tip={this.getOnlineTip(channelInfo)}></OnlineStatusBadge> : undefined
                        }

                    </div>
                </div>
                <div className="wk-conversationlist-item-right">
                    <div className="wk-conversationlist-item-right-first-line">
                        <div className="wk-conversationlist-item-name">
                            <h3>
                                {channelInfo?.orgData.displayName}


                            </h3>
                            {
                                channelInfo?.orgData.identityIcon ? <img style={{ "marginLeft": "4px", "width": channelInfo?.orgData?.identitySize.width, "height": channelInfo?.orgData?.identitySize.height }} src={channelInfo?.orgData.identityIcon}></img> : undefined
                            }
                            <div style={{ "width": "14px", height: "14px", "display": "flex", "alignItems": "center", "marginLeft": "5px" }}>
                                {
                                    channelInfo?.mute && <svg className="icon" viewBox="0 0 1131 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2755" width="14" height="14"><path d="M914.688 892.736L64 236.224l38.784-50.88L271.36 315.648a300.288 300.288 0 0 1 246.976-157.952v-33.28c0-16.64 13.504-30.08 30.08-30.08h2.304c16.576 0 30.08 13.44 30.08 30.08v32.96a299.776 299.776 0 0 1 284.928 299.136v294.272l45.504 58.624 48.768 37.696-45.312 45.632zM234.624 480.384l506.88 391.232H140.416l94.272-121.536-0.064-269.696z" fill="#bfbfbf" p-id="2756"></path></svg>
                                }

                            </div>
                            <div className="wk-conversationlist-item-time">
                                <span>{getTimeStringAutoShort2(conversationWrap.timestamp * 1000, true)}</span>
                            </div>
                        </div>

                    </div>
                    <div className="wk-conversationlist-item-right-second-line">
                        <div className="wk-conversationlist-item-lastmsg">
                            {
                                !typing?<label className="wk-reminder" style={{ display: conversationWrap.remoteExtra.draft  ? undefined : 'none' }}>[草稿]</label>:undefined
                            }
                            {
                                conversationWrap.simpleReminders && !typing &&  conversationWrap.simpleReminders.length>0 ?(
                                    conversationWrap.simpleReminders.filter((r)=>r.done === false).map((r)=>{
                                        return   <label key={r.reminderID} className="wk-reminder">{r.text}</label>
                                    })
                                ):undefined
                            }
                            {
                                typing ? this._getTypingUI(conversationWrap) : this.lastContent(conversationWrap)
                            }

                        </div>
                        <div className="wk-conversationlist-item-reddot">
                            {
                                conversationWrap.unread > 0 ? <Badge style={channelInfo?.mute ? { "border": "none", "backgroundColor": "rgb(200,200,200)" } : { border: "none" }} count={conversationWrap.unread} type='danger'></Badge> : undefined
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }

    onTop(channelInfo: ChannelInfo) {
        ChannelSettingManager.shared.top(!channelInfo.top, channelInfo.channel)
    }

    onMute(channelInfo: ChannelInfo) {
        ChannelSettingManager.shared.mute(!channelInfo.mute, channelInfo.channel)
    }

    onCloseChat(channel: Channel) { // 关闭聊天
        WKApp.conversationProvider.deleteConversation(channel)
    }

    async onClearMessages(channel: Channel) {
        if(this.props.onClearMessages) {
            this.props.onClearMessages(channel)
        }
    }

    isTopConversation(conversationWrap: ConversationWrap) {
        return conversationWrap.channelInfo?.top === true || conversationWrap.conversation.extra?.top === 1
    }

    conversationTeamEnabled() {
        return WKApp.remoteConfig.conversationTeamEnabled !== false
    }

    activeTeamMode() {
        return this.conversationTeamEnabled() && this.state.teams.length > 0
    }

    sectionLabel(title: string) {
        return <div key={`conversation-section-${title}`} className="wk-conversationlist-section-label">
            <span>{title}</span>
        </div>
    }

    teamLabel(teamID: number, name: string, count: number) {
        const collapsed = !!this.state.collapsedTeams[`${teamID}`]
        return <button
            key={`conversation-team-${teamID}`}
            type="button"
            className={classNames("wk-conversationlist-team-label", collapsed ? "wk-conversationlist-team-collapsed" : undefined)}
            onClick={() => this.toggleTeam(teamID)}
        >
            <span className="wk-conversationlist-team-arrow"></span>
            <span className="wk-conversationlist-team-name">{name}</span>
            <span className="wk-conversationlist-team-count">{count}</span>
        </button>
    }

    teamItem(channel: Channel) {
        return this.state.items.find((item) => {
            return item.channel_id === channel.channelID && Number(item.channel_type) === Number(channel.channelType)
        })
    }

    teamName(teamID: number) {
        if (teamID === 0) {
            return "聊天"
        }
        return this.state.teams.find((team) => team.id === teamID)?.name || "聊天"
    }

    teamIDForConversation(conversationWrap: ConversationWrap) {
        if (!this.activeTeamMode()) {
            return 0
        }
        if (conversationWrap.channel.channelType === ChannelTypePerson) {
            return 0
        }
        const item = this.teamItem(conversationWrap.channel)
        if (item && item.team_id > 0 && this.state.teams.some((team) => team.id === item.team_id)) {
            return item.team_id
        }
        return 0
    }

    sortedInTeam(teamID: number, conversations: ConversationWrap[]) {
        return conversations.slice().sort((a, b) => {
            const aTop = this.isTopConversation(a)
            const bTop = this.isTopConversation(b)
            if (aTop && bTop) {
                return this.stableTopOrder(teamID, a) - this.stableTopOrder(teamID, b)
            }
            if (aTop) {
                return -1
            }
            if (bTop) {
                return 1
            }
            return b.timestamp - a.timestamp
        })
    }

    teamGroups(conversations: ConversationWrap[]) {
        if (!this.activeTeamMode()) {
            return [{
                teamID: 0,
                name: "聊天",
                conversations: this.sortedInTeam(0, conversations || []),
            }]
        }
        const map: { [key: number]: ConversationWrap[] } = {}
        conversations.forEach((conversationWrap) => {
            const teamID = this.teamIDForConversation(conversationWrap)
            if (!map[teamID]) {
                map[teamID] = []
            }
            map[teamID].push(conversationWrap)
        })

        const orderedTeamIDs: number[] = []
        this.state.teams.forEach((team) => {
            if (map[team.id]?.length > 0) {
                orderedTeamIDs.push(team.id)
            }
        })
        if (map[0]?.length > 0) {
            orderedTeamIDs.push(0)
        }
        Object.keys(map).map(Number).forEach((teamID) => {
            if (!orderedTeamIDs.includes(teamID)) {
                orderedTeamIDs.push(teamID)
            }
        })
        return orderedTeamIDs.map((teamID) => ({
            teamID,
            name: this.teamName(teamID),
            conversations: this.sortedInTeam(teamID, map[teamID] || []),
        }))
    }

    conversationItems() {
        const { conversations } = this.props
        const items: React.ReactNode[] = []

        this.teamGroups(conversations || []).forEach((group) => {
            const shouldShowTeamLabel = group.teamID !== 0
            if (shouldShowTeamLabel) {
                items.push(this.teamLabel(group.teamID, group.name, group.conversations.length))
                if (this.state.collapsedTeams[`${group.teamID}`]) {
                    return
                }
            }
            let didRenderTopLabel = false
            let didRenderChatLabel = false
            group.conversations.forEach((conversationWrap) => {
                const isTop = this.isTopConversation(conversationWrap)
                if (isTop && !didRenderTopLabel) {
                    items.push(this.sectionLabel("置顶"))
                    didRenderTopLabel = true
                }
                if (!isTop && !didRenderChatLabel) {
                    items.push(this.sectionLabel("聊天"))
                    didRenderChatLabel = true
                }
                items.push(this.conversationItem(conversationWrap))
            })
        })

        return items
    }

    async createTeam() {
        const name = this.state.newTeamName.trim()
        if (!name) {
            Toast.warning("请输入团队名称")
            return
        }
        await ConversationTeamService.shared.create(name)
        this.setState({ newTeamName: "" })
        await this.loadTeams()
    }

    async renameTeam(team: ConversationTeam) {
        const name = this.state.editingTeamName.trim()
        if (!name) {
            Toast.warning("请输入团队名称")
            return
        }
        await ConversationTeamService.shared.rename(team.id, name)
        this.setState({ editingTeamID: undefined, editingTeamName: "" })
        await this.loadTeams()
    }

    async deleteTeam(team: ConversationTeam) {
        Modal.confirm({
            title: `删除团队“${team.name}”？`,
            content: "只会移除会话分组，不会删除群聊和聊天记录。",
            onOk: async () => {
                await ConversationTeamService.shared.delete(team.id)
                await this.loadTeams()
            }
        })
    }

    async moveSelectedToTeam(teamID: number) {
        const conversationWrap = this.state.selectConversationWrap
        if (!conversationWrap) {
            return
        }
        if (teamID > 0) {
            await ConversationTeamService.shared.move(conversationWrap.channel, teamID)
        } else {
            await ConversationTeamService.shared.remove(conversationWrap.channel)
        }
        await this.loadTeams()
        this.setState({ moveDialogVisible: false })
    }

    manageTeamDialog() {
        const { manageDialogVisible, teams, newTeamName, editingTeamID, editingTeamName } = this.state
        return <Modal
            visible={manageDialogVisible}
            title="管理团队"
            footer={null}
            onCancel={() => this.setState({ manageDialogVisible: false, editingTeamID: undefined })}
        >
            <div className="wk-conversation-team-create">
                <Input value={newTeamName} placeholder="输入团队名称" onChange={(value) => this.setState({ newTeamName: value })} onEnterPress={() => this.createTeam()} />
                <Button theme="solid" onClick={() => this.createTeam()}>添加</Button>
            </div>
            <div className="wk-conversation-team-manage-list">
                {teams.map((team) => {
                    const editing = editingTeamID === team.id
                    return <div key={team.id} className="wk-conversation-team-manage-row">
                        {editing ? <Input value={editingTeamName} onChange={(value) => this.setState({ editingTeamName: value })} onEnterPress={() => this.renameTeam(team)} /> : <span>{team.name}</span>}
                        {editing ? <Button size="small" onClick={() => this.renameTeam(team)}>保存</Button> : <Button size="small" onClick={() => this.setState({ editingTeamID: team.id, editingTeamName: team.name })}>改名</Button>}
                        <Button size="small" type="danger" onClick={() => this.deleteTeam(team)}>删除</Button>
                    </div>
                })}
            </div>
        </Modal>
    }

    moveTeamDialog() {
        const { moveDialogVisible, selectConversationWrap, teams } = this.state
        const canMove = selectConversationWrap?.channel.channelType === ChannelTypeGroup
        return <Modal
            visible={moveDialogVisible}
            title="移动到团队"
            footer={null}
            onCancel={() => this.setState({ moveDialogVisible: false })}
        >
            {!canMove ? <div className="wk-conversation-team-empty">只有群聊可以归属到团队。</div> : undefined}
            {canMove ? <div className="wk-conversation-team-move-list">
                {teams.map((team) => {
                    return <button key={team.id} type="button" onClick={() => this.moveSelectedToTeam(team.id)}>{team.name}</button>
                })}
                <button type="button" onClick={() => this.moveSelectedToTeam(0)}>移出团队</button>
                {teams.length === 0 ? <div className="wk-conversation-team-empty">还没有团队，请先在“管理团队”里添加。</div> : undefined}
            </div> : undefined}
        </Modal>
    }

    render() {
        const { selectConversationWrap } = this.state
        const teamMenus = this.conversationTeamEnabled() ? [
            {
                title: "管理团队", onClick: () => {
                    this.setState({ manageDialogVisible: true })
                }
            },
            {
                title: "移动到团队", onClick: () => {
                    this.setState({ moveDialogVisible: true })
                }
            },
        ] : []
        return <div id="wk-conversationlist" className="wk-conversationlist" onScroll={this._handleScroll.bind(this)}>
            {this.conversationItems()}
            {this.manageTeamDialog()}
            {this.moveTeamDialog()}

            <ContextMenus onContext={(ctx) => {
                this.contextMenusContext = ctx
            }} menus={[
                ...teamMenus,
                {
                    title: selectConversationWrap?.channelInfo?.top ? "取消置顶" : "置顶", onClick: () => {
                        this.onTop(selectConversationWrap?.channelInfo!)
                    }
                },
                {
                    title: selectConversationWrap?.channelInfo?.mute ? "关闭免打扰" : "开启免打扰", onClick: () => {
                        this.onMute(selectConversationWrap?.channelInfo!)
                    }
                },
                {
                    title: "关闭聊天窗口", onClick: () => {
                        this.onCloseChat(selectConversationWrap?.channel!)
                    }
                },
                {
                    title: "清空聊天记录", onClick: () => {
                        this.onClearMessages(selectConversationWrap?.channel!)
                    }
                },
                {
                    title: "关闭窗口并清空聊天记录", onClick: () => {
                        this.onCloseChat(selectConversationWrap?.channel!)
                        this.onClearMessages(selectConversationWrap?.channel!)
                    }
                },
            ]} />
        </div>
    }
}


interface OnlineStatusBadgeProps {
    tip?: string
}
export class OnlineStatusBadge extends Component<OnlineStatusBadgeProps> {

    render(): React.ReactNode {
        const { tip } = this.props
        return <div className={classNames("wk-onlinestatusbadge", !tip ? "wk-onlinestatusbadge-empty" : undefined)}>
            <div className="wk-onlinestatusbadge-content">
                <div className="wk-onlinestatusbadge-content-tip">{tip}</div>
            </div>
        </div>
    }
}
