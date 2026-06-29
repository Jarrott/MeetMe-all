FROM --platform=$BUILDPLATFORM golang:1.23 AS build

ARG TARGETOS=linux
ARG TARGETARCH=amd64

ENV GOPROXY=https://goproxy.cn,direct
ENV GO111MODULE=on


WORKDIR /go/cache


ADD go.mod .
ADD go.sum .
RUN go mod download

WORKDIR /go/release



# RUN apt-get update && \
#       apt-get -y install ca-certificates 

ADD . .

# RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-w -extldflags "-static"' -installsuffix cgo -o app ./main.go

RUN GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown") && \
    GIT_COMMIT_DATE=$(git log --date=iso8601-strict -1 --pretty=%ct 2>/dev/null || date +%s) && \
    GIT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "dev") && \
    GIT_TREE_STATE=$(git status --porcelain >/tmp/git-status 2>/dev/null && test -s /tmp/git-status && echo "dirty" || echo "clean") && \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-w -extldflags '-static' -X main.Commit=$GIT_COMMIT -X main.CommitDate=$GIT_COMMIT_DATE -X main.Version=$GIT_VERSION -X main.TreeState=$GIT_TREE_STATE" -installsuffix cgo  -o app ./main.go


FROM alpine AS prod
# Import the user and group files from the builder.
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN mkdir -p /usr/share/zoneinfo/Asia && \
    ln -s /etc/localtime /usr/share/zoneinfo/Asia/Shanghai
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
WORKDIR /home
COPY --from=build /go/release/app /home
COPY --from=build /go/release/assets /home/assets
COPY --from=build /go/release/configs /home/configs
RUN echo "Asia/Shanghai" > /etc/timezone
ENV TZ=Asia/Shanghai

# 不加  apk add ca-certificates  apns2推送将请求错误
# RUN  apk add ca-certificates 

ENTRYPOINT ["/home/app"]
