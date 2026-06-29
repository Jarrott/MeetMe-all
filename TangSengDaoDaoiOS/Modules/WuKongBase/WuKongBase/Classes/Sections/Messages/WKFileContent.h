//
//  WKFileContent.h
//  WuKongBase
//

#import <Foundation/Foundation.h>
#import <WuKongIMSDK/WuKongIMSDK.h>

NS_ASSUME_NONNULL_BEGIN

@interface WKFileContent : WKMediaMessageContent

@property(nonatomic,copy) NSString *name;
@property(nonatomic,assign) long long size;
@property(nonatomic,copy,nullable) NSString *sourceLocalPath;

+ (instancetype)fileWithURL:(NSURL*)fileURL;
- (NSString*)displaySize;

@end

NS_ASSUME_NONNULL_END
