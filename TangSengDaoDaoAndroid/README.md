实现自定义消息Item也十分简单。只需要实现两步即可

1、 编写消息item provider。继承`WKChatBaseProvider`文件，重写`getChatViewItem`方法如下
```kotlin
override fun getChatViewItem(parentView: ViewGroup, from: WKChatIteMsgFromType): View? {
        return LayoutInflater.from(context).inflate(R.layout.chat_item_card, parentView, false)
    }
```
 > 布局中不需要考虑头像，名称字段

 重写`setData`方法 获取控件并将控件填充数据。如下
 ```kotlin
override fun setData(
    adapterPosition: Int,
    parentView: View,
    uiChatMsgItemEntity: WKUIChatMsgItemEntity,
    from: WKChatIteMsgFromType
) {
    val cardNameTv = parentView.findViewById<TextView>(R.id.userNameTv)
    val cardContent = uiChatMsgItemEntity.wkMsg.baseContentMsgModel as WKCardContent
    cardNameTv.text = cardContent.name
    // todo ...
}
 ```
> 这里的`WKCardContent`消息对象是基于`悟空IM`sdk的实现，所有自定义消息model必须基于`悟空IM`。关于`悟空IM`自定义消息可查看[Android文档](https://githubim.com/sdk/android.html "文档")中的自定义消息

 设置item的消息类型
 ```kotlin
override val itemViewType: Int
    get() = WKContentType.WK_CARD
 ```
2、完成消息item提供者的编写后需将该item注册到消息提供管理中。
```kotlin
WKMsgItemViewManager.getInstance().addChatItemViewProvider(WKContentType.WK_LOCATION, WKCardProvider())
```
对此自定义消息Item已经完成，在收到此类型的消息时就会展示到聊天列表中了
详细实现步骤可以查看代码`wkuikit`模块中`provider`包中的`WKImageProvider`文件
