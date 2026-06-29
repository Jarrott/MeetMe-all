package file

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"
)

// ServiceMinio 文件上传
type ServiceMinio struct {
	log.Log
	ctx            *config.Context
	downloadClient *http.Client
}

// NewServiceMinio NewServiceMinio
func NewServiceMinio(ctx *config.Context) *ServiceMinio {
	return &ServiceMinio{
		Log: log.NewTLog("File"),
		ctx: ctx,
		downloadClient: &http.Client{
			Timeout: time.Second * 30,
		},
	}
}

// UploadFile 上传文件
func (sm *ServiceMinio) UploadFile(filePath string, contentType string, copyFileWriter func(io.Writer) error) (map[string]interface{}, error) {
	contentType = normalizeTextContentType(filePath, contentType)
	minioConfig := sm.ctx.GetConfig().Minio

	ctx := context.Background()
	uploadUl, _ := url.Parse(minioConfig.UploadURL)
	endpoint := uploadUl.Host
	accessKeyID := minioConfig.AccessKeyID
	secretAccessKey := minioConfig.SecretAccessKey
	useSSL := false

	if strings.HasPrefix(uploadUl.Scheme, "https") {
		useSSL = true
	}
	// 初使化minio client对象。
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		sm.Error("创建错误：", zap.Error(err))
		return nil, err
	}
	bucketName := "file"
	strs := strings.Split(filePath, "/")
	if len(strs) > 0 {
		bucketName = strs[0]
	}
	exists, err := minioClient.BucketExists(ctx, bucketName)
	if err != nil {
		sm.Error(fmt.Sprintf("检测 %s目录是否存在错误", bucketName))
		return nil, err
	}
	if !exists {
		err = minioClient.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			sm.Error(fmt.Sprintf("创建 %s目录失败", bucketName))
			return nil, err
		}
		policy := `{
			"Version": "2012-10-17",
			"Statement": [{
				"Effect": "Allow",
				"Principal": {
					"AWS": ["*"]
				},
				"Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:ListBucketMultipartUploads"],
				"Resource": ["arn:aws:s3:::%s"]
			}, {
				"Effect": "Allow",
				"Principal": {
					"AWS": ["*"]
				},
				"Action": ["s3:AbortMultipartUpload", "s3:DeleteObject", "s3:GetObject", "s3:ListMultipartUploadParts", "s3:PutObject"],
				"Resource": ["arn:aws:s3:::%s/*"]
			}]
		}`
		err = minioClient.SetBucketPolicy(context.Background(), bucketName, fmt.Sprintf(policy, bucketName, bucketName))
		if err != nil {
			sm.Error("设置minio文件读写权限错误", zap.Error(err))
			return nil, err
		}
	}

	fileName := strings.TrimPrefix(filePath, fmt.Sprintf("%s/", bucketName))
	reader, writer := io.Pipe()
	go func() {
		err := copyFileWriter(writer)
		writer.CloseWithError(err)
	}()
	n, err := minioClient.PutObject(ctx, bucketName, fileName, reader, -1, minio.PutObjectOptions{ContentType: contentType, PartSize: 10 * 1024 * 1024})
	if err != nil {
		sm.Error("上传文件失败：", zap.Error(err))
		return map[string]interface{}{
			"path": "",
		}, err
	}
	return map[string]interface{}{
		"path": n.Key,
	}, err
}

func (sm *ServiceMinio) DownloadURL(ph string, filename string) (string, error) {
	minioConfig := sm.ctx.GetConfig().Minio
	vals := url.Values{}
	vals.Set("response-content-disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	if contentType := textContentTypeForPath(filename); contentType != "" {
		vals.Set("response-content-type", contentType)
	}
	result, _ := url.JoinPath(minioConfig.DownloadURL, ph)
	return fmt.Sprintf("%s?%s", result, vals.Encode()), nil
}

func normalizeTextContentType(filePath string, contentType string) string {
	if strings.TrimSpace(contentType) == "" || contentType == "application/octet-stream" {
		if normalized := textContentTypeForPath(filePath); normalized != "" {
			return normalized
		}
		return contentType
	}
	if isTextFilePath(filePath) && strings.EqualFold(strings.TrimSpace(contentType), "text/plain") {
		return "text/plain; charset=utf-8"
	}
	return contentType
}

func textContentTypeForPath(filePath string) string {
	if !isTextFilePath(filePath) {
		return ""
	}
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".json":
		return "application/json; charset=utf-8"
	case ".csv":
		return "text/csv; charset=utf-8"
	case ".xml":
		return "application/xml; charset=utf-8"
	default:
		return "text/plain; charset=utf-8"
	}
}

func isTextFilePath(filePath string) bool {
	switch strings.ToLower(filepath.Ext(filePath)) {
	case ".txt", ".text", ".log", ".md", ".markdown", ".csv", ".json", ".xml", ".yaml", ".yml":
		return true
	default:
		return false
	}
}
