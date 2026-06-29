import { Component, ReactNode } from "react";
import React from "react";
import { Input } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { Tabs } from '@douyinfe/semi-ui';
import Provider from "../../Service/Provider";
import GlobalSearchVM from "./vm";
import TabAll from "./tab-all";
import TabContacts from "./tab-contacts";
import TabGroup from "./tab-group";
import TabFile from "./tab-file";
import { Channel } from "wukongimjssdk";
import "./index.css";

interface GlobalSearchProps {
    channel?: Channel; // 查询指定频道的聊天记录
    // item点击事件，传递item和type，type为contacts、group、message,file
    onClick?: (item: any, type: string) => void;
    inline?: boolean;
    autoFocus?: boolean;
    hideTitle?: boolean;
    placeholder?: string;
    className?: string;
    onEscape?: () => void;
}

export default class GlobalSearch extends Component<GlobalSearchProps> {
    vm!: GlobalSearchVM


    tabPanel(key: string) {

        // message
        if (key === 'all') {
            return <TabAll
                searchResult={this.vm.searchResult}
                keyword={this.vm.keyword}
                loadMore={() => {
                    this.vm.loadMore()
                }}
                onClick={(item, type) => {
                    if (this.props.onClick) {
                        this.props.onClick(item, type)
                    }
                }}
            />
        }

        // contacts
        if (key === 'contacts') {
            return <TabContacts
                friends={this.vm.searchResult?.friends}
                keyword={this.vm.keyword}
                onClick={(item) => {
                    if (this.props.onClick) {
                        this.props.onClick(item, "contacts")
                    }
                }}
            ></TabContacts>
        }

        // groups
        if (key === 'groups') {
            return <TabGroup
                groups={this.vm.searchResult?.groups}
                keyword={this.vm.keyword}
                onClick={(item) => {
                    if (this.props.onClick) {
                        this.props.onClick(item, "group")
                    }
                }}
            ></TabGroup>
        }

        // files
        if (key === 'files') {
            return <TabFile
                files={this.vm.searchResult?.messages}
                keyword={this.vm.keyword}
                loadMore={() => {
                    this.vm.loadMore()
                }}
                onClick={(item) => {
                    if (this.props.onClick) {
                        this.props.onClick(item, "file")
                    }
                }}
            />
        }
    }

    render(): ReactNode {
        const { channel, inline, autoFocus, hideTitle, placeholder, className, onEscape } = this.props;
        return <Provider
            create={() => {
                this.vm = new GlobalSearchVM()
                this.vm.channel = channel
                return this.vm
            }}
            render={(vm: GlobalSearchVM) => {

                return <div className={[
                    "wk-globalsearch",
                    inline ? "wk-globalsearch-inline" : "",
                    className || "",
                ].filter(Boolean).join(" ")}
                    onClick={(event) => {
                        event.stopPropagation();
                    }}>
                    {
                        vm.searchInChannel && !hideTitle ? <div className="wk-globalsearch-title">{vm.searchTitle}</div> : undefined
                    }
                    <Input
                        prefix={<IconSearch />}
                        showClear
                        autoFocus={autoFocus}
                        placeholder={placeholder || "搜索"}
                        style={{ height: "40px" }}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && onEscape) {
                                onEscape();
                            }
                        }}
                        onCompositionStart={() => { vm.isComposing = true; }}
                        onCompositionEnd={(e: any) => {
                            vm.isComposing = false;
                            vm.handleInputChange(e.target.value);
                        }}
                        onChange={(value) => {
                            vm.handleInputChange(value);
                        }}></Input>
                    <div className="wk-search-tabs">
                        <Tabs
                            tabList={vm.tabList}
                            onChange={key => {
                                vm.onTabClick(key);
                            }}
                        >
                            {this.tabPanel(vm.selectedTabKey)}
                        </Tabs>
                    </div>
                </div>
            }}>

        </Provider>
    }
}
