//
//  WKConversationTopView.m
//  WuKongBase
//
//  Created by tt on 2024/5/20.
//

#import "WKConversationTopView.h"
#import "WuKongBase.h"

@interface WKConversationTopView ()

@property(nonatomic,strong) UIView *indicatorView;
@property(nonatomic,strong) UILabel *titleLbl;
@property(nonatomic,strong) UILabel *digestLbl;
@property(nonatomic,strong) UIButton *closeBtn;

@end

@implementation WKConversationTopView

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    if(self) {
        self.backgroundColor = [WKApp shared].config.cellBackgroundColor;
        self.layer.shadowColor = [UIColor colorWithWhite:0.0f alpha:0.18f].CGColor;
        self.layer.shadowOffset = CGSizeMake(0.0f, 1.0f);
        self.layer.shadowOpacity = 1.0f;
        self.layer.shadowRadius = 2.0f;
        [self setupUI];
    }
    return self;
}

- (void)setupUI {
    self.indicatorView = [[UIView alloc] init];
    self.indicatorView.backgroundColor = [WKApp shared].config.themeColor;
    self.indicatorView.layer.cornerRadius = 2.0f;
    [self addSubview:self.indicatorView];
    
    self.titleLbl = [[UILabel alloc] init];
    self.titleLbl.text = LLang(@"置顶消息");
    self.titleLbl.font = [[WKApp shared].config appFontOfSize:13.0f];
    self.titleLbl.textColor = [WKApp shared].config.themeColor;
    [self addSubview:self.titleLbl];
    
    self.digestLbl = [[UILabel alloc] init];
    self.digestLbl.font = [[WKApp shared].config appFontOfSize:14.0f];
    self.digestLbl.textColor = [WKApp shared].config.defaultTextColor;
    self.digestLbl.lineBreakMode = NSLineBreakByTruncatingTail;
    [self addSubview:self.digestLbl];
    
    self.closeBtn = [UIButton buttonWithType:UIButtonTypeSystem];
    [self.closeBtn setTitle:@"x" forState:UIControlStateNormal];
    [self.closeBtn setTitleColor:[UIColor colorWithRed:0.47f green:0.51f blue:0.58f alpha:1.0f] forState:UIControlStateNormal];
    self.closeBtn.titleLabel.font = [[WKApp shared].config appFontOfSize:18.0f];
    [self.closeBtn addTarget:self action:@selector(closePressed) forControlEvents:UIControlEventTouchUpInside];
    [self addSubview:self.closeBtn];
    
    UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(viewTapped)];
    [self addGestureRecognizer:tap];
}

- (void)refreshWithPinnedMessage:(WKMessage *)message {
    self.pinnedMessage = message;
    NSString *digest = [message.content conversationDigest];
    if(!digest || [digest isEqualToString:@""]) {
        digest = LLang(@"此消息暂不支持预览");
    }
    self.digestLbl.text = digest;
}

- (void)viewTapped {
    if(self.pinnedMessage && self.onTap) {
        self.onTap(self.pinnedMessage);
    }
}

- (void)closePressed {
    if(self.pinnedMessage && self.onClose) {
        self.onClose(self.pinnedMessage);
    }
}

- (void)layoutSubviews {
    [super layoutSubviews];
    self.indicatorView.frame = CGRectMake(14.0f, 10.0f, 4.0f, self.lim_height - 20.0f);
    
    CGFloat closeSize = 44.0f;
    self.closeBtn.frame = CGRectMake(self.lim_width - closeSize - 4.0f, 5.0f, closeSize, self.lim_height - 10.0f);
    
    CGFloat textLeft = self.indicatorView.lim_right + 10.0f;
    CGFloat textWidth = self.closeBtn.lim_left - textLeft - 6.0f;
    self.titleLbl.frame = CGRectMake(textLeft, 8.0f, textWidth, 18.0f);
    self.digestLbl.frame = CGRectMake(textLeft, self.titleLbl.lim_bottom + 1.0f, textWidth, 22.0f);
}

@end
