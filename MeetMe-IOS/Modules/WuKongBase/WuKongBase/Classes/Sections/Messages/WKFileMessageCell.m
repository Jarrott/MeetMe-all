//
//  WKFileMessageCell.m
//  WuKongBase
//

#import "WKFileMessageCell.h"
#import "WKFileContent.h"
#import <WuKongIMSDK/WKFileUtil.h>

@interface WKFileMessageCell ()<UIDocumentInteractionControllerDelegate>

@property(nonatomic,strong) UIView *iconBox;
@property(nonatomic,strong) UILabel *iconLbl;
@property(nonatomic,strong) UILabel *nameLbl;
@property(nonatomic,strong) UILabel *sizeLbl;
@property(nonatomic,strong) UIProgressView *progressView;
@property(nonatomic,strong) WKMessageFileUploadTask *uploadTask;
@property(nonatomic,strong) WKMessageFileDownloadTask *downloadTask;
@property(nonatomic,strong) UIDocumentInteractionController *documentController;

@end

@implementation WKFileMessageCell

+ (CGSize)contentSizeForMessage:(WKMessageModel *)model {
    CGFloat maxWidth = MIN([WKApp shared].config.messageContentMaxWidth, 260.0f);
    return CGSizeMake(maxWidth, 68.0f);
}

- (void)initUI {
    [super initUI];
    
    self.iconBox = [[UIView alloc] initWithFrame:CGRectMake(0.0f, 0.0f, 44.0f, 44.0f)];
    self.iconBox.layer.cornerRadius = 8.0f;
    self.iconBox.layer.masksToBounds = YES;
    self.iconBox.backgroundColor = [UIColor colorWithRed:0.95f green:0.39f blue:0.27f alpha:0.16f];
    [self.messageContentView addSubview:self.iconBox];
    
    self.iconLbl = [[UILabel alloc] initWithFrame:self.iconBox.bounds];
    self.iconLbl.text = @"FILE";
    self.iconLbl.textAlignment = NSTextAlignmentCenter;
    self.iconLbl.font = [[WKApp shared].config appFontOfSize:11.0f];
    self.iconLbl.textColor = [WKApp shared].config.themeColor;
    [self.iconBox addSubview:self.iconLbl];
    
    self.nameLbl = [[UILabel alloc] init];
    self.nameLbl.numberOfLines = 2;
    self.nameLbl.lineBreakMode = NSLineBreakByTruncatingMiddle;
    self.nameLbl.font = [[WKApp shared].config appFontOfSize:15.0f];
    self.nameLbl.textColor = [WKApp shared].config.defaultTextColor;
    [self.messageContentView addSubview:self.nameLbl];
    
    self.sizeLbl = [[UILabel alloc] init];
    self.sizeLbl.font = [[WKApp shared].config appFontOfSize:12.0f];
    self.sizeLbl.textColor = [UIColor colorWithRed:0.47f green:0.51f blue:0.58f alpha:1.0f];
    [self.messageContentView addSubview:self.sizeLbl];
    
    self.progressView = [[UIProgressView alloc] initWithProgressViewStyle:UIProgressViewStyleDefault];
    self.progressView.progressTintColor = [WKApp shared].config.themeColor;
    self.progressView.hidden = YES;
    [self.messageContentView addSubview:self.progressView];
    
    [self.messageContentView bringSubviewToFront:self.trailingView];
}

- (void)prepareForReuse {
    [super prepareForReuse];
    if(self.uploadTask) {
        [self.uploadTask removeListener:self];
        self.uploadTask = nil;
    }
    if(self.downloadTask) {
        [self.downloadTask removeListener:self];
        self.downloadTask = nil;
    }
}

- (void)refresh:(WKMessageModel *)model {
    [super refresh:model];
    WKFileContent *fileContent = (WKFileContent*)model.content;
    self.nameLbl.text = fileContent.name ?: @"file";
    NSString *size = [fileContent displaySize];
    self.sizeLbl.text = size.length > 0 ? size : LLang(@"文件");
    [self updateTextColors:model.isSend];
    [self updateProgress];
}

- (void)layoutSubviews {
    [super layoutSubviews];
    self.iconBox.lim_left = 8.0f;
    self.iconBox.lim_centerY_parent = self.messageContentView;
    self.iconLbl.frame = self.iconBox.bounds;
    
    CGFloat textLeft = self.iconBox.lim_right + 10.0f;
    CGFloat textWidth = self.messageContentView.lim_width - textLeft - 8.0f;
    self.nameLbl.frame = CGRectMake(textLeft, 9.0f, textWidth, 36.0f);
    self.sizeLbl.frame = CGRectMake(textLeft, self.messageContentView.lim_height - 22.0f, textWidth, 16.0f);
    self.progressView.frame = CGRectMake(textLeft, self.messageContentView.lim_height - 4.0f, textWidth, 2.0f);
}

- (void)updateTextColors:(BOOL)isSend {
    if(isSend) {
        self.iconBox.backgroundColor = [UIColor colorWithWhite:1.0f alpha:0.18f];
        self.iconLbl.textColor = [UIColor whiteColor];
        self.nameLbl.textColor = [UIColor whiteColor];
        self.sizeLbl.textColor = [UIColor colorWithWhite:1.0f alpha:0.78f];
        self.progressView.progressTintColor = [UIColor whiteColor];
        self.progressView.trackTintColor = [UIColor colorWithWhite:1.0f alpha:0.24f];
    }else{
        self.iconBox.backgroundColor = [UIColor colorWithRed:0.95f green:0.39f blue:0.27f alpha:0.16f];
        self.iconLbl.textColor = [WKApp shared].config.themeColor;
        self.nameLbl.textColor = [WKApp shared].config.defaultTextColor;
        self.sizeLbl.textColor = [UIColor colorWithRed:0.47f green:0.51f blue:0.58f alpha:1.0f];
        self.progressView.progressTintColor = [WKApp shared].config.themeColor;
        self.progressView.trackTintColor = nil;
    }
}

- (BOOL)tailWrap {
    return true;
}

- (void)updateProgress {
    __weak typeof(self) weakSelf = self;
    self.uploadTask = [[WKSDK shared] getMessageFileUploadTask:self.messageModel.message];
    if(self.uploadTask) {
        [self.uploadTask addListener:^{
            dispatch_async(dispatch_get_main_queue(), ^{
                if(weakSelf.uploadTask.status == WKTaskStatusProgressing) {
                    weakSelf.progressView.hidden = NO;
                    weakSelf.progressView.progress = weakSelf.uploadTask.progress;
                    weakSelf.sizeLbl.text = [NSString stringWithFormat:@"%@ %.0f%%", LLang(@"上传中"), weakSelf.uploadTask.progress * 100.0f];
                }else {
                    weakSelf.progressView.hidden = YES;
                    weakSelf.progressView.progress = 0.0f;
                }
            });
        } target:self];
    }else {
        self.progressView.hidden = YES;
        self.progressView.progress = 0.0f;
    }
}

- (void)onTap {
    WKFileContent *fileContent = (WKFileContent*)self.messageModel.content;
    if([WKFileUtil fileIsExistOfPath:fileContent.localPath]) {
        [self openFile:fileContent.localPath];
        return;
    }
    __weak typeof(self) weakSelf = self;
    UIView *topView = [WKNavigationManager shared].topViewController.view;
    self.downloadTask = [[WKSDK shared].mediaManager download:self.messageModel.message callback:^(WKMediaDownloadState state, CGFloat progress, NSError * _Nullable error) {
        if(state == WKMediaDownloadStateProcessing) {
            weakSelf.progressView.hidden = NO;
            weakSelf.progressView.progress = progress;
            weakSelf.sizeLbl.text = [NSString stringWithFormat:@"%@ %.0f%%", LLang(@"下载中"), progress * 100.0f];
        }else if(state == WKMediaDownloadStateFail) {
            weakSelf.progressView.hidden = YES;
            [topView showMsg:error.domain ?: LLang(@"文件下载失败")];
        }else {
            weakSelf.progressView.hidden = YES;
            weakSelf.progressView.progress = 0.0f;
            [weakSelf openFile:fileContent.localPath];
        }
    }];
}

- (void)openFile:(NSString*)path {
    if(!path || ![WKFileUtil fileIsExistOfPath:path]) {
        [[WKNavigationManager shared].topViewController.view showMsg:LLang(@"文件不存在")];
        return;
    }
    self.documentController = [UIDocumentInteractionController interactionControllerWithURL:[NSURL fileURLWithPath:path]];
    self.documentController.delegate = self;
    BOOL previewed = [self.documentController presentPreviewAnimated:YES];
    if(!previewed) {
        [self.documentController presentOptionsMenuFromRect:self.messageContentView.bounds inView:self.messageContentView animated:YES];
    }
}

- (UIViewController *)documentInteractionControllerViewControllerForPreview:(UIDocumentInteractionController *)controller {
    return [WKNavigationManager shared].topViewController;
}

@end
