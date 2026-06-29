package rtc

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/require"
)

func TestBuildJoinToken(t *testing.T) {
	token, expiresAt, err := buildJoinToken(joinTokenOptions{
		Config: liveKitConfig{
			APIKey:    "test-key",
			APISecret: "test-secret",
			WSURL:     "wss://rtc.example.com",
		},
		Room:     "room-1",
		Identity: "user_1001",
		Name:     "test-user",
		Metadata: "hello",
		Attributes: map[string]string{
			" role ": " host ",
		},
		Permissions: permissionResp{
			CanPublish:           true,
			CanSubscribe:         true,
			CanPublishData:       false,
			CanUpdateOwnMetadata: true,
		},
		TTL: time.Hour,
	})
	require.NoError(t, err)
	require.NotEmpty(t, token)
	require.True(t, expiresAt.After(time.Now()))

	parsed, err := jwt.ParseWithClaims(token, &liveKitClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte("test-secret"), nil
	})
	require.NoError(t, err)
	require.True(t, parsed.Valid)

	claims := parsed.Claims.(*liveKitClaims)
	require.Equal(t, "test-key", claims.Issuer)
	require.Equal(t, "user_1001", claims.Subject)
	require.Equal(t, "test-user", claims.Name)
	require.Equal(t, "hello", claims.Metadata)
	require.Equal(t, "host", claims.Attributes["role"])
	require.Equal(t, "room-1", claims.Video.Room)
	require.True(t, claims.Video.RoomJoin)
	require.True(t, *claims.Video.CanPublish)
	require.True(t, *claims.Video.CanSubscribe)
	require.False(t, *claims.Video.CanPublishData)
	require.True(t, *claims.Video.CanUpdateOwnMetadata)
}

func TestClampTTL(t *testing.T) {
	require.Equal(t, minTokenTTL, clampTTL(1))
	require.Equal(t, maxTokenTTL, clampTTL(int((48 * time.Hour).Seconds())))
	require.Equal(t, 30*time.Minute, clampTTL(1800))
}
