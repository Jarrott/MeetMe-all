//
//  WKReactionView.m
//  WuKongBase
//
//  Created by tt on 2021/9/13.
//

#import "WKReactionBaseView.h"
#import "WuKongBase.h"

@interface WKReactionBaseView ()

@property(nonatomic,strong) UIView *contentView;
@property(nonatomic,strong) NSMutableArray<UIView*> *renderedViews;
@property(nonatomic,assign) NSInteger lastRenderCount;

@end

@implementation WKReactionBaseView

- (void)render:(NSArray<WKReaction *> *)reactions {
    for (UIView *view in self.renderedViews) {
        [view removeFromSuperview];
    }
    [self.renderedViews removeAllObjects];
    
    if(!reactions || reactions.count == 0) {
        self.lim_size = CGSizeMake(0.0f, 0.0f);
        return;
    }
    
    NSMutableDictionary<NSString*, NSNumber*> *emojiCount = [NSMutableDictionary dictionary];
    NSMutableArray<WKReaction*> *activeReactions = [NSMutableArray array];
    for (WKReaction *reaction in reactions) {
        if(reaction.isDeleted) {
            continue;
        }
        if(!reaction.emoji || [reaction.emoji isEqualToString:@""]) {
            continue;
        }
        NSNumber *count = emojiCount[reaction.emoji] ?: @(0);
        emojiCount[reaction.emoji] = @(count.integerValue + 1);
        [activeReactions addObject:reaction];
    }
    if(activeReactions.count == 0) {
        self.lim_size = CGSizeMake(0.0f, 0.0f);
        return;
    }
    
    NSArray<NSString*> *topEmojis = [emojiCount keysSortedByValueUsingComparator:^NSComparisonResult(NSNumber * _Nonnull obj1, NSNumber * _Nonnull obj2) {
        return [obj2 compare:obj1];
    }];
    
    CGFloat height = 30.0f;
    CGFloat left = 7.0f;
    NSInteger maxEmoji = MIN(3, topEmojis.count);
    for (NSInteger i=0; i<maxEmoji; i++) {
        NSString *emoji = topEmojis[i];
        UILabel *emojiLbl = [[UILabel alloc] initWithFrame:CGRectMake(left, 5.0f, 20.0f, 20.0f)];
        emojiLbl.text = emoji;
        emojiLbl.font = [UIFont systemFontOfSize:15.0f];
        emojiLbl.textAlignment = NSTextAlignmentCenter;
        [self.contentView addSubview:emojiLbl];
        [self.renderedViews addObject:emojiLbl];
        left += 18.0f;
    }
    
    UILabel *countLbl = [[UILabel alloc] initWithFrame:CGRectMake(left + 1.0f, 5.0f, 22.0f, 20.0f)];
    countLbl.text = [NSString stringWithFormat:@"%ld", (long)activeReactions.count];
    countLbl.font = [[WKApp shared].config appFontOfSize:12.0f];
    countLbl.textColor = [UIColor colorWithRed:0.35f green:0.39f blue:0.47f alpha:1.0f];
    [self.contentView addSubview:countLbl];
    [self.renderedViews addObject:countLbl];
    left = countLbl.lim_right + 4.0f;
    
    NSInteger maxAvatar = MIN(3, activeReactions.count);
    for (NSInteger i=0; i<maxAvatar; i++) {
        WKReaction *reaction = activeReactions[i];
        WKUserAvatar *avatar = [[WKUserAvatar alloc] initWithFrame:CGRectMake(left - i * 5.0f, 5.0f, 20.0f, 20.0f)];
        avatar.borderWidth = 1.0f;
        avatar.url = [WKAvatarUtil getAvatar:reaction.uid ?: @""];
        avatar.userInteractionEnabled = NO;
        [self.contentView addSubview:avatar];
        [self.renderedViews addObject:avatar];
        left = avatar.lim_right + 2.0f;
    }
    
    self.lim_size = CGSizeMake(MAX(left + 6.0f, 54.0f), height);
    self.contentView.frame = self.bounds;
    self.contentView.layer.cornerRadius = height / 2.0f;
    self.contentView.layer.shadowPath = [UIBezierPath bezierPathWithRoundedRect:self.contentView.bounds cornerRadius:self.contentView.layer.cornerRadius].CGPath;
    
    if(self.lastRenderCount != activeReactions.count) {
        self.transform = CGAffineTransformMakeScale(0.82f, 0.82f);
        [UIView animateWithDuration:0.2f delay:0.0f usingSpringWithDamping:0.58f initialSpringVelocity:0.4f options:UIViewAnimationOptionAllowUserInteraction animations:^{
            self.transform = CGAffineTransformIdentity;
        } completion:nil];
    }
    self.lastRenderCount = activeReactions.count;
}

- (UIView *)contentView {
    if(!_contentView) {
        _contentView = [[UIView alloc] initWithFrame:self.bounds];
        _contentView.backgroundColor = [UIColor colorWithRed:1.0f green:1.0f blue:1.0f alpha:0.96f];
        _contentView.layer.shadowColor = [UIColor colorWithWhite:0.0f alpha:0.16f].CGColor;
        _contentView.layer.shadowOffset = CGSizeMake(0.0f, 1.0f);
        _contentView.layer.shadowOpacity = 1.0f;
        _contentView.layer.shadowRadius = 4.0f;
        [self addSubview:_contentView];
    }
    return _contentView;
}

- (NSMutableArray<UIView *> *)renderedViews {
    if(!_renderedViews) {
        _renderedViews = [NSMutableArray array];
    }
    return _renderedViews;
}

@end
