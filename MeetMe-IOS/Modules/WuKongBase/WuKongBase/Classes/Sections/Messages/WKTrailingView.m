//
//  WKTrailingView.m
//  WuKongBase
//
//  Created by tt on 2021/9/17.
//

#import "WKTrailingView.h"
#import "WKResource.h"
#import "WKMessageCell.h"
#import "WKTimeTool.h"
#import "WKApp.h"
@interface WKTrailingView ()

@property(nonatomic,strong) WKMessageModel *messageModel;

@end

@implementation WKTrailingView

- (instancetype)init
{
    self = [super init];
    if (self) {
        [self setupUI];
    }
    return self;
}

-(void) setupUI {
    
    [self addSubview:self.trailingContentView];
    [self.trailingContentView addSubview:self.securityLockImgView];
    [self.trailingContentView addSubview:self.pinnedImgView];
    [self.trailingContentView addSubview:self.editTipLbl];
    [self.trailingContentView addSubview:self.timeLbl];
    [self.trailingContentView addSubview:self.readStatusLbl];
    [self.trailingContentView addSubview:self.statusImgView];
    
}

+(BOOL) needLoadingForModel:(WKMessageModel*)model {
    if(!model.isSend) {
        return false;
    }
    if(model.remoteExtra.isEdit && model.remoteExtra.uploadStatus != WKContentEditUploadStatusSuccess) {
        return true;
    }
    return model.status == WK_MESSAGE_WAITSEND || model.status == WK_MESSAGE_UPLOADING;
}

+(BOOL) hasStatusIcon:(WKMessageModel*)model {
    return model.isSend && ([self needLoadingForModel:model] || model.status == WK_MESSAGE_SUCCESS);
}

+(BOOL) hasIncomingMessageAfter:(WKMessageModel*)model {
    if(!model.isSend || !model.isPersonChannel) {
        return false;
    }
    WKMessageModel *cursor = model.nextMessageModel;
    while (cursor) {
        if(!cursor.isSend && cursor.messageId != 0 && !cursor.revoke) {
            return true;
        }
        cursor = cursor.nextMessageModel;
    }
    return false;
}

+(BOOL) isMessageReaded:(WKMessageModel*)model {
    return model.remoteExtra.readedCount > 0 || model.remoteExtra.readed || [self hasIncomingMessageAfter:model];
}

+(NSString*) readStatusText:(WKMessageModel*)model {
    if(!model.isSend || model.status != WK_MESSAGE_SUCCESS) {
        return @"";
    }
    if(model.remoteExtra.readedCount > 0) {
        if(model.remoteExtra.readedCount > 1) {
            return [NSString stringWithFormat:@"%@%ld", LLang(@"已读"), (long)model.remoteExtra.readedCount];
        }
        return LLang(@"已读");
    }
    if([self isMessageReaded:model]) {
        return LLang(@"已读");
    }
    return LLang(@"未读");
}

-(void) updateStatus:(WKMessageModel*) messageModel {
    if([self needLoading:messageModel]) {
        self.statusImgView.image = [self getImageNameForBaseModule:@"Conversation/Messages/TimeWait"];
        self.statusImgView.image = [self.statusImgView.image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
    }else if(messageModel.isSend && messageModel.status == WK_MESSAGE_SUCCESS) {
        if([[self class] isMessageReaded:messageModel]) {
            self.statusImgView.image = [self getImageNameForBaseModule:@"Conversation/Messages/DoubleCheckmark"];
            self.statusImgView.image = [self.statusImgView.image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
        }else{
            self.statusImgView.image = [self getImageNameForBaseModule:@"Conversation/Messages/Checkmark"];
            self.statusImgView.image = [self.statusImgView.image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
        }
    }
    self.statusImgView.tintColor =  [UIColor whiteColor];
    
}

-(void) refresh:(WKMessageModel*)messageModel {
    
    self.messageModel = messageModel;
    
    self.securityLockImgView.hidden = YES;
    self.pinnedImgView.hidden = !messageModel.remoteExtra.isPinned;
    self.readStatusLbl.hidden = YES;
    
    self.editTipLbl.hidden = !messageModel.remoteExtra.isEdit;
    [self.editTipLbl sizeToFit];
    
    if(messageModel.isSend) {
        [self updateStatus:messageModel];
        NSString *readStatus = [[self class] readStatusText:messageModel];
        if(readStatus.length > 0) {
            self.readStatusLbl.hidden = NO;
            self.readStatusLbl.text = readStatus;
            [self.readStatusLbl sizeToFit];
        }
    }
    
    self.statusImgView.hidden = ![[self class] hasStatusIcon:messageModel];
    if([messageModel isSend] || [WKApp shared].config.style == WKSystemStyleDark) {
        [self setElementColor:[WKApp shared].config.messageTipColor];
    }else {
        [self setElementColor:[WKApp shared].config.tipColor];
    }
   
    if(self.messageModel.remoteExtra.isEdit) {
        self.timeLbl.text = messageModel.editedAtStr;
    }else{
        self.timeLbl.text = messageModel.timeStr;
    }
    
    [self.timeLbl sizeToFit];
    
    
    [self layoutSubviews];
}

-(void) setElementColor:(UIColor*)color {
    self.statusImgView.tintColor =  color;
    self.timeLbl.textColor = color;
    self.readStatusLbl.textColor = color;
    self.securityLockImgView.tintColor = color;
    self.editTipLbl.textColor = color;
    
    self.pinnedImgView.tintColor = color;
}


+(CGSize) size:(WKMessageModel*)model {
    
    NSString *timeStr = model.timeStr;
    if(model.remoteExtra.isEdit) {
        timeStr = model.editedAtStr;
    }
    
    CGFloat timeWidth = [self  getWidthWithText:timeStr height:WKTimeHeight font:WKTimeFontSize];
    
    NSString *readStatus = [self readStatusText:model];
    CGFloat readStatusWidth = 0.0f;
    if(readStatus.length > 0) {
        readStatusWidth = [self getWidthWithText:readStatus height:WKReadStatusHeight font:WKReadStatusFontSize] + WKTimeLeftSpace;
    }
    
    CGFloat trailingWidth = WKPinnedIconSize.width + WKSecurityLockSize.width + WKSecurityLockRight + timeWidth + readStatusWidth + WKStatusLeft + WKStatusSize.width;
    CGFloat trailingHeight = WKTimeHeight;
    
    bool hasStatus = false; // 是否有状态icon
    bool hasSecurityLock = false;
    if(!model.remoteExtra.isPinned) {
        trailingWidth -= WKPinnedIconSize.width;
    }
    hasStatus = [self hasStatusIcon:model];
    hasSecurityLock  = false;
    
    if(!hasStatus) {
        trailingWidth-=WKStatusSize.width;
    }
    if(!hasSecurityLock) {
        trailingWidth -= (WKSecurityLockSize.width + WKSecurityLockRight);
    }
    if(model.remoteExtra.isEdit) {
        CGFloat editTipWidth =  [self getWidthWithText:[self editTip] height:WKEditTipHeight font:WKEditTipFontSize];
        trailingWidth += editTipWidth + WKTimeLeftSpace;
    }

   
    return CGSizeMake(trailingWidth, trailingHeight);
}

-(void) layoutSubviews {
    [super layoutSubviews];
    
    [self layoutTrailingView];
   
    if(self.tailWrap) {
        [self layoutTailWrap];
    }else {
        self.trailingContentView.lim_left = self.lim_width - self.trailingContentView.lim_width;
        self.trailingContentView.lim_top = self.lim_height - self.trailingContentView.lim_height;
    }
}

-(void) layoutTrailingView {
  
    self.trailingContentView.lim_size = [[self class] size:self.messageModel];
    
    UIView *preview;
    for (UIView *subview in self.trailingContentView.subviews) {
        if(subview.hidden) {
            continue;
        }
        subview.lim_centerY_parent = self.trailingContentView;
        if(preview) {
            subview.lim_left = preview.lim_right + WKTimeLeftSpace;
        }else {
            subview.lim_left = 0.0f;
        }
        preview = subview;
        
    }

//    self.trailingContentView.lim_size = [[self class] size:self.messageModel];
//    
//    // pinned
//    self.pinnedImgView.lim_left = 0.0f;
//    self.pinnedImgView.lim_centerY_parent = self.trailingContentView;
//    if(self.pinnedImgView.hidden) {
//        self.editTipLbl.lim_left = 0.0f;
//    }else {
//        self.editTipLbl.lim_left = self.pinnedImgView.lim_right + WKTimeLeftSpace;
//    }
//    
//
//    if(self.editTipLbl.hidden) {
//        self.securityLockImgView.lim_left = 0.0f;
//    }else {
//        self.securityLockImgView.lim_left = self.editTipLbl.lim_right;
//    }
//   
//    self.securityLockImgView.lim_centerY_parent = self.trailingContentView;
//    self.editTipLbl.lim_centerY_parent = self.trailingContentView;
//    self.editTipLbl.lim_top += 1.0f;
//    
//    
//    if(self.securityLockImgView.hidden) {
//        self.timeLbl.lim_left = 0.0f;
//    }else{
//        self.timeLbl.lim_left = self.securityLockImgView.lim_right + WKSecurityLockRight;
//    }
//    if(!self.editTipLbl.hidden) {
//        self.timeLbl.lim_left = self.editTipLbl.lim_right + WKTimeLeftSpace;
//    }
//   
//    self.timeLbl.lim_top = self.trailingContentView.lim_height/2.0f - self.timeLbl.lim_height/2.0f;
//    
//    self.statusImgView.lim_left = self.timeLbl.lim_right + WKStatusLeft;
//    self.statusImgView.lim_top = self.trailingContentView.lim_height/2.0f -  self.statusImgView.lim_height/2.0f;
    
}


-(void) layoutTailWrap {

    self.layer.masksToBounds = YES;
    self.layer.cornerRadius = self.lim_height/2.0f;
    self.backgroundColor = [UIColor colorWithRed:0.0f/255.0f green:0.0f/255.0f blue:0.0f/255.0f alpha:0.2f];
//
//
    
    [self setElementColor:[UIColor whiteColor]];
    self.trailingContentView.lim_centerX_parent = self;
    self.trailingContentView.lim_centerY_parent = self;
    
}
-(BOOL) needLoading:(WKMessageModel*)model {
    return [[self class] needLoadingForModel:model];
}


- (UIImageView *)statusImgView {
    if(!_statusImgView) {
        _statusImgView = [[UIImageView alloc] initWithFrame:CGRectMake(0.0f, 0.0f, WKStatusSize.width, WKStatusSize.height)];
    }
    return _statusImgView;
}

- (UILabel *)editTipLbl {
    if(!_editTipLbl) {
        _editTipLbl = [[UILabel alloc] init];
        _editTipLbl.text = [[self class] editTip];
        _editTipLbl.font = [UIFont italicSystemFontOfSize:WKEditTipFontSize];
        _editTipLbl.lim_height = WKEditTipHeight;
//        [_editTipLbl sizeToFit];
    }
    return _editTipLbl;
}

+(NSString*) editTip {
    return LLang(@"已编辑");
}

- (UIView *)trailingContentView {
    if(!_trailingContentView) {
        _trailingContentView = [[UIView alloc] init];
    }
    return _trailingContentView;
}

- (UIImageView *)securityLockImgView {
    if(!_securityLockImgView) {
        _securityLockImgView = [[UIImageView alloc] initWithFrame:CGRectMake(0.0f, 0.0f, WKSecurityLockSize.width, WKSecurityLockSize.height)];
        UIImage *img = [self getImageNameForBaseModule:@"Conversation/Messages/SecurityLock"];
        _securityLockImgView.image = [img imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
    }
    return _securityLockImgView;
}


- (UILabel *)timeLbl {
    if(!_timeLbl) {
        _timeLbl = [[UILabel alloc] init];
        _timeLbl.lim_height =  WKTimeHeight;
        _timeLbl.font = [[WKApp shared].config appFontOfSize:WKTimeFontSize];
    }
    return _timeLbl;
}

- (UILabel *)readStatusLbl {
    if(!_readStatusLbl) {
        _readStatusLbl = [[UILabel alloc] init];
        _readStatusLbl.lim_height = WKReadStatusHeight;
        _readStatusLbl.font = [[WKApp shared].config appFontOfSize:WKReadStatusFontSize];
        _readStatusLbl.textAlignment = NSTextAlignmentRight;
    }
    return _readStatusLbl;
}

- (UIImageView *)pinnedImgView {
    if(!_pinnedImgView) {
        _pinnedImgView = [[UIImageView alloc] initWithFrame:CGRectMake(0.0f, 0.0f, WKPinnedIconSize.width, WKPinnedIconSize.height)];
        UIImage *img = [self getImageNameForBaseModule:@"Conversation/Messages/Pinned"];
        _pinnedImgView.image = [img imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
    }
    return _pinnedImgView;
}

+(CGFloat)getWidthWithText:(NSString*)text height:(CGFloat)height font:(CGFloat)font{
    CGRect rect = [text boundingRectWithSize:CGSizeMake(MAXFLOAT, height) options:NSStringDrawingUsesLineFragmentOrigin attributes:@{NSFontAttributeName:[UIFont systemFontOfSize:font]} context:nil];
    return rect.size.width;
    
}


-(UIImage*) getImageNameForBaseModule:(NSString*)name {
    return [WKApp.shared loadImage:name moduleID:@"WuKongBase"];
//    return [[WKResource shared] resourceForImage:name podName:@"WuKongBase_images"];
}
@end
