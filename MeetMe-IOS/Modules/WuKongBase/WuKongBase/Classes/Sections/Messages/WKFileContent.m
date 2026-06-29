//
//  WKFileContent.m
//  WuKongBase
//

#import "WKFileContent.h"
#import "WKConstant.h"
#import <WuKongIMSDK/WKFileUtil.h>

@implementation WKFileContent

+ (instancetype)fileWithURL:(NSURL *)fileURL {
    WKFileContent *content = [WKFileContent new];
    NSString *fileName = fileURL.lastPathComponent ?: @"file";
    content.name = fileName;
    
    NSURL *readURL = fileURL;
    BOOL scoped = [fileURL startAccessingSecurityScopedResource];
    NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:readURL.path error:nil];
    content.size = [attrs fileSize];
    
    NSString *tmpName = [NSString stringWithFormat:@"%@_%@", [NSUUID UUID].UUIDString, fileName];
    NSString *tmpPath = [NSTemporaryDirectory() stringByAppendingPathComponent:tmpName];
    [[NSFileManager defaultManager] copyItemAtURL:readURL toURL:[NSURL fileURLWithPath:tmpPath] error:nil];
    if(scoped) {
        [fileURL stopAccessingSecurityScopedResource];
    }
    content.sourceLocalPath = tmpPath;
    return content;
}

- (NSDictionary *)encodeWithJSON {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"type"] = [[self class] contentType];
    dict[@"url"] = self.remoteUrl ?: @"";
    dict[@"name"] = self.name ?: @"file";
    dict[@"size"] = @(self.size);
    return dict;
}

- (void)decodeWithJSON:(NSDictionary *)contentDic {
    self.remoteUrl = contentDic[@"url"] ?: contentDic[@"path"] ?: @"";
    self.name = contentDic[@"name"] ?: contentDic[@"file_name"] ?: self.remoteUrl.lastPathComponent ?: @"file";
    self.size = [contentDic[@"size"] longLongValue];
}

+ (NSNumber *)contentType {
    return @(WK_FILE);
}

- (NSString *)extension {
    NSString *ext = self.name.pathExtension;
    if(!ext || [ext isEqualToString:@""]) {
        return @"";
    }
    return [NSString stringWithFormat:@".%@", ext];
}

- (void)writeDataToLocalPath {
    [super writeDataToLocalPath];
    if(!self.sourceLocalPath || [self.sourceLocalPath isEqualToString:@""]) {
        return;
    }
    if([[NSFileManager defaultManager] fileExistsAtPath:self.localPath]) {
        return;
    }
    NSString *dir = self.localPath.stringByDeletingLastPathComponent;
    [WKFileUtil createDirectoryIfNotExist:dir];
    [[NSFileManager defaultManager] copyItemAtPath:self.sourceLocalPath toPath:self.localPath error:nil];
}

- (NSString *)conversationDigest {
    if(self.name && ![self.name isEqualToString:@""]) {
        return [NSString stringWithFormat:@"[文件] %@", self.name];
    }
    return @"[文件]";
}

- (NSString *)searchableWord {
    return self.name ?: @"";
}

- (NSString *)displaySize {
    long long bytes = self.size;
    if(bytes <= 0) {
        return @"";
    }
    double value = bytes;
    NSArray<NSString*> *units = @[@"B", @"KB", @"MB", @"GB"];
    NSInteger idx = 0;
    while(value >= 1024.0f && idx < units.count - 1) {
        value = value / 1024.0f;
        idx++;
    }
    if(idx == 0) {
        return [NSString stringWithFormat:@"%lld %@", bytes, units[idx]];
    }
    return [NSString stringWithFormat:@"%.1f %@", value, units[idx]];
}

@end
