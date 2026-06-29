//
//  WKConversationTopView.h
//  WuKongBase
//
//  Created by tt on 2024/5/20.
//

#import <UIKit/UIKit.h>
#import <WuKongIMSDK/WuKongIMSDK.h>

NS_ASSUME_NONNULL_BEGIN

@interface WKConversationTopView : UIView

@property(nonatomic,strong,nullable) WKMessage *pinnedMessage;
@property(nonatomic,copy,nullable) void(^onTap)(WKMessage *message);
@property(nonatomic,copy,nullable) void(^onClose)(WKMessage *message);

- (void)refreshWithPinnedMessage:(nullable WKMessage*)message;

@end

NS_ASSUME_NONNULL_END
