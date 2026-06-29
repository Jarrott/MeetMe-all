import {
  ChannelQrcodeResp,
  Contacts,
  IChannelDataSource,
  ICommonDataSource,
  WKApp,
  RequestConfig,
  GroupRole,
} from "@tsdaodao/base";
import {
  Channel,
  ChannelInfo,
  ChannelTypeGroup,
  ChannelTypePerson,
  WKSDK,
  Message,
  MessageContentType,
  ConversationExtra,
  Subscriber,
} from "wukongimjssdk";
import axios from "axios";

function exactMessageID(message: Message): string {
  const msg = message as any;
  return `${msg.messageIDStr || msg.message_idstr || msg.message_id_str || message.messageID || ""}`;
}

function messagePlainText(message: Message): string {
  const content = (message.content || {}) as any;
  return `${content.text || content.content || content.contentObj?.content || content.conversationDigest || ""}`.trim();
}

export class ChannelDataSource implements IChannelDataSource {
  async exitChannel(channel: Channel): Promise<void> {
    if (channel.channelType === ChannelTypePerson) {
      return;
    }
    return WKApp.apiClient.post(`groups/${channel.channelID}/exit`);
  }

  async disbandChannel(channel: Channel): Promise<void> {
    if (channel.channelType === ChannelTypePerson) {
      return;
    }
    return WKApp.apiClient.delete(`groups/${channel.channelID}/disband`);
  }

  async channelTransferOwner(channel: Channel, toUID: string): Promise<void> {
    if (channel.channelType === ChannelTypePerson) {
      return;
    }
    return WKApp.apiClient.post(
      `groups/${channel.channelID}/transfer/${toUID}`
    );
  }

  async subscriberAttrUpdate(
    channel: Channel,
    subscriberUID: string,
    attr: any
  ): Promise<any> {
    if (channel.channelType === ChannelTypePerson) {
      return;
    }
    return WKApp.apiClient.put(
      `groups/${channel.channelID}/members/${subscriberUID}`,
      attr
    );
  }
  createChannel(uids: string[]): Promise<any> {
    return WKApp.apiClient.post(`group/create`, { members: uids });
  }
  async groupSaveList(): Promise<ChannelInfo[]> {
    const resp = await WKApp.apiClient.get("group/my", {
      param: {
        limit: 100000,
      },
    });
    const channelInfos = [];
    if (resp) {
      if (resp.length === 0) return [];
      for (const data of resp) {
        let channelInfo = new ChannelInfo();
        channelInfo.channel = new Channel(data.group_no, ChannelTypeGroup);
        channelInfo.title = data.name;
        channelInfo.logo = WKApp.shared.avatarChannel(channelInfo.channel);
        channelInfo.mute = data.mute === 1;
        channelInfo.top = data.top === 1;
        channelInfo.orgData = data;
        if (!channelInfo.orgData) {
          channelInfo.orgData = {};
        }
        if (channelInfo.orgData.remark && channelInfo.orgData.remark !== "") {
          channelInfo.orgData.displayName = channelInfo.orgData.remark;
        } else {
          channelInfo.orgData.displayName = channelInfo.title;
        }

        channelInfos.push(channelInfo);
      }
    }
    return channelInfos;
  }
  removeSubscribers(channel: Channel, uids: string[]): Promise<void> {
    return WKApp.apiClient.delete(`groups/${channel.channelID}/members`, {
      data: {
        members: uids,
      },
    });
  }
  addSubscribers(channel: Channel, uids: string[]): Promise<void> {
    return WKApp.apiClient.post(`groups/${channel.channelID}/members`, {
      members: uids,
    });
  }

  inviteSubscribers(
    channel: Channel,
    uids: string[],
    remark?: string
  ): Promise<void> {
    return WKApp.apiClient.post(`groups/${channel.channelID}/member/invite`, {
      uids: uids,
      remark: remark || "",
    });
  }

  forbiddenSubscriber(
    channel: Channel,
    uid: string,
    action: 0 | 1,
    key: number = 3
  ): Promise<void> {
    return WKApp.apiClient.post(
      `groups/${channel.channelID}/forbidden_with_member`,
      {
        member_uid: uid,
        action: action,
        key: key,
      }
    );
  }

  async subscribers(
    channel: Channel,
    req: {
      keyword?: string; // 搜索关键字
      limit?: number; // 每页数量
      page?: number; // 页码
    }
  ): Promise<Subscriber[]> {
    const resp = await WKApp.apiClient.get(
      `groups/${channel.channelID}/members`,
      {
        param: req,
      }
    );
    let members = new Array<Subscriber>();
    if (resp) {
      for (let i = 0; i < resp.length; i++) {
        let memberMap = resp[i];
        let member = new Subscriber();
        member.uid = memberMap.uid;
        member.name = memberMap.name;
        member.remark = memberMap.remark;
        member.role = memberMap.role;
        member.version = memberMap.version;
        member.isDeleted = memberMap.is_deleted;
        member.status = memberMap.status;
        member.orgData = memberMap;
        member.avatar = WKApp.shared.avatarUser(member.uid);
        members.push(member);
      }
    }
    return members;
  }

  updateField(channel: Channel, field: string, value: string): Promise<void> {
    const param: any = {};
    param[field] = value;
    return WKApp.apiClient.put(`groups/${channel.channelID}`, param);
  }

  qrcode(channel: Channel): Promise<ChannelQrcodeResp> {
    return WKApp.apiClient.get(`groups/${channel.channelID}/qrcode`, {
      resp: () => {
        return new ChannelQrcodeResp();
      },
    });
  }

  async updateSetting(setting: any, channel: Channel): Promise<void> {
    if (channel.channelType === ChannelTypeGroup) {
      return WKApp.apiClient.put(
        `groups/${channel.channelID}/setting`,
        setting
      );
    } else if (channel.channelType === ChannelTypePerson) {
      // 个人信息
      return WKApp.apiClient.put(`users/${channel.channelID}/setting`, setting);
    }
  }

  async managerRemove(channel: Channel, uids: string[]): Promise<void> {
    return WKApp.apiClient.delete(`groups/${channel.channelID}/managers`, {
      data: uids,
    });
  }

  async managerAdd(channel: Channel, uids: string[]): Promise<void> {
    return WKApp.apiClient.post(`groups/${channel.channelID}/managers`, uids);
  }

  reactMessage(message: Message, emoji: string): Promise<void> {
    return WKApp.apiClient.post(`reactions`, {
      message_id: exactMessageID(message),
      channel_id: message.channel.channelID,
      channel_type: message.channel.channelType,
      emoji: emoji,
    });
  }

  syncMessageReactions(
    channel: Channel,
    seq: number = 0,
    limit: number = 1000
  ): Promise<any[]> {
    return WKApp.apiClient.post(`reaction/sync`, {
      channel_id: channel.channelID,
      channel_type: channel.channelType,
      seq: seq,
      limit: limit,
    });
  }

  pinnedMessage(message: Message): Promise<void> {
    return WKApp.apiClient.post(`message/pinned`, {
      message_id: exactMessageID(message),
      message_seq: message.messageSeq,
      channel_id: message.channel.channelID,
      channel_type: message.channel.channelType,
    });
  }

  syncPinnedMessages(channel: Channel, version: number = 0): Promise<any> {
    return WKApp.apiClient.post(`message/pinned/sync`, {
      channel_id: channel.channelID,
      channel_type: channel.channelType,
      version: version,
    });
  }

  clearPinnedMessages(channel: Channel): Promise<void> {
    return WKApp.apiClient.post(`message/pinned/clear`, {
      channel_id: channel.channelID,
      channel_type: channel.channelType,
    });
  }

  blacklistAdd(channel: Channel, uids: string[]): Promise<void> {
    return WKApp.apiClient.post(`groups/${channel.channelID}/blacklist/add`, {
      uids: uids,
    });
  }

  blacklistRemove(channel: Channel, uids: string[]): Promise<void> {
    return WKApp.apiClient.post(
      `groups/${channel.channelID}/blacklist/remove`,
      { uids: uids }
    );
  }

  conversationExtraUpdate(conversationExtra: ConversationExtra): Promise<void> {
    return WKApp.apiClient.post(
      `conversations/${conversationExtra.channel.channelID}/${conversationExtra.channel.channelType}/extra`,
      {
        browse_to: conversationExtra.browseTo,
        keep_message_seq: conversationExtra.keepMessageSeq,
        keep_offset_y: conversationExtra.keepOffsetY,
        draft: conversationExtra.draft || "",
      }
    );
  }
}

export class CommonDataSource implements ICommonDataSource {
  translateMessage(
    message: Message,
    targetLang: string,
    sourceLang: string = "auto"
  ): Promise<any> {
    return WKApp.apiClient.post(`translate/message`, {
      message_id: exactMessageID(message),
      text: messagePlainText(message),
      source_lang: sourceLang,
      target_lang: targetLang,
    });
  }

  blacklistAdd(uid: string): Promise<void> {
    return WKApp.apiClient.post(`user/blacklist/${uid}`);
  }
  blacklistRemove(uid: string): Promise<void> {
    return WKApp.apiClient.delete(`user/blacklist/${uid}`);
  }
  deleteFriend(uid: string): Promise<void> {
    return WKApp.apiClient.delete(`friends/${uid}`);
  }

  userRemark(uid: string, remark: string): Promise<void> {
    return WKApp.apiClient.put(`friend/remark`, { uid: uid, remark: remark });
  }
  getFavoritesAll(): Promise<any> {
    // TODO: 这里先取10000足够 等后面再做分页
    return WKApp.apiClient.get(`favorite/my?page_index=1&page_size=10000`);
  }
  favorities(message: Message): Promise<void> {
    var content: string = "";
    if (message.contentType === MessageContentType.text) {
      content = message.content.contentObj.content;
    } else if (message.contentType === MessageContentType.image) {
      content = message.content.contentObj.url;
    }
    const fromChannelInfo = WKSDK.shared().channelManager.getChannelInfo(
      new Channel(message.fromUID, ChannelTypePerson)
    );
    return WKApp.apiClient.post(`favorites`, {
      type: message.contentType,
      unique_key: message.messageID,
      author_name: fromChannelInfo?.title || "",
      author_uid: message.fromUID,
      payload: { content: content },
    });
  }
  favoritiesDelete(id: string): Promise<void> {
    return WKApp.apiClient.delete(`favorites/${id}`);
  }
  userStickerCategory(): Promise<any> {
    return WKApp.apiClient.get(`sticker/user/category`);
  }
  getStickers(category: string): Promise<any> {
    return WKApp.apiClient.get(`sticker/user/sticker?category=${category}`);
  }
  async getStickerUploadURL(ext: string): Promise<string> {
    const normalizedExt = ext ? encodeURIComponent(ext.startsWith(".") ? ext : `.${ext}`) : ".gif";
    const result = await WKApp.apiClient.get(`file/upload?type=sticker&ext=${normalizedExt}`);
    return this.normalizeURL(result?.url || "");
  }
  addUserSticker(req: {
    category: string;
    path: string;
    placeholder?: string;
    format?: string;
    name?: string;
  }): Promise<any> {
    return WKApp.apiClient.post("sticker/user/sticker", req);
  }
  deleteUserSticker(id: number | string): Promise<void> {
    return WKApp.apiClient.delete(`sticker/user/sticker/${id}`);
  }
  async uploadStickerFile(file: File): Promise<string> {
    const ext = this.fileExtension(file.name) || this.fileExtension(file.type) || ".gif";
    const uploadURL = await this.getStickerUploadURL(ext);
    const param = new FormData();
    param.append("file", file);
    param.append("contenttype", file.type || this.inferContentType(file.name) || "application/octet-stream");
    const resp = await axios.post(uploadURL, param, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return resp.data?.path || "";
  }
  searchUser(keyword: string): Promise<any> {
    return WKApp.apiClient.get(`user/search?keyword=${keyword}`);
  }
  qrcodeMy(): Promise<any> {
    return WKApp.apiClient.get("user/qrcode");
  }

  friendSure(token: string): Promise<void> {
    return WKApp.apiClient.post("friend/sure", {
      token: token,
    });
  }

  friendApply(req: {
    uid: string;
    remark: string;
    vercode: string;
  }): Promise<void> {
    return WKApp.apiClient.post(`friend/apply`, {
      to_uid: req.uid,
      remark: req.remark,
      vercode: req.vercode,
    });
  }

  /**
   *  获取图片完整地址
   * @param path  图片路径
   * @param opts 参数
   */
  getImageURL(path: string, opts?: { width: number; height: number }): string {
    const normalizeURL = (value: string) => {
      if (!value) {
        return "";
      }
      if (value.indexOf("http") === 0 || value.indexOf("blob:") === 0 || value.indexOf("data:") === 0) {
        return value;
      }
      const baseURL = WKApp.apiClient.config.apiURL || "";
      const normalizedBase = baseURL.endsWith("/") ? baseURL.substring(0, baseURL.length - 1) : baseURL;
      const normalizedPath = value.startsWith("/") ? value : `/${value}`;
      return `${normalizedBase}${normalizedPath}`;
    };
    const appendImageOpts = (url: string) => {
      if (!opts || !opts.width || !opts.height) {
        return url;
      }
      const separator = url.indexOf("?") === -1 ? "?" : "&";
      return `${url}${separator}width=${Math.ceil(opts.width)}&height=${Math.ceil(opts.height)}`;
    };
    return appendImageOpts(normalizeURL(path));
  }
  getFileURL(path: string): string {
    if (!path) {
      return "";
    }
    if (path.indexOf("http") === 0 || path.indexOf("blob:") === 0 || path.indexOf("data:") === 0) {
      return path;
    }
    const baseURL = WKApp.apiClient.config.apiURL || "";
    const normalizedBase = baseURL.endsWith("/") ? baseURL.substring(0, baseURL.length - 1) : baseURL;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }
  normalizeURL(url: string) {
    if (typeof window !== "undefined" && window.location?.protocol === "https:" && url.indexOf("http://") === 0) {
      return url.replace("http://", "https://");
    }
    return url;
  }
  inferContentType(name?: string) {
    const ext = (name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    const map: Record<string, string> = {
      gif: "image/gif",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    return ext ? map[ext] : undefined;
  }
  fileExtension(name?: string) {
    const ext = (name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (ext) {
      return `.${ext}`;
    }
    if (name === "image/gif") {
      return ".gif";
    }
    if (name === "image/png") {
      return ".png";
    }
    if (name === "image/jpeg") {
      return ".jpg";
    }
    if (name === "image/webp") {
      return ".webp";
    }
    if (name === "image/svg+xml") {
      return ".svg";
    }
    return undefined;
  }

  async contactsSync(version: string): Promise<Contacts[]> {
    const results = await WKApp.apiClient.get(`friend/sync`, {
      param: { version: version, api_version: "1" },
    });
    const contactsList = new Array<Contacts>();
    if (results) {
      for (const result of results) {
        contactsList.push(this.toContacts(result));
      }
    }
    return contactsList;
  }
  imConnectAddr(): Promise<string> {
    return WKApp.apiClient
      .get(`users/${WKApp.loginInfo.uid}/im`)
      .then((resp) => {
        let addr = resp.wss_addr;
        if (!addr || addr === "") {
          addr = resp.ws_addr;
        }
        return addr;
      });
  }
  imConnectAddrs(): Promise<string[]> {
    return WKApp.apiClient
      .get(`users/${WKApp.loginInfo.uid}/im`)
      .then((resp) => {
        let addr = resp.wss_addr;
        if (!addr || addr === "") {
          addr = resp.ws_addr;
        }
        return [addr];
      });
  }

  toContacts(resultDic: any): Contacts {
    const contacts = new Contacts();
    contacts.uid = resultDic["uid"] || "";
    contacts.name = resultDic["name"] || "";
    contacts.remark = resultDic["remark"] || "";
    if (resultDic["version"]) {
      contacts.version = resultDic["version"] + "";
    }
    contacts.avatar = WKApp.shared.avatarUser(contacts.uid);
    contacts.status = resultDic["status"] || 0;
    contacts.follow = resultDic["follow"] || 0;
    contacts.vercode = resultDic["vercode"] || "";

    return contacts;
  }

  async searchFriends(keyword?: string): Promise<ChannelInfo[]> {
    let resp = await WKApp.apiClient.get("friend/sync", {
      param: {
        keyword: keyword,
        api_version: "1",
      },
    });
    const channelInfos = [];
    if (resp) {
      for (const data of resp) {
        if (data.is_deleted === 1) {
          continue;
        }
        let channelInfo = new ChannelInfo();
        channelInfo.channel = new Channel(data.uid, ChannelTypePerson);
        channelInfo.title = data.name;
        channelInfo.logo = WKApp.shared.avatarChannel(channelInfo.channel);
        channelInfo.mute = data.mute === 1;
        channelInfo.top = data.top === 1;
        channelInfo.orgData = data;
        if (!channelInfo.orgData) {
          channelInfo.orgData = {};
        }
        if (channelInfo.orgData.remark && channelInfo.orgData.remark !== "") {
          channelInfo.orgData.displayName = channelInfo.orgData.remark;
        } else {
          channelInfo.orgData.displayName = channelInfo.title;
        }

        channelInfos.push(channelInfo);
      }
    }
    return channelInfos;
  }
}
